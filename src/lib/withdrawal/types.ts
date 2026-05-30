/**
 * Withdrawal types (client-orchestrated; mirrors useFundExchange).
 */

export type WithdrawalExchange = 'hyperliquid' | 'pacifica' | 'phoenix' | 'lighter';

export type WithdrawPhase =
  | 'idle'
  | 'withdrawing'
  | 'getting-quote'
  | 'signing'
  | 'bridging'
  | 'waiting-bridge'
  | 'completed'
  | 'failed';

export interface StartWithdrawalParams {
  exchange: WithdrawalExchange;
  amountUsd: number;
  /** Solana recipient; defaults to user's Solana wallet. */
  recipient?: string;
}
