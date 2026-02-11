/**
 * Shared Bridge Status Polling Utility
 *
 * Used by both useBridge hook and HedgeActionExecutor.
 * Uses a while loop (not recursion) to avoid stack overflow.
 */

import { bridgeService } from './bridge.service';

const POLL_INTERVAL = 3_000;
const MAX_POLL_TIME = 300_000; // 5 minutes

export interface PollBridgeStatusOptions {
  /** Callback when status changes (for UI updates) */
  onStatusChange?: (status: string) => void;
  /** Custom poll interval (default: 3s) */
  pollInterval?: number;
  /** Custom timeout (default: 5min) */
  maxPollTime?: number;
}

/**
 * Poll Relay.link bridge status until completion or timeout.
 *
 * @throws Error if the bridge fails or times out
 */
export async function pollBridgeStatus(
  requestId: string,
  options: PollBridgeStatusOptions = {}
): Promise<void> {
  const interval = options.pollInterval ?? POLL_INTERVAL;
  const maxTime = options.maxPollTime ?? MAX_POLL_TIME;
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime >= maxTime) {
      throw new Error('Bridge status check timed out after 5 minutes');
    }

    try {
      const statusResponse = await bridgeService.getStatus(requestId);

      options.onStatusChange?.(statusResponse.status);

      if (statusResponse.status === 'success') {
        return;
      }

      if (statusResponse.status === 'failure' || statusResponse.status === 'refunded') {
        throw new Error(statusResponse.details || 'Bridge transaction failed');
      }
    } catch (err) {
      // If it's our own thrown error, re-throw
      if (
        err instanceof Error &&
        (err.message.includes('timed out') || err.message.includes('Bridge transaction failed'))
      ) {
        throw err;
      }
      // Otherwise it's a network error — continue polling
      console.warn('[pollBridgeStatus] Error polling, will retry:', err);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
