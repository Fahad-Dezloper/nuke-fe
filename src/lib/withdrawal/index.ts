/**
 * Withdrawal Module
 *
 * Client-driven, backend-orchestrated withdrawal flow.
 *
 * Architecture:
 *   types.ts            → Domain & API types
 *   api.ts              → Backend API service
 *   action-executor.ts  → Maps actions to signing & submission logic
 *   engine.ts           → Polling loop (saga runner)
 *   use-withdrawal.ts   → React hook with resumability
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  WithdrawalExchange,
  WithdrawalStatus,
  WithdrawalAction,
  WithdrawalStepStatus,
  CreateWithdrawalIntentRequest,
  CreateWithdrawalIntentResponse,
  WithdrawalNextActionResponse,
  WithdrawalTransactionRequestHL,
  WithdrawalTransactionRequestPacifica,
  WithdrawalBridgeRequest,
  WithdrawalActionResultRequest,
  WithdrawalActionResultResponse,
  WithdrawalIntent,
  WithdrawalStep,
  WithdrawalIntentDetail,
  WithdrawalPhase,
} from './types';
export { ACTIVE_WITHDRAWAL_INTENT_KEY } from './types';

// ── API ──────────────────────────────────────────────────────────────────────
export { withdrawalApi } from './api';

// ── Executor ─────────────────────────────────────────────────────────────────
export { WithdrawalActionExecutor } from './action-executor';
export type { ExecutorContext, ActionResult } from './action-executor';

// ── Engine ───────────────────────────────────────────────────────────────────
export { WithdrawalEngine } from './engine';
export type { EngineCallbacks } from './engine';

// ── Hook ─────────────────────────────────────────────────────────────────────
export { useWithdrawal } from './use-withdrawal';
export type { StartWithdrawalParams, UseWithdrawalReturn } from './use-withdrawal';
