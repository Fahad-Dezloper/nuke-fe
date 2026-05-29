/**
 * Mirrored exit range — UI helpers for user-selected TP/SL on the position panel.
 */

import {
  computeAppliedMirroredBandPercent,
  computeMirroredBandPercentFromLiquidation,
  estimateIsolatedLiquidationPriceForExchange,
  hedgePositionSizeFromMargin,
  HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT,
} from './hedge-liquidation-estimate';
import { computeHedgeTpslThresholdPercent } from './hedge-tpsl';

export const HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT = 1;
export const HEDGE_EXIT_RANGE_SLIDER_STEPS = 1000;

export interface HedgeExitRangeStops {
  lowerPrice: number;
  upperPrice: number;
}

export interface HedgeExitRangeContext {
  markPrice: number;
  perLegMarginUsd: number;
  leverage: number;
  longExchange: string;
  shortExchange: string;
  longLiqPrice: number | null;
  shortLiqPrice: number | null;
  longLiqValid: boolean;
  shortLiqValid: boolean;
  /** Slider / bar domain */
  barMin: number;
  barMax: number;
  /** Long SL must stay above this (when long liq known) */
  minLowerStop: number;
  /** Short SL (upper stop) must stay below this */
  maxUpperStop: number;
  defaultStops: HedgeExitRangeStops;
  desiredBandPercent: number;
}

export interface ExitRangeValidation {
  isValid: boolean;
  error: string | null;
  lowerOk: boolean;
  upperOk: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Treat ~0 long liq at 1x as “no practical lower bound”. */
export function isDegenerateLongLiquidation(
  mark: number,
  longLiq: number | null | undefined
): boolean {
  if (longLiq == null || !Number.isFinite(longLiq) || longLiq <= 0) return true;
  return longLiq < mark * 0.01;
}

export function computeHedgeExitRangeContext(params: {
  markPrice: number;
  totalMarginUsd: number;
  leverage: number;
  longExchange: string;
  shortExchange: string;
  longMaxLeverage: number;
  shortMaxLeverage: number;
  bufferPercent?: number;
}): HedgeExitRangeContext | null {
  const {
    markPrice: mark,
    totalMarginUsd,
    leverage,
    longExchange,
    shortExchange,
    longMaxLeverage,
    shortMaxLeverage,
  } = params;
  const bufferPercent = params.bufferPercent ?? HEDGE_TPSL_LIQUIDATION_BUFFER_PERCENT;

  if (!Number.isFinite(mark) || mark <= 0) return null;
  if (!Number.isFinite(totalMarginUsd) || totalMarginUsd <= 0) return null;
  if (!Number.isFinite(leverage) || leverage < 1) return null;

  const perLegMarginUsd = totalMarginUsd / 2;
  const positionSize = hedgePositionSizeFromMargin({
    marginUsd: perLegMarginUsd,
    leverage,
    markPrice: mark,
  });
  if (positionSize == null) return null;

  const base = {
    markPrice: mark,
    marginUsd: perLegMarginUsd,
    positionSize,
    leverage,
  };

  const rawLongLiq = estimateIsolatedLiquidationPriceForExchange({
    ...base,
    exchange: longExchange,
    maxLeverage: longMaxLeverage,
    side: 'long',
  });
  const rawShortLiq = estimateIsolatedLiquidationPriceForExchange({
    ...base,
    exchange: shortExchange,
    maxLeverage: shortMaxLeverage,
    side: 'short',
  });

  const longLiqValid = !isDegenerateLongLiquidation(mark, rawLongLiq);
  const shortLiqValid = rawShortLiq != null && Number.isFinite(rawShortLiq) && rawShortLiq > mark;

  const longLiqPrice = longLiqValid && rawLongLiq != null ? rawLongLiq : null;
  const shortLiqPrice = shortLiqValid && rawShortLiq != null ? rawShortLiq : null;

  const buffer = bufferPercent / 100;
  const minLowerStop = longLiqPrice != null ? longLiqPrice * (1 + buffer) : mark * 0.05;
  const maxUpperStop =
    shortLiqPrice != null ? shortLiqPrice * (1 - buffer) : mark * (1 + HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);

  const desiredBandPercent = computeHedgeTpslThresholdPercent(leverage);
  const pDesired = desiredBandPercent / 100;

  let halfWidth = pDesired;

  if (longLiqPrice != null && shortLiqPrice != null) {
    const caps = computeMirroredBandPercentFromLiquidation({
      mark,
      longLiquidationPrice: longLiqPrice,
      shortLiquidationPrice: shortLiqPrice,
      bufferPercent,
    });
    if (caps && caps.pSafe > 0) {
      halfWidth = computeAppliedMirroredBandPercent({
        leverage,
        pSafe: caps.pSafe,
        pDesired,
      });
    }
  } else if (shortLiqPrice != null) {
    const pMaxShort = (shortLiqPrice * (1 - buffer)) / mark - 1;
    if (Number.isFinite(pMaxShort) && pMaxShort > 0) {
      halfWidth = Math.min(pDesired, pMaxShort);
    }
  }

  halfWidth = Math.max(halfWidth, HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);

  let defaultLower = mark * (1 - halfWidth);
  let defaultUpper = mark * (1 + halfWidth);

  defaultLower = clamp(defaultLower, minLowerStop + mark * 0.001, mark * 0.999);
  defaultUpper = clamp(defaultUpper, mark * 1.001, maxUpperStop - mark * 0.001);

  if (defaultLower >= mark * 0.999) {
    defaultLower = mark * (1 - HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);
  }
  if (defaultUpper <= mark * 1.001) {
    defaultUpper = mark * (1 + HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);
  }

  const liqLow = longLiqPrice ?? mark * 0.5;
  const liqHigh = shortLiqPrice ?? mark * 1.5;
  const barMin = Math.max(0, Math.min(minLowerStop * 0.92, liqLow * 0.95, defaultLower * 0.95, mark * 0.5));
  const barMax = Math.max(
    mark * 1.02,
    liqHigh * 1.05,
    maxUpperStop * 1.02,
    defaultUpper * 1.05
  );

  if (barMax <= barMin) return null;

  return {
    markPrice: mark,
    perLegMarginUsd,
    leverage,
    longExchange,
    shortExchange,
    longLiqPrice,
    shortLiqPrice,
    longLiqValid,
    shortLiqValid,
    barMin,
    barMax,
    minLowerStop,
    maxUpperStop,
    defaultStops: { lowerPrice: defaultLower, upperPrice: defaultUpper },
    desiredBandPercent,
  };
}

export function priceToSliderStep(
  price: number,
  barMin: number,
  barMax: number,
  steps = HEDGE_EXIT_RANGE_SLIDER_STEPS
): number {
  if (barMax <= barMin) return 0;
  return Math.round(clamp((price - barMin) / (barMax - barMin), 0, 1) * steps);
}

export function sliderStepToPrice(
  step: number,
  barMin: number,
  barMax: number,
  steps = HEDGE_EXIT_RANGE_SLIDER_STEPS
): number {
  if (barMax <= barMin) return barMin;
  return barMin + (clamp(step, 0, steps) / steps) * (barMax - barMin);
}

export function validateExitRangeStops(
  stops: HedgeExitRangeStops,
  ctx: HedgeExitRangeContext
): ExitRangeValidation {
  const { lowerPrice, upperPrice } = stops;
  const { markPrice: mark, minLowerStop, maxUpperStop } = ctx;

  if (!Number.isFinite(lowerPrice) || !Number.isFinite(upperPrice)) {
    return { isValid: false, error: 'Set both exit prices.', lowerOk: false, upperOk: false };
  }

  if (lowerPrice >= mark) {
    return {
      isValid: false,
      error: 'Lower stop must be below mark.',
      lowerOk: false,
      upperOk: upperPrice < maxUpperStop,
    };
  }

  if (upperPrice <= mark) {
    return {
      isValid: false,
      error: 'Upper stop must be above mark.',
      lowerOk: lowerPrice > minLowerStop,
      upperOk: false,
    };
  }

  const minDist = mark * (HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);
  if (mark - lowerPrice < minDist) {
    return {
      isValid: false,
      error: `Lower stop must be at least ${HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT}% below mark.`,
      lowerOk: false,
      upperOk: upperPrice < maxUpperStop,
    };
  }

  if (upperPrice - mark < minDist) {
    return {
      isValid: false,
      error: `Upper stop must be at least ${HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT}% above mark.`,
      lowerOk: lowerPrice > minLowerStop,
      upperOk: false,
    };
  }

  const lowerOk = ctx.longLiqValid ? lowerPrice > minLowerStop : true;
  const upperOk = upperPrice < maxUpperStop;

  if (!lowerOk) {
    return {
      isValid: false,
      error: `Lower stop must stay above long liquidation (${ctx.longExchange}).`,
      lowerOk: false,
      upperOk,
    };
  }

  if (!upperOk) {
    return {
      isValid: false,
      error: `Upper stop must stay below short liquidation (${ctx.shortExchange}).`,
      lowerOk,
      upperOk: false,
    };
  }

  return { isValid: true, error: null, lowerOk, upperOk };
}

export function percentFromMark(price: number, mark: number): number {
  if (!Number.isFinite(mark) || mark <= 0) return 0;
  return ((price - mark) / mark) * 100;
}

export function formatExitPrice(price: number, mark: number): string {
  if (!Number.isFinite(price)) return '—';
  const abs = Math.abs(price);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 4 : 6;
  return price.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  });
}
