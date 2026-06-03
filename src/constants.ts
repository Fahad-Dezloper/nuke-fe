export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nuketrade-service-dev-production.up.railway.app';
export const HYPERLIQUID_ROUTER_CONTRACT = '0x377a90f0c3D1CfFc93815a5d4F6E705e047d6F04';

/**
 * @deprecated Legacy Arbitrum spender; `POST /lighter/deposit` uses Ethereum mainnet — see `LIGHTER_ETH_DEPOSIT_CONTRACT`.
 */
export const LIGHTER_ARB_USDC_SPENDER =
  process.env.NEXT_PUBLIC_LIGHTER_ARB_USDC_SPENDER?.trim() || '';

/**
 * Lighter ZkLighter bridge on **Ethereum mainnet** (deposit destination on-chain).
 * EIP-2612 permit `spender` is the backend fee payer — fetch `GET /lighter/fee-payer`.
 */
export const LIGHTER_ETH_DEPOSIT_CONTRACT =
  process.env.NEXT_PUBLIC_LIGHTER_ETH_DEPOSIT_CONTRACT?.trim() ||
  '0x3B4D794a66304F130a4Db8F2551B0070dfCf5ca7';
/** @deprecated Use {@link MIN_ADD_MARGIN_USD} for Add margin UI and `useFundExchange`. */
export const MIN_FUND_AMOUNT = 12;

/** Minimum USD for Add margin (covers bridge fees/slippage so ≥$10 lands on destination). */
export const MIN_ADD_MARGIN_USD = 11;

/** Minimum USDC for direct Solana → Pacifica/Phoenix add-margin deposits (6 decimals). */
export const SOLANA_DIRECT_MIN_DEPOSIT_MICROS = 1_000_000; // $1 — allows small adds e.g. $5

// pacifica service
export const EXPIRY_WINDOW = 300000;
export const BUILDER_CODE = 'NUKETRADE';
/** Pacifica referral code for points / referee attribution (same string as builder code). */
export const REFERRAL_CODE = 'NUKETRADE';
export const BUILDER_MAX_FEE_RATE = '0.1';