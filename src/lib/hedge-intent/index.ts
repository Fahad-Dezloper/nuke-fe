/**
 * Hedge Intent Module
 *
 * Client-signed, backend-orchestrated saga for cross-chain hedged trading.
 *
 * Architecture:
 *   types.ts          → Domain & API types
 *   api.ts            → Backend API service
 *   action-executor.ts → Maps actions to existing handlers/adapters
 *   engine.ts          → Polling loop (saga runner)
 *   use-hedge-intent.ts → React hook with resumability
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  Exchange,
  ExchangeName,
  HedgePair,
  HedgeIntentStatus,
  HedgeLegStatus,
  HedgeAction,
  CreateHedgeIntentRequest,
  CreateHedgeIntentResponse,
  NextActionResponse,
  LegResultEntry,
  ActionResultRequest,
  ActionResultResponse,
  HedgeIntent,
  HedgeLeg,
  HedgeIntentDetail,
  BridgeActionParams,
  DepositActionParams,
  OpenPositionActionParams,
  ClosePositionActionParams,
  StepStatus,
  ExecutionPhase,
  SafetyExposureInfo,
} from './types';
export { ACTIVE_HEDGE_INTENT_KEY, ACTIVE_HEDGE_PAIR_KEY } from './types';

// ── API ──────────────────────────────────────────────────────────────────────
export { hedgeIntentApi } from './api';

// ── Executor ─────────────────────────────────────────────────────────────────
export { HedgeActionExecutor } from './action-executor';
export type { ExecutorContext, ActionResult } from './action-executor';

// ── Engine ───────────────────────────────────────────────────────────────────
export { HedgeIntentEngine } from './engine';
export type { EngineCallbacks } from './engine';

// ── Hook ─────────────────────────────────────────────────────────────────────
export { useHedgeIntent } from './use-hedge-intent';
export type { OpenHedgeParams, UseHedgeIntentReturn } from './use-hedge-intent';
