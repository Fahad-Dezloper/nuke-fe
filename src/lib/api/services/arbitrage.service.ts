/**
 * Arbitrage Service
 *
 * API service for arbitrage-related calls.
 * Currently only uses the open-positions endpoint.
 *
 * TODO: Add endpoints for strategies, history, and stats
 * when the backend supports them.
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';

export const arbitrageApiService = {
  /**
   * Get open positions across both exchanges
   */
  async getOpenPositions(evmAddress: string, solanaAddress: string) {
    return apiClient.get(API_ENDPOINTS.arbitrage.openPositions(evmAddress, solanaAddress));
  },
};
