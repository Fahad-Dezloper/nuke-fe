/**
 * Bridge Service
 * Handles bridge API calls for Base to Arbitrum transfers
 */

import { apiClient } from '@/lib/api/client';
import type {
  QuoteRequest,
  QuoteResponse,
  ExecutePermitRequest,
  ExecutePermitResponse,
  RelayStatusResponse,
} from './types';

/**
 * Bridge Service
 */
export const bridgeService = {
  /**
   * Get bridge quote
   * @param request - Quote request parameters
   * @returns Parsed quote response
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    try {
      const response = await apiClient.post<string>('/bridge/quote', request);

      // Response is a JSON string, need to parse it
      const quoteData: QuoteResponse = JSON.parse(response);
      return quoteData;
    } catch (error) {
      console.error('Error getting bridge quote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get bridge quote');
    }
  },

  /**
   * Execute permit signature
   * @param request - Execute permit request
   * @returns Execution result
   */
  async executePermit(request: ExecutePermitRequest): Promise<ExecutePermitResponse> {
    try {
      const response = await apiClient.post<string>('/bridge/execute/permits', request);

      // Response is a JSON string, need to parse it
      const result: ExecutePermitResponse = JSON.parse(response);
      return result;
    } catch (error) {
      console.error('Error executing permit:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to execute permit');
    }
  },

  /**
   * Get bridge status from Relay.link
   * @param requestId - The requestId from the bridge execution
   * @returns Relay status response
   */
  async getStatus(requestId: string): Promise<RelayStatusResponse> {
    try {
      // Call Relay.link API directly
      const apiUrl = process.env.NEXT_PUBLIC_RELAY_API_URL || 'https://api.relay.link';
      const response = await fetch(`${apiUrl}/intents/status/v3?requestId=${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const result: RelayStatusResponse = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting bridge status:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get bridge status');
    }
  },
};
