/**
 * Pre-flight validation for opening a hedged position.
 */

/** Minimum notional (margin × leverage) per venue leg in USD. */
export const MIN_VENUE_POSITION_NOTIONAL_USD = 10;

/** Minimum total margin × leverage (both legs split 50/50). */
export const MIN_TOTAL_NOTIONAL_USD = MIN_VENUE_POSITION_NOTIONAL_USD * 2;

/**
 * Minimum leverage so each leg's notional is at least $10:
 * (margin / 2) × leverage ≥ 10  ⇔  margin × leverage ≥ 20
 */
export function getMinLeverageForMargin(marginUsd: number): number {
  if (!Number.isFinite(marginUsd) || marginUsd <= 0) return 1;
  return Math.max(1, Math.ceil(MIN_TOTAL_NOTIONAL_USD / marginUsd));
}

export function isMinVenueNotionalMet(marginUsd: number, leverage: number): boolean {
  if (!Number.isFinite(marginUsd) || marginUsd <= 0) return false;
  if (!Number.isFinite(leverage) || leverage < 1) return false;
  return marginUsd * leverage >= MIN_TOTAL_NOTIONAL_USD;
}

export function minVenueNotionalError(marginUsd: number, leverage: number): string {
  const minLev = getMinLeverageForMargin(marginUsd);
  const perSide = marginUsd / 2;
  const currentNotional = perSide * leverage;
  return (
    `Each venue needs at least $${MIN_VENUE_POSITION_NOTIONAL_USD} position size ` +
    `($${perSide.toFixed(2)} margin × ${leverage}x = $${currentNotional.toFixed(2)}). ` +
    `Use ${minLev}x+ leverage or increase margin.`
  );
}

export function assetHasOpenHedge(symbol: string, openSymbols: readonly string[]): boolean {
  const normalized = symbol.replace(/-PERP$/i, '').toUpperCase();
  return openSymbols.some((s) => s.replace(/-PERP$/i, '').toUpperCase() === normalized);
}

export function existingPositionError(asset: string): string {
  return `You already have an open ${asset} hedge. Close it in the positions table before opening a new one.`;
}
