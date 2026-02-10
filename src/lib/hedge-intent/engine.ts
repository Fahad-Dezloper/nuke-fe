/**
 * Hedge Intent Execution Engine
 *
 * The polling loop that drives the hedge intent saga:
 *   1. Fetch next action from backend
 *   2. Execute it via HedgeActionExecutor
 *   3. Report result back to backend
 *   4. Repeat until NOOP (terminal)
 *
 * This is the "saga runner" — it never decides WHAT to do,
 * only fetches instructions and delegates execution.
 *
 * Designed to be called from a React hook but has no React dependencies.
 */

import { hedgeIntentApi } from './api';
import {
  HedgeActionExecutor,
  type ExecutorContext,
  type ActionResult,
} from './action-executor';
import type {
  HedgeAction,
  NextActionResponse,
  ActionResultRequest,
  HedgeIntentStatus,
} from './types';

// ─── Polling Intervals ───────────────────────────────────────────────────────

const POLL_INTERVAL_WAIT = 3_000;      // When backend says WAIT
const POLL_INTERVAL_FAST = 500;        // After reporting a result
const NETWORK_BACKOFF_BASE = 1_000;    // Exponential backoff base
const NETWORK_BACKOFF_MAX = 16_000;    // Max backoff
const MAX_CONSECUTIVE_NETWORK_ERRORS = 10;

// ─── Callbacks ───────────────────────────────────────────────────────────────

/**
 * Callbacks for the engine to notify the UI about progress.
 * All callbacks are optional — the engine functions without them.
 */
export interface EngineCallbacks {
  /** Fired when a new action starts executing */
  onActionStart?: (action: HedgeAction, leg: string | null) => void;

  /** Fired when an action completes (success or failure) */
  onActionComplete?: (action: HedgeAction, success: boolean) => void;

  /** Fired on general status/progress changes (for UI display) */
  onStatusChange?: (phase: string, detail?: string) => void;

  /** Fired on unrecoverable errors (engine will stop) */
  onError?: (error: string) => void;

  /** Fired when the intent reaches a terminal state successfully */
  onComplete?: (intentId: string, finalStatus: HedgeIntentStatus) => void;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Hedge Intent Execution Engine
 *
 * Runs the poll → execute → report loop for a single hedge intent.
 * Can be aborted externally (e.g., when the component unmounts).
 */
export class HedgeIntentEngine {
  private executor: HedgeActionExecutor;
  private aborted = false;

  constructor() {
    this.executor = new HedgeActionExecutor();
  }

  /**
   * Abort the execution loop.
   * The engine will stop after the current action completes.
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Check if the engine has been aborted.
   */
  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * Run the execution loop for a hedge intent.
   *
   * @param intentId - The hedge intent UUID
   * @param context  - Wallet addresses + Turnkey org ID
   * @param callbacks - UI notification callbacks
   */
  async run(
    intentId: string,
    context: ExecutorContext,
    callbacks: EngineCallbacks = {}
  ): Promise<void> {
    this.aborted = false;
    let consecutiveNetworkErrors = 0;

    while (!this.aborted) {
      // ── 1. Fetch next action ──────────────────────────────────
      let nextAction: NextActionResponse;

      try {
        nextAction = await hedgeIntentApi.getNextAction(intentId);
        consecutiveNetworkErrors = 0; // Reset on success
      } catch (err) {
        consecutiveNetworkErrors++;

        if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
          callbacks.onError?.(
            `Lost connection to server after ${MAX_CONSECUTIVE_NETWORK_ERRORS} attempts. ` +
            'Your hedge is safe — reopen to resume.'
          );
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
        const backoff = Math.min(
          NETWORK_BACKOFF_BASE * 2 ** (consecutiveNetworkErrors - 1),
          NETWORK_BACKOFF_MAX
        );
        console.warn(
          `[HedgeEngine] Network error #${consecutiveNetworkErrors}, retrying in ${backoff}ms:`,
          err
        );
        await this.sleep(backoff);
        continue;
      }

      // ── 2. Handle terminal / wait states ──────────────────────
      if (nextAction.action === 'NOOP') {
        await this.handleTerminalState(intentId, callbacks);
        return;
      }

      if (nextAction.action === 'WAIT') {
        callbacks.onStatusChange?.('waiting', 'Waiting for on-chain confirmations...');
        await this.sleep(POLL_INTERVAL_WAIT);
        continue;
      }

      // ── 3. Execute the action ─────────────────────────────────
      callbacks.onActionStart?.(nextAction.action, nextAction.leg);
      callbacks.onStatusChange?.(
        this.actionToPhase(nextAction.action),
        this.actionToDescription(nextAction)
      );

      let actionResult: ActionResult;

      try {
        actionResult = await this.executor.execute(nextAction, context);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        actionResult = {
          success: false,
          txHash: null,
          error: errorMessage,
          legResults: null,
        };
      }

      callbacks.onActionComplete?.(nextAction.action, actionResult.success);

      // ── 4. Report result to backend ───────────────────────────
      const report: ActionResultRequest = {
        action: nextAction.action,
        success: actionResult.success,
        tx_hash: actionResult.txHash,
        error: actionResult.error,
        leg_results: actionResult.legResults,
      };

      try {
        await hedgeIntentApi.reportActionResult(intentId, report);
      } catch (reportErr) {
        // Retry once — losing a result report is serious
        console.warn('[HedgeEngine] Failed to report result, retrying...', reportErr);
        await this.sleep(1_000);

        try {
          await hedgeIntentApi.reportActionResult(intentId, report);
        } catch (retryErr) {
          console.error('[HedgeEngine] Failed to report result after retry:', retryErr);
          // Continue the loop — backend may have received it,
          // or will re-issue the action on next poll
        }
      }

      // ── 5. Short delay, then loop ─────────────────────────────
      await this.sleep(POLL_INTERVAL_FAST);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Handle NOOP (terminal state) — check final intent status
   */
  private async handleTerminalState(
    intentId: string,
    callbacks: EngineCallbacks
  ): Promise<void> {
    try {
      const detail = await hedgeIntentApi.getDetail(intentId);
      const finalStatus = detail.intent.status;

      if (finalStatus === 'ACTIVE') {
        callbacks.onStatusChange?.('complete', 'Hedge is live!');
        callbacks.onComplete?.(intentId, finalStatus);
      } else if (finalStatus === 'CANCELLED') {
        callbacks.onStatusChange?.('complete', 'Hedge has been safely cancelled.');
        callbacks.onComplete?.(intentId, finalStatus);
      } else if (finalStatus === 'FAILED') {
        callbacks.onError?.('Hedge intent failed. Check your positions.');
      } else {
        callbacks.onComplete?.(intentId, finalStatus);
      }
    } catch {
      // Can't fetch detail — assume completion
      callbacks.onComplete?.(intentId, 'ACTIVE');
    }
  }

  /**
   * Map an action to a user-friendly phase name
   */
  private actionToPhase(action: HedgeAction): string {
    switch (action) {
      case 'BRIDGE_BASE_TO_ARB':
      case 'BRIDGE_BASE_TO_SOL':
        return 'bridging';
      case 'DEPOSIT_TO_HYPERLIQUID':
      case 'DEPOSIT_TO_PACIFICA':
        return 'depositing';
      case 'OPEN_HEDGE_POSITION':
        return 'opening';
      case 'CLOSE_POSITION':
        return 'closing';
      default:
        return 'processing';
    }
  }

  /**
   * Map an action to a user-friendly description
   */
  private actionToDescription(action: NextActionResponse): string {
    switch (action.action) {
      case 'BRIDGE_BASE_TO_ARB':
        return `Bridging $${action.amount_usd} USDC to Arbitrum...`;
      case 'BRIDGE_BASE_TO_SOL':
        return `Bridging $${action.amount_usd} USDC to Solana...`;
      case 'DEPOSIT_TO_HYPERLIQUID':
        return 'Depositing USDC into Hyperliquid...';
      case 'DEPOSIT_TO_PACIFICA':
        return 'Depositing USDC into Pacifica...';
      case 'OPEN_HEDGE_POSITION':
        return 'Opening hedge positions...';
      case 'CLOSE_POSITION':
        return `Closing ${action.leg} position (safety mode)...`;
      default:
        return 'Processing...';
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
