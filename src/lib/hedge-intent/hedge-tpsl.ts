/**
 * Mirrored hedge TP/SL — Pacifica mark + tick as source of truth (same as bot orchestrator).
 *
 * Long TP @ upper = Short SL @ upper; Long SL @ lower = Short TP @ lower.
 */

import { fetchPacificaMarkPrice } from '@/dex/pacifica/utils/prices';
import { getAssetMeta } from '@/dex/pacifica/utils/get-meta';
import { roundPrice, roundPriceUp } from '@/dex/pacifica/utils/rounding';

export const HEDGE_TPSL_THRESHOLD_LEVERAGE_FACTOR = 180;
export const HEDGE_TPSL_MIN_THRESHOLD_PERCENT = 2.5;
export const HEDGE_TPSL_MAX_THRESHOLD_PERCENT = 30;
export const HEDGE_TPSL_LIMIT_OFFSET_PERCENT = 0;

export interface HedgeLegTpslPrices {
  takeProfitPrice: string;
  stopLossPrice: string;
  takeProfitLimitPrice?: string;
  stopLossLimitPrice?: string;
  /** Canonical snapped bands (identical on HL + Pacifica). */
  upperStop: string;
  lowerStop: string;
}

export interface MirroredTpSlPlan {
  markPrice: number;
  thresholdPercent: number;
  upperStop: string;
  lowerStop: string;
  long: HedgeLegTpslPrices;
  short: HedgeLegTpslPrices;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `thresholdPercent = clamp(30 / leverage, 2.5, 18)` */
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
 * Build one mirrored TP/SL plan from Pacifica mark + tick (ceil upper, floor lower).
 * HL and Pacifica both use the same `upperStop` / `lowerStop` strings from this plan.
 */
export async function buildMirroredTpSlPlan(
  symbol: string,
  leverage: number
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

  const thresholdPercent = computeHedgeTpslThresholdPercent(leverage);
  const pct = thresholdPercent / 100;
  const rawUpper = mark * (1 + pct);
  const rawLower = mark * (1 - pct);

  const upperStop = await roundPriceUp(rawUpper, sym);
  const lowerStop = await roundPrice(rawLower, sym);

  const long = legPrices('long', upperStop, lowerStop, HEDGE_TPSL_LIMIT_OFFSET_PERCENT);
  const short = legPrices('short', upperStop, lowerStop, HEDGE_TPSL_LIMIT_OFFSET_PERCENT);

  return {
    markPrice: mark,
    thresholdPercent,
    upperStop,
    lowerStop,
    long,
    short,
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
