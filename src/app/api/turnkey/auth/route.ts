/**
 * Auth API Route
 * Server-side endpoint for OAuth authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';
import { SESSION_EXPIRATION_SECONDS } from '@/lib/turnkey/constants';

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
});

export async function POST(request: NextRequest) {
  try {
    const { suborgID, publicKey, oidcToken } = await request.json();

    const oauthResponse = await turnkey.apiClient().oauthLogin({
      oidcToken,
      publicKey,
      organizationId: suborgID,
      expirationSeconds: SESSION_EXPIRATION_SECONDS.toString(),
    });

    const { session } = oauthResponse;

    if (!session) {
      throw new Error('session not available');
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Auth API error:', error);
    const err = error as Error;
    return NextResponse.json(
      {
        message: 'Something went wrong.',
        error: err.message,
        details: err.toString(),
      },
      { status: 500 }
    );
  }
}
