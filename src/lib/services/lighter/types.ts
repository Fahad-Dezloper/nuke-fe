/**
 * Lighter REST + trading types (FE-side).
 * Response shapes follow public API; relax with optional fields where upstream evolves.
 */

import { LighterMarginMode, LighterIsolatedMarginDirection } from './utils/tx-constants';

/** Result of L2 signing — passed to `sendTx` */
export interface SignedL2Tx {
  txType: number;
  /** JSON string or serialized payload exactly as Lighter expects */
  txInfo: string;
}

export interface SendTxRequest {
  tx_type: number;
  tx_info: string;
  /** Defaults to true on API if omitted */
  price_protection?: boolean;
}

export interface SendTxResponse {
  code?: number;
  message?: string;
  tx_hash?: string;
  /** Allow additional fields from API */
  [key: string]: unknown;
}

export interface NextNonceResponse {
  nonce?: number;
  next_nonce?: number;
  [key: string]: unknown;
}

export interface LighterSubAccount {
  index: number;
  /** Other fields exist on API; extend as needed */
  [key: string]: unknown;
}

export interface AccountsByL1Response {
  sub_accounts: LighterSubAccount[];
  [key: string]: unknown;
}

export interface OrderBookDetailRow {
  symbol?: string;
  market_id?: number;
  market_index?: number;
  market_type?: string;
  status?: string;
  /** Decimal scaling hints for integer sizes/prices */
  supported_size_decimals?: number;
  supported_price_decimals?: number;
  min_base_amount?: number;
  min_quote_amount?: number;
  [key: string]: unknown;
}

export interface OrderBookDetailsResponse {
  order_book_details?: OrderBookDetailRow[];
  [key: string]: unknown;
}

/** Structured inputs for signing (mapped to signer binary / WASM). */
export interface LighterCreateOrderSignParams {
  marketIndex: number;
  clientOrderIndex: number;
  baseAmount: bigint | number;
  price: bigint | number;
  isAsk: boolean;
  orderType: number;
  timeInForce: number;
  reduceOnly: boolean;
  orderExpiry: bigint | number;
  triggerPrice?: bigint | number;
  apiKeyIndex?: number;
  nonce?: number;
  skipNonce?: 0 | 1;
}

export interface LighterCancelOrderSignParams {
  marketIndex: number;
  orderIndex: number;
  apiKeyIndex?: number;
  nonce?: number;
  skipNonce?: 0 | 1;
}

export interface LighterUpdateLeverageSignParams {
  marketIndex: number;
  /** IM fraction used by low-level signer (`10_000 / leverage`) */
  initialMarginFraction: number;
  marginMode: number;
  apiKeyIndex?: number;
  nonce?: number;
  skipNonce?: 0 | 1;
}

export interface LighterUpdateMarginSignParams {
  marketIndex: number;
  /** USDC amount in exchange integer units — use order book / SDK scaling */
  usdcAmount: bigint | number;
  direction: number;
  apiKeyIndex?: number;
  nonce?: number;
  skipNonce?: 0 | 1;
}

/** High-level service inputs (human-ish); service converts to sign params + integers */
export interface LighterOpenPerpParams {
  marketIndex: number;
  clientOrderIndex: number;
  /** Integer size in venue base step (caller must scale using order book decimals) */
  baseAmount: bigint | number;
  /** Integer worst price for taker / limit price for maker */
  price: bigint | number;
  side: 'long' | 'short';
  orderType: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  timeInForce: 'ioc' | 'gtt' | 'alo';
  reduceOnly: boolean;
  orderExpiry: bigint | number;
  triggerPrice?: bigint | number;
  apiKeyIndex: number;
}

export interface LighterClosePerpParams {
  marketIndex: number;
  clientOrderIndex: number;
  baseAmount: bigint | number;
  /** Worst acceptable price for closing taker */
  price: bigint | number;
  side: 'long' | 'short';
  orderExpiry: bigint | number;
  apiKeyIndex: number;
}

export interface LighterUpdateLeverageParams {
  marketIndex: number;
  leverage: number;
  marginMode: (typeof LighterMarginMode)[keyof typeof LighterMarginMode];
  apiKeyIndex: number;
}

export interface LighterUpdateMarginParams {
  marketIndex: number;
  usdcAmount: bigint | number;
  direction: (typeof LighterIsolatedMarginDirection)[keyof typeof LighterIsolatedMarginDirection];
  apiKeyIndex: number;
}
