/**
 * Create Suborg API Route
 * Server-side endpoint to create a new sub-organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';
import { decode } from 'jsonwebtoken';

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
});

export async function POST(request: NextRequest) {
  try {
    const { oauthProviders, apiKeys } = await request.json();

    let decodedData = null;

    if (oauthProviders.length !== 0) {
      const decoded = decode(oauthProviders[0].oidcToken);
      if (decoded && typeof decoded === 'object' && 'email' in decoded) {
        decodedData = decoded;
      }
    }

    const suborgResponse = await turnkey.apiClient().createSubOrganization({
      subOrganizationName: `suborg-${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: decodedData
            ? JSON.stringify({
                name: decodedData?.name,
                picture: decodedData?.picture,
                time: String(Date.now()),
              })
            : `user-${String(Date.now())}`,
          userEmail: decodedData ? decodedData?.email : '',
          apiKeys: apiKeys || [],
          authenticators: [],
          oauthProviders: oauthProviders || [],
        },
      ],
    });

    const { subOrganizationId } = suborgResponse;
    if (!subOrganizationId) {
      throw new Error('Expected a non-null subOrganizationId.');
    }

    return NextResponse.json({ subOrganizationId });
  } catch (error) {
    console.error('Create suborg error:', error);
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 });
  }
}
