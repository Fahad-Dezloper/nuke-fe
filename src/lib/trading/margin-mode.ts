/**
 * Hedge / per-leg margin mode policy.
 * Isolated aligns Nuke panel margin × leverage with venue position margin.
 */

/** When false, venues use legacy cross-margin behavior (escape hatch). */
export function hedgeUsesIsolatedMargin(): boolean {
  const raw = process.env.NEXT_PUBLIC_HEDGE_ISOLATED_MARGIN;
  if (raw === 'false') return false;
  return true;
}

export function usdToUsdcMicros(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) return BigInt(0);
  return BigInt(Math.floor(usd * 1_000_000));
}
