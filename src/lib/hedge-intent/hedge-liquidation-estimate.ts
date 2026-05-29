/**
 * Isolated liquidation estimates for mirrored hedge TP/SL.
 *
 * Liquidation depends on mark, position size, isolated margin, and venue max leverage.
 * TP/SL band width tracks that distance: tight at high leverage, wider at low leverage,
 * always staying inside liquidation (+ buffer) so SL fires before liq.
 *
 * Pacifica: https://pacifica.gitbook.io/docs/trading-on-pacifica/liquidations
 * Hyperliquid: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations
 */

import { getAssetMeta } from '@/dex/pacifica/utils/get-meta';
import { getPerpMeta } from '@/dex/hyperliquid/utils/get-meta';

export type HedgeLiqSide = 'long' | 'short';

/** Gap between SL trigger and estimated liquidation (percent of price). */
export const HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT = 2;

const DEFAULT_MAX_LEVERAGE = 50;

/** Coin size from margin × leverage at mark (delta-neutral hedge legs). */
export function hedgePositionSizeFromMargin(params: {
  marginUsd: number;
  leverage: number;
  markPrice: number;
}): number | null {
  const { marginUsd, leverage, markPrice } = params;
  if (
    !Number.isFinite(marginUsd) ||
    marginUsd <= 0 ||
    !Number.isFinite(leverage) ||
    leverage <= 0 ||
    !Number.isFinite(markPrice) ||
    markPrice <= 0
  ) {
    return null;
  }
  return (marginUsd * leverage) / markPrice;
}

/** Adverse move from mark to liquidation as a positive fraction (e.g. 0.04 = 4%). */
export function adverseMoveFractionToLiquidation(params: {
  mark: number;
  liquidationPrice: number;
  side: HedgeLiqSide;
}): number | null {
  const { mark, liquidationPrice, side } = params;
  if (!Number.isFinite(mark) || mark <= 0 || !Number.isFinite(liquidationPrice) || liquidationPrice <= 0) {
    return null;
  }

  const frac =
    side === 'long'
      ? (mark - liquidationPrice) / mark
      : (liquidationPrice - mark) / mark;

  return Number.isFinite(frac) && frac > 0 ? frac : null;
}

/**
 * Pacifica isolated liquidation.
 *
 * `liq = [price - (side * position_margin) / position_size] / (1 - side / max_leverage / 2)`
 */
export function estimatePacificaIsolatedLiquidationPrice(params: {
  markPrice: number;
  marginUsd: number;
  positionSize: number;
  maxLeverage: number;
  side: HedgeLiqSide;
}): number | null {
  const { markPrice: P, marginUsd, positionSize: S, maxLeverage: M, side } = params;
  if (
    !Number.isFinite(P) ||
    P <= 0 ||
    !Number.isFinite(marginUsd) ||
    marginUsd <= 0 ||
    !Number.isFinite(S) ||
    S <= 0 ||
    !Number.isFinite(M) ||
    M <= 0
  ) {
    return null;
  }

  const sideNum = side === 'long' ? 1 : -1;
  const marginPerUnit = marginUsd / S;
  const numerator = P - sideNum * marginPerUnit;
  const denominator = 1 - sideNum / (2 * M);

  if (denominator === 0) return null;

  const liq = numerator / denominator;
  return Number.isFinite(liq) && liq > 0 ? liq : null;
}

/**
 * Hyperliquid isolated liquidation at entry.
 *
 * `margin_available = isolated_margin - maintenance`, maintenance ≈ notional / (2 × maxLev).
 */
export function estimateHyperliquidIsolatedLiquidationPrice(params: {
  markPrice: number;
  marginUsd: number;
  positionSize: number;
  leverage: number;
  maxLeverage: number;
  side: HedgeLiqSide;
}): number | null {
  const { markPrice: P, marginUsd, positionSize: S, leverage: L, maxLeverage: M, side } = params;
  if (
    !Number.isFinite(P) ||
    P <= 0 ||
    !Number.isFinite(marginUsd) ||
    marginUsd <= 0 ||
    !Number.isFinite(S) ||
    S <= 0 ||
    !Number.isFinite(L) ||
    L <= 0 ||
    !Number.isFinite(M) ||
    M <= 0
  ) {
    return null;
  }

  const sideNum = side === 'long' ? 1 : -1;
  const l = 1 / (2 * M);
  const notional = marginUsd * L;
  const maintenanceMargin = notional / (2 * M);
  const marginAvailable = marginUsd - maintenanceMargin;
  const denominator = 1 - l * sideNum;

  if (denominator === 0 || marginAvailable <= 0) return null;

  const liq = P - (sideNum * marginAvailable) / S / denominator;
  return Number.isFinite(liq) && liq > 0 ? liq : null;
}

export function estimateIsolatedLiquidationPriceForExchange(params: {
  exchange: string;
  markPrice: number;
  marginUsd: number;
  positionSize: number;
  leverage: number;
  maxLeverage: number;
  side: HedgeLiqSide;
}): number | null {
  const ex = params.exchange.toLowerCase();
  if (ex === 'hyperliquid') {
    return estimateHyperliquidIsolatedLiquidationPrice(params);
  }
  return estimatePacificaIsolatedLiquidationPrice({
    markPrice: params.markPrice,
    marginUsd: params.marginUsd,
    positionSize: params.positionSize,
    maxLeverage: params.maxLeverage,
    side: params.side,
  });
}

export async function resolveMaxLeverageForExchange(
  symbol: string,
  exchange: string
): Promise<number> {
  const sym = symbol.toUpperCase();
  const ex = exchange.toLowerCase();

  try {
    if (ex === 'hyperliquid') {
      const meta = await getPerpMeta();
      const row = meta.find((m) => m.name.toUpperCase() === sym);
      return row?.maxLeverage ?? DEFAULT_MAX_LEVERAGE;
    }
    if (ex === 'pacifica' || ex === 'phoenix') {
      const meta = await getAssetMeta(sym);
      return meta?.max_leverage ?? 20;
    }
  } catch (err) {
    console.warn(`[hedge-liquidation] max leverage lookup failed for ${ex}/${sym}:`, err);
  }

  return ex === 'pacifica' ? 20 : DEFAULT_MAX_LEVERAGE;
}

export async function estimateLegLiquidationPrices(params: {
  symbol: string;
  markPrice: number;
  marginUsd: number;
  leverage: number;
  longExchange: string;
  shortExchange: string;
}): Promise<{
  longLiquidationPrice: number;
  shortLiquidationPrice: number;
  positionSize: number;
  longAdverseMovePercent: number;
  shortAdverseMovePercent: number;
} | null> {
  const { symbol, markPrice, marginUsd, leverage, longExchange, shortExchange } = params;

  const positionSize = hedgePositionSizeFromMargin({ marginUsd, leverage, markPrice });
  if (positionSize == null) return null;

  const [longMaxLev, shortMaxLev] = await Promise.all([
    resolveMaxLeverageForExchange(symbol, longExchange),
    resolveMaxLeverageForExchange(symbol, shortExchange),
  ]);

  const base = {
    markPrice,
    marginUsd,
    positionSize,
    leverage,
  };

  const longLiq = estimateIsolatedLiquidationPriceForExchange({
    ...base,
    exchange: longExchange,
    maxLeverage: longMaxLev,
    side: 'long',
  });

  const shortLiq = estimateIsolatedLiquidationPriceForExchange({
    ...base,
    exchange: shortExchange,
    maxLeverage: shortMaxLev,
    side: 'short',
  });

  if (longLiq == null || shortLiq == null) return null;

  const longMove = adverseMoveFractionToLiquidation({
    mark: markPrice,
    liquidationPrice: longLiq,
    side: 'long',
  });
  const shortMove = adverseMoveFractionToLiquidation({
    mark: markPrice,
    liquidationPrice: shortLiq,
    side: 'short',
  });

  if (longMove == null || shortMove == null) return null;

  return {
    longLiquidationPrice: longLiq,
    shortLiquidationPrice: shortLiq,
    positionSize,
    longAdverseMovePercent: longMove * 100,
    shortAdverseMovePercent: shortMove * 100,
  };
}

/**
 * Max symmetric mirrored half-width `p` so SL triggers stay inside liquidation.
 * Binding leg = smaller adverse room (high leverage → tighter band).
 */
export function computeMirroredBandPercentFromLiquidation(params: {
  mark: number;
  longLiquidationPrice: number;
  shortLiquidationPrice: number;
  bufferPercent?: number;
}): { pMaxLong: number; pMaxShort: number; pSafe: number } | null {
  const { mark, longLiquidationPrice, shortLiquidationPrice } = params;
  const buffer =
    (params.bufferPercent ?? HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT) / 100;

  if (!Number.isFinite(mark) || mark <= 0) return null;
  if (!Number.isFinite(longLiquidationPrice) || longLiquidationPrice <= 0) return null;
  if (!Number.isFinite(shortLiquidationPrice) || shortLiquidationPrice <= 0) return null;

  const pMaxLong = 1 - (longLiquidationPrice * (1 + buffer)) / mark;
  const pMaxShort = (shortLiquidationPrice * (1 - buffer)) / mark - 1;
  const pSafe = Math.min(pMaxLong, pMaxShort);

  if (!Number.isFinite(pSafe)) return null;

  return { pMaxLong, pMaxShort, pSafe };
}

/**
 * Applied mirrored band: liquidation-limited (never past liq), capped by orchestrator target.
 *
 * - High leverage → liq close → `pSafe` small → tight TP/SL.
 * - Low leverage → liq far → `pSafe` large → can use up to `pDesired` (180/leverage cap).
 */
export function computeAppliedMirroredBandPercent(params: {
  leverage: number;
  pSafe: number;
  pDesired: number;
}): number {
  const { pSafe, pDesired } = params;
  if (!Number.isFinite(pSafe) || pSafe <= 0) return 0;
  if (!Number.isFinite(pDesired) || pDesired <= 0) return pSafe;
  return Math.min(pDesired, pSafe);
}
