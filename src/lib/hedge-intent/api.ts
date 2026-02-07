/**
 * Hedge Intent API Service
 *
 * Thin wrapper around the existing apiClient for hedge intent endpoints.
 * Follows the same pattern as bridgeService / depositService.
 *
 * Endpoints:
 *   POST   /hedge-intents                        — create intent
 *   GET    /hedge-intents/{id}/next-action        — poll for next action
 *   POST   /hedge-intents/{id}/action-result      — report action outcome
 *   GET    /hedge-intents/{id}                    — get full detail
 *   GET    /hedge-intents/user/{userId}           — list user's intents
 */

import { apiClient } from '@/lib/api/client';
import type {
  CreateHedgeIntentRequest,
  CreateHedgeIntentResponse,
  NextActionResponse,
  ActionResultRequest,
  ActionResultResponse,
  HedgeIntentDetail,
  HedgeIntent,
} from './types';

// ─── Service ─────────────────────────────────────────────────────────────────

export const hedgeIntentApi = {
  /**
   * Create a new hedge intent
   * Backend splits margin 50/50 between the two protocols.
   *
   * @param request - Intent creation parameters
   * @returns The new hedge intent's ID
   */
  async create(request: CreateHedgeIntentRequest): Promise<string> {
    const response = await apiClient.post<CreateHedgeIntentResponse>(
      '/hedge-intents',
      request
    );
    return response.hedge_intent_id;
  },

  /**
   * Fetch the next action the client should execute.
   * This is the core polling endpoint.
   *
   * @param intentId - Hedge intent UUID
   * @returns The next action (or WAIT / NOOP)
   */
  async getNextAction(intentId: string): Promise<NextActionResponse> {
    return apiClient.get<NextActionResponse>(
      `/hedge-intents/${intentId}/next-action`
    );
  },

  /**
   * Report the outcome of an executed action.
   * Must be called after every action (even failures).
   *
   * @param intentId - Hedge intent UUID
   * @param result   - Action outcome
   */
  async reportActionResult(
    intentId: string,
    result: ActionResultRequest
  ): Promise<ActionResultResponse> {
    return apiClient.post<ActionResultResponse>(
      `/hedge-intents/${intentId}/action-result`,
      result
    );
  },

  /**
   * Fetch the full intent detail including all legs.
   * Used for rendering status UI and determining terminal states.
   *
   * @param intentId - Hedge intent UUID
   */
  async getDetail(intentId: string): Promise<HedgeIntentDetail> {
    return apiClient.get<HedgeIntentDetail>(
      `/hedge-intents/${intentId}`
    );
  },

  /**
   * List all hedge intents for a user (most recent first).
   *
   * @param userId - User UUID
   */
  async getUserIntents(userId: string): Promise<HedgeIntent[]> {
    return apiClient.get<HedgeIntent[]>(
      `/hedge-intents/user/${userId}`
    );
  },
};
