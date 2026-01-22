/**
 * Get Suborg API Route
 * Server-side endpoint to get sub-organization IDs by filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
});

const apiClient = turnkey.apiClient();

export async function POST(request: NextRequest) {
  try {
    const { filterType, filterValue } = await request.json();

    const response = await apiClient.getSubOrgIds({
      organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
      filterType,
      filterValue,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get suborg error:', error);
    return NextResponse.json(
      { message: 'Something went wrong.' },
      { status: 500 }
    );
  }
}
