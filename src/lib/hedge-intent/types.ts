/**
 * Hedge Intent Types
 *
 * TypeScript types matching the backend API contract for the
 * client-signed, backend-orchestrated hedge intent saga.
 *
 * See: docs/HEDGE_INTEGRATION.md
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Exchange identifiers (lowercase) — used in most API responses and leg results.
 */
export type Exchange = 'hyperliquid' | 'pacifica' | 'phoenix' | 'backpack' | 'lighter';

/**
 * Exchange names (PascalCase) — used ONLY in the create-intent request body.
 * The backend expects this exact casing in the `exchanges` array.
 */
export type ExchangeName = 'Hyperliquid' | 'Pacifica' | 'Phoenix' | 'Backpack' | 'Lighter';

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
  | 'BRIDGE_BASE_TO_ARB' // legacy
  | 'BRIDGE_BASE_TO_SOL' // legacy
  | 'BRIDGE_SOL_TO_ARB'
  /** Backend `PerpetualExchange::Lighter` bridge action (Solana → Ethereum for Lighter leg). */
  | 'BRIDGE_SOL_TO_ETH'
  /** Legacy / internal alias — treat like `BRIDGE_SOL_TO_ETH` when reporting `action-result`. */
  | 'BRIDGE_BASE_TO_LIGHTER'
  | 'DEPOSIT_TO_HYPERLIQUID'
  | 'DEPOSIT_TO_PACIFICA'
  | 'DEPOSIT_TO_PHOENIX'
  | 'DEPOSIT_TO_BACKPACK'
  | 'DEPOSIT_TO_LIGHTER'
  | 'OPEN_HEDGE_POSITION'
  | 'CLOSE_POSITION'
  | 'WAIT'
  | 'NOOP';

// ─── API Request / Response Types ────────────────────────────────────────────

/** POST /hedge-intents/ — request body */
export interface CreateHedgeIntentRequest {
  asset: string;
  exchanges: [ExchangeName, ExchangeName]; // Exactly 2 different exchanges
  margin_usd: number;
  leverage: number;
}

/** POST /hedge-intents/ — response */
export interface CreateHedgeIntentResponse {
  hedge_intent_id: string;
}

/** GET /hedge-intents/{id}/next-action — response */
export interface NextActionResponse {
  action: HedgeAction;
  leg: string | null; // Lowercase exchange name (e.g. "hyperliquid", "pacifica")
  amount_usd: number | null;
  params: Record<string, unknown> | null;
}

/** Per-leg result for OPEN_HEDGE_POSITION action reports */
export interface LegResultEntry {
  exchange: string; // Lowercase: "hyperliquid" | "pacifica" | "phoenix" | ...
  success: boolean;
  tx_hash: string | null;
  error: string | null;
}

/** POST /hedge-intents/{id}/action-result — request body */
export interface ActionResultRequest {
  action: HedgeAction;
  success: boolean;
  tx_hash?: string | null;
  error?: string | null;
  leg_results?: LegResultEntry[] | null;
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
  protocol_a: string; // Lowercase exchange name
  protocol_b: string; // Lowercase exchange name
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
  exchange: Exchange;
  chain: string; // Chain ID as string (e.g. "42161", "792703809")
  target_amount_usd: number;
  funded_amount_usd: number;
  status: HedgeLegStatus;
  retry_count: number;
  last_error: string | null;
  existing_margin_usd: number; // USDC already in exchange margin
  existing_onchain_usd: number; // USDC already on destination chain
  created_at: string;
  updated_at: string;
}

/** GET /hedge-intents/{id} — response */
export interface HedgeIntentDetail {
  intent: HedgeIntent;
  legs: HedgeLeg[];
}

// ─── Bridge Action Params (from backend) ─────────────────────────────────────

/** Params shape for bridge actions (origin now Solana per backend) */
export interface BridgeActionParams {
  origin_chain_id: number;
  destination_chain_id: number;
  origin_currency: string;
  destination_currency: string;
  user_address: string;
  recipient: string;
  leg_id: string;
  existing_margin_usd: number;
  existing_onchain_usd: number;
}

/** Params shape for DEPOSIT_TO_HYPERLIQUID / DEPOSIT_TO_PACIFICA / DEPOSIT_TO_PHOENIX / DEPOSIT_TO_BACKPACK / DEPOSIT_TO_LIGHTER */
export interface DepositActionParams {
  protocol: string; // Lowercase exchange name
  chain: number; // Chain ID (42161 or 792703809)
  user_address: string;
  amount_usd: number;
  leg_id: string;
  existing_margin_usd: number;
}

/** Params shape for OPEN_HEDGE_POSITION */
export interface OpenPositionActionParams {
  asset: string;
  leverage: number;
  effective_margin_usd: number;
  legs: Array<{
    exchange: Exchange;
    chain: number;
    funded_amount_usd: number;
  }>;
}

/** Params shape for CLOSE_POSITION */
export interface ClosePositionActionParams {
  asset: string;
  exchange: Exchange;
  chain: number;
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

/** LocalStorage key for long/short venues used when opening the active intent */
export const ACTIVE_HEDGE_PAIR_KEY = 'active_hedge_pair';

/** Long and short venues for a delta-neutral hedge (matches position panel best pair) */
export interface HedgePair {
  long: Exchange;
  short: Exchange;
}
