/**
 * Mirrored hedge TP/SL — Pacifica mark + tick as source of truth.
 *
 * Long TP @ upper = Short SL @ upper; Long SL @ lower = Short TP @ lower.
 *
 * Band width follows estimated liquidation distance (margin × leverage → size, per venue):
 * high leverage → liquidation close → tight stops; low leverage → far liquidation → wider stops.
 * Applied width = min(orchestrator target, liquidation-safe cap) so SL always fires before liq.
 */

import { fetchPacificaMarkPrice } from '@/dex/pacifica/utils/prices';
import { getAssetMeta } from '@/dex/pacifica/utils/get-meta';
import { roundPrice, roundPriceUp } from '@/dex/pacifica/utils/rounding';
import {
  computeAppliedMirroredBandPercent,
  computeMirroredBandPercentFromLiquidation,
  estimateLegLiquidationPrices,
  HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT,
} from './hedge-liquidation-estimate';

export const HEDGE_TPSL_THRESHOLD_LEVERAGE_FACTOR = 180;
export const HEDGE_TPSL_MIN_THRESHOLD_PERCENT = 2.5;
export const HEDGE_TPSL_MAX_THRESHOLD_PERCENT = 30;
export const HEDGE_TPSL_LIMIT_OFFSET_PERCENT = 0;

export { HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT };

export interface HedgeLegTpslPrices {
  takeProfitPrice: string;
  stopLossPrice: string;
  takeProfitLimitPrice?: string;
  stopLossLimitPrice?: string;
  /** Canonical snapped bands (identical on HL + Pacifica). */
  upperStop: string;
  lowerStop: string;
}

export interface MirroredTpSlLiquidationClamp {
  longLiquidationPrice: number;
  shortLiquidationPrice: number;
  longExchange: string;
  shortExchange: string;
  marginUsd: number;
  positionSize: number;
  longAdverseMovePercent: number;
  shortAdverseMovePercent: number;
  pMaxLong: number;
  pMaxShort: number;
  pSafe: number;
  bufferPercent: number;
}

export interface BuildMirroredTpSlPlanOptions {
  longExchange?: string;
  shortExchange?: string;
  /** Per-leg isolated margin USD (same on both legs for delta-neutral open). */
  marginUsd?: number;
  liquidationBufferPercent?: number;
}

export interface MirroredTpSlPlan {
  markPrice: number;
  /** Target band from `180 / leverage` (before liq clamp). */
  thresholdPercentDesired: number;
  /** Applied symmetric half-width (%). */
  thresholdPercent: number;
  upperStop: string;
  lowerStop: string;
  long: HedgeLegTpslPrices;
  short: HedgeLegTpslPrices;
  liquidationClamp?: MirroredTpSlLiquidationClamp;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `thresholdPercent = clamp(180 / leverage, 2.5, 30)` */
export function computeHedgeTpslThresholdPercent(leverage: number): number {
  const lev = Number(leverage);
  if (!Number.isFinite(lev) || lev <= 0) {
    return HEDGE_TPSL_MAX_THRESHOLD_PERCENT;
  }
  const raw = HEDGE_TPSL_THRESHOLD_LEVERAGE_FACTOR / lev;
  return clamp(raw, HEDGE_TPSL_MIN_THRESHOLD_PERCENT, HEDGE_TPSL_MAX_THRESHOLD_PERCENT);
}

function applyLimitOffset(
  trigger: string,
  direction: 'long' | 'short',
  kind: 'tp' | 'sl',
  offsetPercent: number
): string {
  if (offsetPercent === 0) return trigger;
  const n = parseFloat(trigger);
  if (!Number.isFinite(n)) return trigger;
  const mult = offsetPercent / 100;
  if (direction === 'long') {
    return String(kind === 'tp' ? n * (1 - mult) : n * (1 - mult));
  }
  return String(kind === 'tp' ? n * (1 + mult) : n * (1 + mult));
}

function legPrices(
  direction: 'long' | 'short',
  upperStop: string,
  lowerStop: string,
  limitOffsetPercent: number
): HedgeLegTpslPrices {
  const takeProfitPrice = direction === 'long' ? upperStop : lowerStop;
  const stopLossPrice = direction === 'long' ? lowerStop : upperStop;

  return {
    takeProfitPrice,
    stopLossPrice,
    takeProfitLimitPrice: applyLimitOffset(takeProfitPrice, direction, 'tp', limitOffsetPercent),
    stopLossLimitPrice: applyLimitOffset(stopLossPrice, direction, 'sl', limitOffsetPercent),
    upperStop,
    lowerStop,
  };
}

/**
 * Build one mirrored TP/SL plan from Pacifica mark + tick.
 * Upper is floored to tick (short SL stays below liq); lower is ceiled (long SL stays above liq).
 */
export async function buildMirroredTpSlPlan(
  symbol: string,
  leverage: number,
  options?: BuildMirroredTpSlPlanOptions
): Promise<MirroredTpSlPlan | null> {
  const sym = symbol.toUpperCase();
  const mark = await fetchPacificaMarkPrice(sym);
  if (mark == null || mark <= 0) {
    console.warn(`[hedge-tpsl] No Pacifica mark for ${sym}`);
    return null;
  }

  const meta = await getAssetMeta(sym);
  if (!meta?.tick_size) {
    console.warn(`[hedge-tpsl] No Pacifica tick_size for ${sym}`);
    return null;
  }

  const thresholdPercentDesired = computeHedgeTpslThresholdPercent(leverage);
  const pDesired = thresholdPercentDesired / 100;
  let pct = pDesired;
  let liquidationClamp: MirroredTpSlLiquidationClamp | undefined;

  const longExchange = options?.longExchange?.trim();
  const shortExchange = options?.shortExchange?.trim();
  const marginUsd = options?.marginUsd;
  const bufferPercent =
    options?.liquidationBufferPercent ?? HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT;

  if (!longExchange || !shortExchange) {
    console.warn(`[hedge-tpsl] Missing long/short exchange for ${sym}; cannot guarantee anti-liquidation band`);
    return null;
  }

  if (marginUsd == null || !Number.isFinite(marginUsd) || marginUsd <= 0) {
    console.warn(`[hedge-tpsl] Missing marginUsd for ${sym}; cannot estimate liquidation distance`);
    return null;
  }

  const liqEstimates = await estimateLegLiquidationPrices({
    symbol: sym,
    markPrice: mark,
    marginUsd,
    leverage,
    longExchange,
    shortExchange,
  });

  if (!liqEstimates) {
    console.warn(`[hedge-tpsl] Could not estimate liquidation for ${sym} (margin=$${marginUsd}, ${leverage}x)`);
    return null;
  }

  const caps = computeMirroredBandPercentFromLiquidation({
    mark,
    longLiquidationPrice: liqEstimates.longLiquidationPrice,
    shortLiquidationPrice: liqEstimates.shortLiquidationPrice,
    bufferPercent,
  });

  if (!caps || caps.pSafe <= 0) {
    console.warn(
      `[hedge-tpsl] Mirrored band infeasible for ${sym} at ${leverage}x margin=$${marginUsd}: ` +
        `longLiq=${liqEstimates.longLiquidationPrice} shortLiq=${liqEstimates.shortLiquidationPrice} ` +
        `mark=${mark} pSafe=${caps?.pSafe ?? 'n/a'}`
    );
    return null;
  }

  pct = computeAppliedMirroredBandPercent({
    leverage,
    pSafe: caps.pSafe,
    pDesired,
  });

  liquidationClamp = {
    longLiquidationPrice: liqEstimates.longLiquidationPrice,
    shortLiquidationPrice: liqEstimates.shortLiquidationPrice,
    longExchange,
    shortExchange,
    marginUsd,
    positionSize: liqEstimates.positionSize,
    longAdverseMovePercent: liqEstimates.longAdverseMovePercent,
    shortAdverseMovePercent: liqEstimates.shortAdverseMovePercent,
    pMaxLong: caps.pMaxLong,
    pMaxShort: caps.pMaxShort,
    pSafe: caps.pSafe,
    bufferPercent,
  };

  if (pct < pDesired) {
    console.log(
      `[hedge-tpsl] ${sym} ${leverage}x margin=$${marginUsd.toFixed(2)}: ` +
        `band ${(pct * 100).toFixed(2)}% (liq-limited, target ${thresholdPercentDesired}%) ` +
        `long liq −${liqEstimates.longAdverseMovePercent.toFixed(2)}%@${longExchange} ` +
        `short liq +${liqEstimates.shortAdverseMovePercent.toFixed(2)}%@${shortExchange}`
    );
  }

  const rawUpper = mark * (1 + pct);
  const rawLower = mark * (1 - pct);

  const upperStop = await roundPrice(rawUpper, sym);
  const lowerStop = await roundPriceUp(rawLower, sym);

  const long = legPrices('long', upperStop, lowerStop, HEDGE_TPSL_LIMIT_OFFSET_PERCENT);
  const short = legPrices('short', upperStop, lowerStop, HEDGE_TPSL_LIMIT_OFFSET_PERCENT);

  const thresholdPercent = pct * 100;

  return {
    markPrice: mark,
    thresholdPercentDesired,
    thresholdPercent,
    upperStop,
    lowerStop,
    long,
    short,
    liquidationClamp,
  };
}

export interface BuildMirroredTpSlPlanFromStopsOptions extends BuildMirroredTpSlPlanOptions {
  lowerStopPrice: number;
  upperStopPrice: number;
}

/**
 * Build mirrored TP/SL from user-selected lower / upper stops (position panel exit range).
 */
export async function buildMirroredTpSlPlanFromStops(
  symbol: string,
  leverage: number,
  options: BuildMirroredTpSlPlanFromStopsOptions
): Promise<MirroredTpSlPlan | null> {
  const sym = symbol.toUpperCase();
  const { lowerStopPrice, upperStopPrice } = options;

  if (
    !Number.isFinite(lowerStopPrice) ||
    !Number.isFinite(upperStopPrice) ||
    lowerStopPrice <= 0 ||
    upperStopPrice <= 0 ||
    lowerStopPrice >= upperStopPrice
  ) {
    console.warn(`[hedge-tpsl] Invalid user stops for ${sym}`);
    return null;
  }

  const mark = await fetchPacificaMarkPrice(sym);
  if (mark == null || mark <= 0) {
    console.warn(`[hedge-tpsl] No Pacifica mark for ${sym}`);
    return null;
  }

  if (lowerStopPrice >= mark || upperStopPrice <= mark) {
    console.warn(`[hedge-tpsl] User stops must bracket mark for ${sym}`);
    return null;
  }

  const meta = await getAssetMeta(sym);
  if (!meta?.tick_size) {
    console.warn(`[hedge-tpsl] No Pacifica tick_size for ${sym}`);
    return null;
  }

  const thresholdPercentDesired = computeHedgeTpslThresholdPercent(leverage);
  const upperStop = await roundPrice(upperStopPrice, sym);
  const lowerStop = await roundPriceUp(lowerStopPrice, sym);

  const upperN = parseFloat(upperStop);
  const lowerN = parseFloat(lowerStop);
  if (!Number.isFinite(upperN) || !Number.isFinite(lowerN) || lowerN >= mark || upperN <= mark) {
    console.warn(`[hedge-tpsl] Tick-rounded stops invalid for ${sym}`);
    return null;
  }

  const pctLower = (mark - lowerN) / mark;
  const pctUpper = (upperN - mark) / mark;
  const thresholdPercent = Math.max(pctLower, pctUpper) * 100;

  const long = legPrices('long', upperStop, lowerStop, HEDGE_TPSL_LIMIT_OFFSET_PERCENT);
  const short = legPrices('short', upperStop, lowerStop, HEDGE_TPSL_LIMIT_OFFSET_PERCENT);

  let liquidationClamp: MirroredTpSlLiquidationClamp | undefined;
  const longExchange = options.longExchange?.trim();
  const shortExchange = options.shortExchange?.trim();
  const marginUsd = options.marginUsd;

  if (longExchange && shortExchange && marginUsd != null && marginUsd > 0) {
    const liqEstimates = await estimateLegLiquidationPrices({
      symbol: sym,
      markPrice: mark,
      marginUsd,
      leverage,
      longExchange,
      shortExchange,
    });
    if (liqEstimates) {
      const bufferPercent =
        options.liquidationBufferPercent ?? HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT;
      const caps = computeMirroredBandPercentFromLiquidation({
        mark,
        longLiquidationPrice: liqEstimates.longLiquidationPrice,
        shortLiquidationPrice: liqEstimates.shortLiquidationPrice,
        bufferPercent,
      });
      if (caps) {
        liquidationClamp = {
          longLiquidationPrice: liqEstimates.longLiquidationPrice,
          shortLiquidationPrice: liqEstimates.shortLiquidationPrice,
          longExchange,
          shortExchange,
          marginUsd,
          positionSize: liqEstimates.positionSize,
          longAdverseMovePercent: liqEstimates.longAdverseMovePercent,
          shortAdverseMovePercent: liqEstimates.shortAdverseMovePercent,
          pMaxLong: caps.pMaxLong,
          pMaxShort: caps.pMaxShort,
          pSafe: caps.pSafe,
          bufferPercent,
        };
      }
    }
  }

  return {
    markPrice: mark,
    thresholdPercentDesired,
    thresholdPercent,
    upperStop,
    lowerStop,
    long,
    short,
    liquidationClamp,
  };
}

/** Pacifica create_market_order: semantic TP/SL per side (no field swap). */
/** Phoenix `place-isolated-market-order` bracket config (USD trigger/execution prices). */
export function mapHedgeTpslToPhoenixIsolatedIx(
  tpsl: HedgeLegTpslPrices,
  numBaseLots?: bigint | number
): {
  takeProfitTriggerPrice: number;
  stopLossTriggerPrice: number;
  takeProfitExecutionPrice: number;
  stopLossExecutionPrice: number;
  numBaseLots?: number;
} {
  const tpTrigger = Number.parseFloat(tpsl.takeProfitPrice);
  const slTrigger = Number.parseFloat(tpsl.stopLossPrice);
  const tpExec = Number.parseFloat(tpsl.takeProfitLimitPrice ?? tpsl.takeProfitPrice);
  const slExec = Number.parseFloat(tpsl.stopLossLimitPrice ?? tpsl.stopLossPrice);

  const out: {
    takeProfitTriggerPrice: number;
    stopLossTriggerPrice: number;
    takeProfitExecutionPrice: number;
    stopLossExecutionPrice: number;
    numBaseLots?: number;
  } = {
    takeProfitTriggerPrice: tpTrigger,
    stopLossTriggerPrice: slTrigger,
    takeProfitExecutionPrice: tpExec,
    stopLossExecutionPrice: slExec,
  };

  if (numBaseLots != null) {
    out.numBaseLots = Number(numBaseLots);
  }

  return out;
}

export function mapHedgeTpslToPacificaCreateOrder(tpsl: HedgeLegTpslPrices): {
  take_profit: { stop_price: string; limit_price: string };
  stop_loss: { stop_price: string; limit_price: string };
} {
  const tpLimit = tpsl.takeProfitLimitPrice ?? tpsl.takeProfitPrice;
  const slLimit = tpsl.stopLossLimitPrice ?? tpsl.stopLossPrice;
  return {
    take_profit: {
      stop_price: tpsl.takeProfitPrice,
      limit_price: tpLimit,
    },
    stop_loss: {
      stop_price: tpsl.stopLossPrice,
      limit_price: slLimit,
    },
  };
}
