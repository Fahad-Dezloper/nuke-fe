/**
 * Withdrawal Intent Types
 *
 * TypeScript types matching the backend API contract for the
 * client-driven withdrawal state machine.
 *
 * See: WITHDRAWAL_FLOW.md
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/** Supported exchange identifiers for withdrawals (lowercase, used internally) */
export type WithdrawalExchange = 'hyperliquid' | 'pacifica' | 'lighter';

/** PascalCase exchange names — the backend expects this casing in request bodies */
export type WithdrawalExchangeName = 'Hyperliquid' | 'Pacifica' | 'Lighter';

const EXCHANGE_NAME_MAP: Record<WithdrawalExchange, WithdrawalExchangeName> = {
  hyperliquid: 'Hyperliquid',
  pacifica: 'Pacifica',
  lighter: 'Lighter',
};

export function toExchangeName(exchange: WithdrawalExchange): WithdrawalExchangeName {
  return EXCHANGE_NAME_MAP[exchange];
}

/** Withdrawal intent lifecycle status (owned by backend) */
export type WithdrawalStatus =
  | 'CREATED'
  | 'WITHDRAWING'
  | 'WITHDRAWN'
  | 'BRIDGING'
  | 'COMPLETED'
  | 'FAILED';

/** Actions the backend can instruct the client to execute */
export type WithdrawalAction = 'WITHDRAW' | 'BRIDGE' | 'WAIT' | 'NOOP';

/** Per-step status */
export type WithdrawalStepStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

// ─── API Request / Response Types ────────────────────────────────────────────

/** POST /withdraw-intents/create-intent — request body */
export interface CreateWithdrawalIntentRequest {
  exchange: WithdrawalExchangeName;
  amount_usd: number;
  recipient: string;
  destination_chain_id: number;
}

/** POST /withdraw-intents/create-intent — response */
export interface CreateWithdrawalIntentResponse {
  withdrawal_intent_id: string;
}

/** GET /withdraw-intents/{id}/next-action — response */
export interface WithdrawalNextActionResponse {
  action: WithdrawalAction;
  params: Record<string, unknown> | null;
}

/** POST /withdraw-intents/transaction — Hyperliquid request */
export interface WithdrawalTransactionRequestHL {
  amount: string;
}

/** POST /withdraw-intents/transaction — Pacifica request */
export interface WithdrawalTransactionRequestPacifica {
  signature: string;
  amount: string;
}

/** POST /withdraw-intents/transaction — enum-wrapped request body */
export type WithdrawalTransactionRequest =
  | { Hyperliquid: WithdrawalTransactionRequestHL }
  | { Pacifica: WithdrawalTransactionRequestPacifica };

/** POST /withdraw-intents/bridge — request body */
export interface WithdrawalBridgeRequest {
  originChainId: number;
  destinationChainId: number;
  amount: string;
  tradeType: 'EXACT_INPUT';
  usePermit: boolean;
  recipient: string;
}

/** POST /withdraw-intents/{id}/action-result — request body */
export interface WithdrawalActionResultRequest {
  action: WithdrawalAction;
  success: boolean;
  tx_hash?: string | null;
  error?: string | null;
}

/** POST /withdraw-intents/{id}/action-result — response */
export interface WithdrawalActionResultResponse {
  status: string;
  message: string;
}

// ─── Domain Types ────────────────────────────────────────────────────────────

/** Full withdrawal intent record */
export interface WithdrawalIntent {
  id: string;
  user_id: string;
  exchange: WithdrawalExchange;
  amount_usd: number;
  evm_address: string;
  recipient: string;
  destination_chain_id: number;
  status: WithdrawalStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Withdrawal step record */
export interface WithdrawalStep {
  step: 'WITHDRAW' | 'BRIDGE';
  status: WithdrawalStepStatus;
  tx_hash: string | null;
}

/** GET /withdraw-intents/{id} — response */
export interface WithdrawalIntentDetail {
  intent: WithdrawalIntent;
  steps: WithdrawalStep[];
}

// ─── Client-Side Types ───────────────────────────────────────────────────────

/** Execution phase for UI display */
export type WithdrawalPhase =
  | 'idle'
  | 'creating'
  | 'withdrawing'
  | 'bridging'
  | 'waiting'
  | 'completed'
  | 'failed';

/** LocalStorage key for active withdrawal intent */
export const ACTIVE_WITHDRAWAL_INTENT_KEY = 'active_withdrawal_intent_id';
