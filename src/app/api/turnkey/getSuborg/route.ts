/**
 * Get Suborg API Route
 * Server-side endpoint to get sub-organization IDs by filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';
import { z } from 'zod/v4';
import { getValidatedTurnkeyEnv } from '../env';

const env = getValidatedTurnkeyEnv();
const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: env.TURNKEY_API_PRIVATE_KEY,
  apiPublicKey: env.TURNKEY_API_PUBLIC_KEY,
  defaultOrganizationId: env.TURNKEY_ORGANIZATION_ID,
});

const apiClient = turnkey.apiClient();

const GetSuborgRequestSchema = z.object({
  filterType: z.string().min(1, 'filterType is required'),
  filterValue: z.string().min(1, 'filterValue is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = GetSuborgRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { filterType, filterValue } = parsed.data;

    const response = await apiClient.getSubOrgIds({
      organizationId: env.TURNKEY_ORGANIZATION_ID,
      filterType,
      filterValue,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get suborg error:', error);
    // Don't leak internal error details
    return NextResponse.json(
      { message: 'Failed to retrieve sub-organization. Please try again.' },
      { status: 500 }
    );
  }
}
