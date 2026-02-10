/**
 * Auth API Route
 * Server-side endpoint for OAuth authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';
import { z } from 'zod/v4';
import { SESSION_EXPIRATION_SECONDS } from '@/lib/turnkey/constants';
import { getValidatedTurnkeyEnv } from '../env';

const env = getValidatedTurnkeyEnv();
const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: env.TURNKEY_API_PRIVATE_KEY,
  apiPublicKey: env.TURNKEY_API_PUBLIC_KEY,
  defaultOrganizationId: env.TURNKEY_ORGANIZATION_ID,
});

const AuthRequestSchema = z.object({
  suborgID: z.string().min(1, 'suborgID is required'),
  publicKey: z.string().min(1, 'publicKey is required'),
  oidcToken: z.string().min(1, 'oidcToken is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AuthRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { suborgID, publicKey, oidcToken } = parsed.data;

    const oauthResponse = await turnkey.apiClient().oauthLogin({
      oidcToken,
      publicKey,
      organizationId: suborgID,
      expirationSeconds: SESSION_EXPIRATION_SECONDS.toString(),
    });

    const { session } = oauthResponse;

    if (!session) {
      return NextResponse.json(
        { message: 'Authentication failed' },
        { status: 401 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Auth API error:', error);
    // Don't leak internal error details to the client
    return NextResponse.json(
      { message: 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}
