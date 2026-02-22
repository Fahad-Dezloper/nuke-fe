/**
 * Withdrawal Execution Engine
 *
 * The polling loop that drives the withdrawal intent saga:
 *   1. Fetch next action from backend
 *   2. Execute it via WithdrawalActionExecutor
 *   3. Report result back to backend
 *   4. Repeat until NOOP (terminal)
 *
 * This is the "saga runner" — it never decides WHAT to do,
 * only fetches instructions and delegates execution.
 *
 * Designed to be called from a React hook but has no React dependencies.
 */

import { withdrawalApi } from './api';
import {
  WithdrawalActionExecutor,
  type ExecutorContext,
  type ActionResult,
} from './action-executor';
import type {
  WithdrawalAction,
  WithdrawalNextActionResponse,
  WithdrawalActionResultRequest,
  WithdrawalStatus,
  WithdrawalExchange,
} from './types';

// ─── Polling Intervals ───────────────────────────────────────────────────────

const POLL_INTERVAL_WAIT = 3_000;
const POLL_INTERVAL_FAST = 500;
const NETWORK_BACKOFF_BASE = 1_000;
const NETWORK_BACKOFF_MAX = 16_000;
const MAX_CONSECUTIVE_NETWORK_ERRORS = 10;

// ─── Callbacks ───────────────────────────────────────────────────────────────

export interface EngineCallbacks {
  onActionStart?: (action: WithdrawalAction) => void;
  onActionComplete?: (action: WithdrawalAction, success: boolean) => void;
  onStatusChange?: (phase: string, detail?: string) => void;
  onError?: (error: string) => void;
  onComplete?: (intentId: string, finalStatus: WithdrawalStatus) => void;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class WithdrawalEngine {
  private executor: WithdrawalActionExecutor;
  private aborted = false;

  constructor() {
    this.executor = new WithdrawalActionExecutor();
  }

  abort(): void {
    this.aborted = true;
  }

  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * Run the execution loop for a withdrawal intent.
   */
  async run(
    intentId: string,
    context: ExecutorContext,
    exchange: WithdrawalExchange,
    callbacks: EngineCallbacks = {}
  ): Promise<void> {
    this.aborted = false;
    let consecutiveNetworkErrors = 0;

    while (!this.aborted) {
      // ── 1. Fetch next action ──────────────────────────────────
      let nextAction: WithdrawalNextActionResponse;

      try {
        nextAction = await withdrawalApi.getNextAction(intentId);
        consecutiveNetworkErrors = 0;
      } catch (err) {
        consecutiveNetworkErrors++;

        if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
          callbacks.onError?.(
            `Lost connection to server after ${MAX_CONSECUTIVE_NETWORK_ERRORS} attempts. ` +
            'Your withdrawal is safe — reopen to resume.'
          );
          return;
        }

        const backoff = Math.min(
          NETWORK_BACKOFF_BASE * 2 ** (consecutiveNetworkErrors - 1),
          NETWORK_BACKOFF_MAX
        );
        console.warn(
          `[WithdrawalEngine] Network error #${consecutiveNetworkErrors}, retrying in ${backoff}ms:`,
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
      callbacks.onActionStart?.(nextAction.action);
      callbacks.onStatusChange?.(
        this.actionToPhase(nextAction.action),
        this.actionToDescription(nextAction)
      );

      let actionResult: ActionResult;

      try {
        actionResult = await this.executor.execute(nextAction, context, exchange);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        actionResult = {
          success: false,
          txHash: null,
          error: errorMessage,
        };
      }

      callbacks.onActionComplete?.(nextAction.action, actionResult.success);

      // ── 4. Report result to backend ───────────────────────────
      const report: WithdrawalActionResultRequest = {
        action: nextAction.action,
        success: actionResult.success,
        tx_hash: actionResult.txHash,
        error: actionResult.error,
      };

      try {
        await withdrawalApi.reportActionResult(intentId, report);
      } catch (reportErr) {
        console.warn('[WithdrawalEngine] Failed to report result, retrying...', reportErr);
        await this.sleep(1_000);

        try {
          await withdrawalApi.reportActionResult(intentId, report);
        } catch (retryErr) {
          console.error('[WithdrawalEngine] Failed to report result after retry:', retryErr);
          if (!actionResult.success) {
            callbacks.onError?.(
              `${actionResult.error || 'Action failed'} (and failed to report to server)`
            );
            return;
          }
        }
      }

      // ── 5. If action failed, halt ─────────────────────────────
      if (!actionResult.success) {
        const errorMsg = actionResult.error
          || `${this.actionToPhaseLabel(nextAction.action)} failed unexpectedly`;

        console.error(
          `[WithdrawalEngine] Action ${nextAction.action} failed — stopping execution.`,
          errorMsg
        );
        callbacks.onError?.(errorMsg);
        return;
      }

      // ── 6. Short delay, then loop ─────────────────────────────
      await this.sleep(POLL_INTERVAL_FAST);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async handleTerminalState(
    intentId: string,
    callbacks: EngineCallbacks
  ): Promise<void> {
    try {
      const detail = await withdrawalApi.getDetail(intentId);
      const finalStatus = detail.intent.status;

      if (finalStatus === 'COMPLETED') {
        callbacks.onStatusChange?.('completed', 'Withdrawal complete!');
        callbacks.onComplete?.(intentId, finalStatus);
      } else if (finalStatus === 'FAILED') {
        callbacks.onError?.('Withdrawal failed. Please try again or contact support.');
      } else {
        callbacks.onError?.(`Withdrawal ended with unexpected status: ${finalStatus}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      callbacks.onError?.(
        `Unable to verify withdrawal status (${errMsg}). Please check your balances manually.`
      );
    }
  }

  private actionToPhase(action: WithdrawalAction): string {
    switch (action) {
      case 'WITHDRAW':
        return 'withdrawing';
      case 'BRIDGE':
        return 'bridging';
      default:
        return 'processing';
    }
  }

  private actionToDescription(action: WithdrawalNextActionResponse): string {
    switch (action.action) {
      case 'WITHDRAW':
        return 'Withdrawing funds from exchange...';
      case 'BRIDGE':
        return 'Bridging USDC to Base...';
      default:
        return 'Processing...';
    }
  }

  private actionToPhaseLabel(action: WithdrawalAction): string {
    switch (action) {
      case 'WITHDRAW':
        return 'Exchange withdrawal';
      case 'BRIDGE':
        return 'Bridge to Base';
      default:
        return action;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
