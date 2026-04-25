/**
 * L2 transaction and order constants (aligned with Lighter docs / lighter-go `constants.go`).
 * `tx_info` payloads are produced by the native signer; these IDs are what you pass to `sendTx`.
 */

/** `tx_type` sent to `POST /api/v1/sendTx` */
export const LighterTxType = {
  L2ChangePubKey: 8,
  L2CreateSubAccount: 9,
  L2CreatePublicPool: 10,
  L2UpdatePublicPool: 11,
  L2Transfer: 12,
  L2Withdraw: 13,
  L2CreateOrder: 14,
  L2CancelOrder: 15,
  L2CancelAllOrders: 16,
  L2ModifyOrder: 17,
  L2MintShares: 18,
  L2BurnShares: 19,
  L2UpdateLeverage: 20,
  L2CreateGroupedOrders: 28,
  L2UpdateMargin: 29,
} as const;

export type LighterTxTypeKey = keyof typeof LighterTxType;
export type LighterTxTypeValue = (typeof LighterTxType)[LighterTxTypeKey];

export const LighterOrderType = {
  LIMIT: 0,
  MARKET: 1,
  STOP_LOSS: 2,
  STOP_LOSS_LIMIT: 3,
  TAKE_PROFIT: 4,
  TAKE_PROFIT_LIMIT: 5,
  TWAP: 6,
} as const;

export const LighterTimeInForce = {
  IMMEDIATE_OR_CANCEL: 0,
  GOOD_TILL_TIME: 1,
  POST_ONLY: 2,
} as const;

/** Cross / isolated margin for `update_leverage` / signer */
export const LighterMarginMode = {
  CROSS: 0,
  ISOLATED: 1,
} as const;

/** `update_margin` direction (isolated collateral add/remove) */
export const LighterIsolatedMarginDirection = {
  REMOVE_COLLATERAL: 0,
  ADD_COLLATERAL: 1,
} as const;

/**
 * Lighter HTTP `sign_update_leverage` uses `fraction` where `fraction = 10_000 / leverage`
 * (per official Python SDK comments). High-level `update_leverage` may take human leverage instead.
 */
export function leverageToMarginFraction(leverage: number): number {
  if (!Number.isFinite(leverage) || leverage <= 0) {
    throw new RangeError('leverage must be a positive finite number');
  }
  return Math.round(10_000 / leverage);
}
