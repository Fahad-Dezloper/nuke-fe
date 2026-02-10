/**
 * Deposit Service
 * Handles Hyperliquid deposit API calls
 */

import { apiClient } from '@/lib/api/client';
import type { DepositRequest, DepositResponse } from './types';

/**
 * Deposit Service
 */
export const depositService = {
  /**
   * Deposit USDC to Hyperliquid
   * @param request - Deposit request parameters
   * @returns Transaction hash
   */
  async deposit(request: DepositRequest): Promise<string> {
    try {
      const response = await apiClient.post<string>('/hyperliquid/deposit', {
        amount: request.amount,
        user: request.userAddress,
        permit: {
          v: request.permit.v,
          r: Array.from(request.permit.r), // Convert Uint8Array to number array
          s: Array.from(request.permit.s), // Convert Uint8Array to number array
          deadline: request.permit.deadline,
        },
      });

      // Response is a transaction hash string
      return response;
    } catch (error) {
      console.error('Error depositing to Hyperliquid:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to deposit to Hyperliquid');
    }
  },
};
