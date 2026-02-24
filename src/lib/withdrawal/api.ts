/**
 * Withdrawal Intent API Service
 *
 * Thin wrapper around the existing apiClient for withdrawal intent endpoints.
 * Follows the same pattern as hedgeIntentApi.
 *
 * Endpoints:
 *   POST   /withdraw-intents/create-intent          — create intent
 *   GET    /withdraw-intents/{id}/next-action        — poll for next action
 *   POST   /withdraw-intents/transaction             — get signed tx data (withdraw step)
 *   POST   /withdraw-intents/bridge                  — get bridge quote
 *   POST   /withdraw-intents/{id}/action-result      — report action outcome
 *   GET    /withdraw-intents/{id}                    — get full detail
 *   GET    /withdraw-intents/user/{userId}           — list user's intents
 */

import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api';
import type {
  CreateWithdrawalIntentRequest,
  CreateWithdrawalIntentResponse,
  WithdrawalNextActionResponse,
  WithdrawalTransactionRequest,
  WithdrawalBridgeRequest,
  WithdrawalActionResultRequest,
  WithdrawalActionResultResponse,
  WithdrawalIntentDetail,
  WithdrawalIntent,
} from './types';

// ─── Service ─────────────────────────────────────────────────────────────────

export const withdrawalApi = {
  /**
   * Create a new withdrawal intent.
   *
   * @returns The new withdrawal intent's ID
   */
  async create(request: CreateWithdrawalIntentRequest): Promise<string> {
    const response = await apiClient.post<CreateWithdrawalIntentResponse>(
      API_ENDPOINTS.withdrawIntent.create,
      request
    );
    return response.withdrawal_intent_id;
  },

  /**
   * Fetch the next action the client should execute.
   */
  async getNextAction(intentId: string): Promise<WithdrawalNextActionResponse> {
    return apiClient.get<WithdrawalNextActionResponse>(
      API_ENDPOINTS.withdrawIntent.nextAction(intentId)
    );
  },

  /**
   * Get signed transaction data for the withdraw step.
   * Returns EIP-712 typed data for Hyperliquid, or submits directly for Pacifica.
   */
  async getTransaction<T = unknown>(request: WithdrawalTransactionRequest): Promise<T> {
    return apiClient.post<T>(
      API_ENDPOINTS.withdrawIntent.transaction,
      request
    );
  },

  /**
   * Get a bridge quote for moving USDC to Base.
   */
  async getBridgeQuote<T = unknown>(request: WithdrawalBridgeRequest): Promise<T> {
    return apiClient.post<T>(
      API_ENDPOINTS.withdrawIntent.bridge,
      request
    );
  },

  /**
   * Report the outcome of an executed action.
   * Must be called after every action (even failures).
   */
  async reportActionResult(
    intentId: string,
    result: WithdrawalActionResultRequest
  ): Promise<WithdrawalActionResultResponse> {
    return apiClient.post<WithdrawalActionResultResponse>(
      API_ENDPOINTS.withdrawIntent.actionResult(intentId),
      result
    );
  },

  /**
   * Fetch the full intent detail including all steps.
   */
  async getDetail(intentId: string): Promise<WithdrawalIntentDetail> {
    return apiClient.get<WithdrawalIntentDetail>(
      API_ENDPOINTS.withdrawIntent.detail(intentId)
    );
  },

  /**
   * List all withdrawal intents for a user.
   */
  async getUserIntents(userId: string): Promise<WithdrawalIntent[]> {
    return apiClient.get<WithdrawalIntent[]>(
      API_ENDPOINTS.withdrawIntent.userIntents(userId)
    );
  },
};
