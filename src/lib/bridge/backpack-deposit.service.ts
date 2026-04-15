/**
 * Backpack Deposit Service
 * Builds a partially-signed Solana USDC transfer transaction via backend.
 *
 * Endpoint: POST /backpack/deposit
 * Response: base64-encoded legacy Solana Transaction (JSON string)
 */

import { apiClient } from '@/lib/api/client';

export const backpackDepositService = {
  async getPartiallySignedTransaction(amountMicros: bigint): Promise<string> {
    // Backpack deposit disabled (display-only demo).
    // Keep this service for easy re-enable later.
    void amountMicros;
    throw new Error('Backpack funding is disabled in this demo build.');
  },
};

