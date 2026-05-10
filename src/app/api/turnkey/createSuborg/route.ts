/**
 * Create Suborg API Route
 * Server-side endpoint to create a new sub-organization.
 *
 * Flow:
 * 1. Verify the Google OIDC token (optional metadata enrichment).
 * 2. Create a sub-org via Turnkey's parent key with TWO root users:
 *    - The end-user (stays as sole root permanently)
 *    - The Automation DA user (temporary root, demoted in step 3)
 * 3. Call NestJS /internal/provision-suborg to:
 *    - Create scoped DA policies (signed by DA key)
 *    - Remove DA from root quorum (signed by DA key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';
import { z } from 'zod/v4';
import * as jose from 'jose';
import { getValidatedTurnkeyEnv } from '../env';

const env = getValidatedTurnkeyEnv();

// Parent org client — used only for createSubOrganization.
// This is the ONLY write operation the parent key is allowed to do on sub-orgs.
const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: env.TURNKEY_API_PRIVATE_KEY,
  apiPublicKey: env.TURNKEY_API_PUBLIC_KEY,
  defaultOrganizationId: env.TURNKEY_ORGANIZATION_ID,
});

const GOOGLE_JWKS = jose.createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

const OAuthProviderSchema = z.object({
  providerName: z.string().min(1),
  oidcToken: z.string().min(1),
});

const CreateSuborgRequestSchema = z.object({
  oauthProviders: z.array(OAuthProviderSchema),
  apiKeys: z.array(z.unknown()).optional().default([]),
});

/**
 * Verify a Google OIDC token and extract user metadata.
 * If verification fails we still proceed — Turnkey will re-validate the token
 * itself. We just won't have display metadata (name, picture).
 */
async function verifyGoogleToken(
  oidcToken: string
): Promise<{ email?: string; name?: string; picture?: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(oidcToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });
    return {
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
      picture: payload.picture as string | undefined,
    };
  } catch (error) {
    console.error('Failed to verify Google OIDC token:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateSuborgRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { oauthProviders, apiKeys } = parsed.data;

    // Attempt to verify Google token for display metadata
    let verifiedClaims: { email?: string; name?: string; picture?: string } | null = null;
    if (oauthProviders.length > 0) {
      verifiedClaims = await verifyGoogleToken(oauthProviders[0].oidcToken);
    }

    const parentClient = turnkey.apiClient();

    // ── Step 1: Create sub-org with BOTH users as root ────────────────────────
    //
    // Why both as root? This is a bootstrap requirement.
    // - Parent key cannot add users to an existing sub-org (write is blocked).
    // - rootUsers in createSubOrganization is the only entry point for the DA user.
    // - rootQuorumThreshold: 1 means either user can act independently.
    //
    // The DA user's root access is temporary — NestJS will demote it in step 3.
    const suborgResponse = await parentClient.createSubOrganization({
      subOrganizationName: `suborg-${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        // ── Index 0: End-user (permanent root) ──────────────────────────────
        {
          userName: verifiedClaims
            ? JSON.stringify({
                name: verifiedClaims.name,
                picture: verifiedClaims.picture,
                time: String(Date.now()),
              })
            : `user-${String(Date.now())}`,
          userEmail: verifiedClaims?.email ?? '',
          apiKeys: (apiKeys as never[]) || [],
          authenticators: [],
          oauthProviders: oauthProviders || [],
        },
        // ── Index 1: Automation DA user (temporary root) ─────────────────────
        //
        // We register the DA PUBLIC KEY here. Safe to include in FE repo.
        // The private key is only in the NestJS service.
        //
        // After NestJS completes provisioning this user will:
        // - Have scoped policies (can only sign / manage policies)
        // - NOT be in the root quorum (cannot bypass policy engine)
        {
          userName: 'Automation DA',
          userEmail: 'automationda@email.com',
          apiKeys: [
            {
              apiKeyName: 'Automation delegated access',
              publicKey: env.TURNKEY_DA_API_PUBLIC_KEY,
              curveType: 'API_KEY_CURVE_P256',
            },
          ],
          authenticators: [],
          oauthProviders: [],
        },
      ],
    });

    const { subOrganizationId, rootUserIds } = suborgResponse;

    if (!subOrganizationId || !rootUserIds || rootUserIds.length < 2) {
      console.error('Unexpected sub-org response:', suborgResponse);
      return NextResponse.json(
        { message: 'Failed to create sub-organization' },
        { status: 500 }
      );
    }

    // rootUserIds order matches the rootUsers array order above
    const endUserId = rootUserIds[0];
    const daUserId = rootUserIds[1];

    // ── Step 2: Hand off to NestJS for DA provisioning ────────────────────────
    //
    // NestJS holds the DA private key and will:
    //   a) Create scoped policies for the DA user (signed by DA key)
    //   b) Remove DA from root quorum (signed by DA key)
    //
    // If this call fails, the sub-org still exists and the user can log in.
    // The DA user will be a root user until manually remediated.
    // We log the error but do NOT fail the user-facing response.
    try {
      const provisionRes = await fetch(
        `${process.env.NEXT_PUBLIC_AUTOMATION_API_URL}/v1/internal/provision-suborg`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Shared secret so NestJS knows this is a trusted internal call
            // 'x-internal-secret': env.INTERNAL_SERVICE_SECRET,
          },
          body: JSON.stringify({ subOrganizationId, endUserId, daUserId }),
        }
      );

      if (!provisionRes.ok) {
        // Non-fatal: sub-org exists, user can still log in.
        // DA user will remain as root until remediated.
        console.error(
          `DA provisioning failed for sub-org ${subOrganizationId}:`,
          await provisionRes.text()
        );
      }
    } catch (provisionErr) {
      // Network error calling NestJS — same situation, non-fatal
      console.error(
        `DA provisioning network error for sub-org ${subOrganizationId}:`,
        provisionErr
      );
    }

    return NextResponse.json({ subOrganizationId });
  } catch (error) {
    console.error('Create suborg error:', error);
    return NextResponse.json(
      { message: 'Failed to create sub-organization. Please try again.' },
      { status: 500 }
    );
  }
}