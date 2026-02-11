/**
 * Create Suborg API Route
 * Server-side endpoint to create a new sub-organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';
import { z } from 'zod/v4';
import * as jose from 'jose';
import { getValidatedTurnkeyEnv } from '../env';

const env = getValidatedTurnkeyEnv();
const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: env.TURNKEY_API_PRIVATE_KEY,
  apiPublicKey: env.TURNKEY_API_PUBLIC_KEY,
  defaultOrganizationId: env.TURNKEY_ORGANIZATION_ID,
});

// Google's JWKS endpoint for verifying ID tokens
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
 * Verify and decode a Google OIDC token.
 * Returns the verified payload or null if verification fails.
 */
async function verifyGoogleToken(
  oidcToken: string
): Promise<{ email?: string; name?: string; picture?: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(oidcToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      // audience is validated by Turnkey, so we skip it here
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

    let verifiedClaims: { email?: string; name?: string; picture?: string } | null = null;

    if (oauthProviders.length > 0) {
      // Verify the JWT properly instead of just decoding it
      verifiedClaims = await verifyGoogleToken(oauthProviders[0].oidcToken);
      // If verification fails, we still proceed — Turnkey will validate the token.
      // We just won't have display metadata.
    }

    const suborgResponse = await turnkey.apiClient().createSubOrganization({
      subOrganizationName: `suborg-${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
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
      ],
    });

    const { subOrganizationId } = suborgResponse;
    if (!subOrganizationId) {
      return NextResponse.json(
        { message: 'Failed to create sub-organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({ subOrganizationId });
  } catch (error) {
    console.error('Create suborg error:', error);
    // Don't leak internal error details
    return NextResponse.json(
      { message: 'Failed to create sub-organization. Please try again.' },
      { status: 500 }
    );
  }
}
