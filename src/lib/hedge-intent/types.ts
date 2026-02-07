/**
 * Hedge Intent Types
 *
 * TypeScript types matching the backend API contract for the
 * client-signed, backend-orchestrated hedge intent saga.
 *
 * See: docs/HEDGE_INTENT_FE_INTEGRATION.md
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/** Supported protocols */
export type Protocol = 'HL' | 'PACIFICA';

/** Destination chains per protocol */
export type Chain = 'ARB' | 'SOL';

/** Hedge intent lifecycle status (owned by backend) */
export type HedgeIntentStatus =
  | 'CREATED'
  | 'FUNDING'
  | 'READY'
  | 'OPENING'
  | 'ACTIVE'
  | 'FAILED'
  | 'CANCELLING'
  | 'CANCELLED';

/** Per-leg lifecycle status (owned by backend) */
export type HedgeLegStatus =
  | 'PENDING'
  | 'BRIDGE_IN_PROGRESS'
  | 'BRIDGE_CONFIRMED'
  | 'DEPOSIT_IN_PROGRESS'
  | 'FUNDED'
  | 'OPENING_POSITION'
  | 'ACTIVE'
  | 'FAILED'
  | 'CLOSING'
  | 'CLOSED';

/** Actions the backend can instruct the client to execute */
export type HedgeAction =
  | 'BRIDGE_BASE_TO_ARB'
  | 'BRIDGE_BASE_TO_SOL'
  | 'DEPOSIT_TO_HL'
  | 'DEPOSIT_TO_PACIFICA'
  | 'OPEN_HEDGE_POSITION'
  | 'CLOSE_POSITION'
  | 'WAIT'
  | 'NOOP';

// ─── API Request / Response Types ────────────────────────────────────────────

/** POST /hedge-intents — request body */
export interface CreateHedgeIntentRequest {
  user_id: string;
  asset: string;
  protocols: Protocol[];
  margin_usd: number;
  leverage: number;
  evm_address: string;
  solana_address: string;
}

/** POST /hedge-intents — response */
export interface CreateHedgeIntentResponse {
  hedge_intent_id: string;
}

/** GET /hedge-intents/{id}/next-action — response */
export interface NextActionResponse {
  action: HedgeAction;
  leg: Protocol | null;
  amount_usd: number | null;
  params: Record<string, unknown> | null;
}

/** Per-leg result for OPEN_HEDGE_POSITION action reports */
export interface LegResultEntry {
  protocol: Protocol;
  success: boolean;
  tx_hash: string | null;
  error: string | null;
}

/** POST /hedge-intents/{id}/action-result — request body */
export interface ActionResultRequest {
  action: HedgeAction;
  success: boolean;
  tx_hash: string | null;
  error: string | null;
  leg_results: LegResultEntry[] | null;
}

/** POST /hedge-intents/{id}/action-result — response */
export interface ActionResultResponse {
  status: string;
  message: string;
}

// ─── Domain Types ────────────────────────────────────────────────────────────

/** Full hedge intent record */
export interface HedgeIntent {
  id: string;
  user_id: string;
  asset: string;
  protocol_a: string;
  protocol_b: string;
  margin_usd: number;
  leverage: number;
  evm_address: string;
  solana_address: string;
  status: HedgeIntentStatus;
  created_at: string;
  updated_at: string;
}

/** Hedge leg record */
export interface HedgeLeg {
  id: string;
  hedge_intent_id: string;
  protocol: Protocol;
  chain: Chain;
  target_amount_usd: number;
  funded_amount_usd: number;
  status: HedgeLegStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /hedge-intents/{id} — response */
export interface HedgeIntentDetail {
  intent: HedgeIntent;
  legs: HedgeLeg[];
}

// ─── Bridge Action Params (from backend) ─────────────────────────────────────

/** Params shape for BRIDGE_BASE_TO_ARB / BRIDGE_BASE_TO_SOL */
export interface BridgeActionParams {
  origin_chain_id: number;
  destination_chain_id: number;
  origin_currency: string;
  destination_currency: string;
  user_address: string;
  recipient: string;
  leg_id: string;
}

/** Params shape for DEPOSIT_TO_HL / DEPOSIT_TO_PACIFICA */
export interface DepositActionParams {
  protocol: Protocol;
  chain: Chain;
  user_address: string;
  amount_usd: number;
  leg_id: string;
}

/** Params shape for OPEN_HEDGE_POSITION */
export interface OpenPositionActionParams {
  asset: string;
  leverage: number;
  effective_margin_usd: number;
  legs: Array<{
    protocol: Protocol;
    chain: Chain;
    funded_amount_usd: number;
  }>;
}

/** Params shape for CLOSE_POSITION */
export interface ClosePositionActionParams {
  asset: string;
  protocol: Protocol;
  chain: Chain;
  reason: string;
}

// ─── Client-Side Types ───────────────────────────────────────────────────────

/** UI-friendly step status */
export type StepStatus = 'pending' | 'in_progress' | 'done' | 'error';

/** Execution phase for UI display */
export type ExecutionPhase =
  | 'idle'
  | 'creating'
  | 'bridging'
  | 'depositing'
  | 'opening'
  | 'closing'
  | 'complete'
  | 'failed';

/** LocalStorage key for active hedge intent */
export const ACTIVE_HEDGE_INTENT_KEY = 'active_hedge_intent_id';
