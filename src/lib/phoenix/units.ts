/** USDC on Solana / Phoenix Rise uses 6 decimal places (base units = micros). */
export const USDC_MICROS_PER_USD = 1_000_000;

/**
 * Rise trader snapshot `subaccount.collateral` is USDC base units (same scale as `buildDepositIxs` `amount`).
 */
export function phoenixCollateralToUsd(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  try {
    const micros = BigInt(trimmed);
    return Number(micros) / USDC_MICROS_PER_USD;
  } catch {
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return NaN;
    return parsed / USDC_MICROS_PER_USD;
  }
}
