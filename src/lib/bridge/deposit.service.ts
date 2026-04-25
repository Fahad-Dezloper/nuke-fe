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

  /**
   * Deposit USDC to Lighter (same permit payload shape as Hyperliquid; backend must expose `/lighter/deposit`).
   */
  async depositToLighter(request: DepositRequest): Promise<string> {
    try {
      const response = await apiClient.post<string>('/lighter/deposit', {
        amount: request.amount,
        permit: {
          v: request.permit.v,
          r: Array.from(request.permit.r),
          s: Array.from(request.permit.s),
          deadline: request.permit.deadline,
        },
        asset_index: 3,
        route_type: 0,
      });
      return response;
    } catch (error) {
      console.error('Error depositing to Lighter:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to deposit to Lighter');
    }
  },
};
