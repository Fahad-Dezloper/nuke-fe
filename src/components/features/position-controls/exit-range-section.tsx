'use client';

/**
 * Exit limits — optional dual-handle price band with liquidation markers.
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { DualRangeSlider } from '@/components/ui/dual-range-slider';
import {
  marginAtom,
  leverageAtom,
  hedgeExitRangeAtom,
  hedgeExitRangeEnabledAtom,
  hedgeExitRangeTouchedAtom,
  exitRangeValidationAtom,
} from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import {
  bestPairMetricAtom,
  selectedExchangesAtom,
  selectedVenuesList,
} from '@/lib/stores/arbitrage-table-filters.store';
import { getBestPair } from '@/hooks/use-best-pair';
import {
  computeHedgeExitRangeContext,
  formatExitPrice,
  percentFromMark,
  priceToSliderStep,
  sliderStepToPrice,
  HEDGE_EXIT_RANGE_SLIDER_STEPS,
  HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT,
} from '@/lib/hedge-intent/hedge-exit-range';

interface ExitRangeSectionProps {
  className?: string;
}

function priceToPct(price: number, barMin: number, barMax: number): number {
  if (barMax <= barMin) return 50;
  return ((price - barMin) / (barMax - barMin)) * 100;
}

function clampPct(p: number) {
  return Math.min(98, Math.max(2, p));
}

function LiqPriceMarker({
  pct,
  price,
  mark,
  align,
  title,
}: {
  pct: number;
  price: number;
  mark: number;
  align: 'left' | 'right';
  title?: string;
}) {
  const left = clampPct(pct);
  const label = `$${formatExitPrice(price, mark)}`;

  return (
    <div
      className="absolute bottom-0 flex flex-col items-center pointer-events-none"
      style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
      title={title}
    >
      <span
        className={cn(
          'mb-1 text-[9px] leading-none text-red-400/95 tabular-nums whitespace-nowrap',
          align === 'left' ? '-translate-x-1' : 'translate-x-1'
        )}
      >
        {label}
      </span>
      <div className="w-0.5 h-3 rounded-full bg-red-400/80" />
    </div>
  );
}

export function ExitRangeSection({ className }: ExitRangeSectionProps) {
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const [enabled, setEnabled] = useAtom(hedgeExitRangeEnabledAtom);
  const [exitRange, setExitRange] = useAtom(hedgeExitRangeAtom);
  const [touched, setTouched] = useAtom(hedgeExitRangeTouchedAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const spreadAprData = useAtomValue(spreadAprDataAtom);
  const overrides = useAtomValue(bestPairOverrideAtom);
  const selectedMap = useAtomValue(selectedExchangesAtom);
  const metric = useAtomValue(bestPairMetricAtom);

  const selectedList = useMemo(() => selectedVenuesList(selectedMap), [selectedMap]);

  const bestPair = useMemo(
    () =>
      getBestPair(
        selectedAsset,
        spreadAprData,
        selectedAsset ? (overrides[selectedAsset.asset] ?? null) : null,
        { selectedExchanges: selectedList, metric }
      ),
    [selectedAsset, spreadAprData, overrides, selectedList, metric]
  );

  const marginValue = parseFloat(margin) || 0;
  const mark =
    selectedAsset?.markPx ||
    selectedAsset?.protocols?.[bestPair.long]?.markPx ||
    selectedAsset?.hyperliquidMarkPx ||
    0;

  const longMax = selectedAsset?.protocols?.[bestPair.long]?.maxLeverage ?? 20;
  const shortMax = selectedAsset?.protocols?.[bestPair.short]?.maxLeverage ?? 20;

  const ctx = useMemo(() => {
    if (marginValue <= 0 || mark <= 0) return null;
    return computeHedgeExitRangeContext({
      markPrice: mark,
      totalMarginUsd: marginValue,
      leverage,
      longExchange: bestPair.long,
      shortExchange: bestPair.short,
      longMaxLeverage: longMax,
      shortMaxLeverage: shortMax,
    });
  }, [marginValue, mark, leverage, bestPair.long, bestPair.short, longMax, shortMax]);

  const settingsKey = ctx
    ? `${selectedAsset?.asset}-${marginValue}-${leverage}-${bestPair.long}-${bestPair.short}`
    : null;

  useEffect(() => {
    if (!enabled || !ctx || !settingsKey) return;
    if (touched === settingsKey) return;
    setExitRange(ctx.defaultStops);
  }, [enabled, ctx, settingsKey, touched, setExitRange]);

  const sliderDomain = useMemo(() => {
    if (!ctx) return null;
    let barMin = ctx.barMin;
    let barMax = ctx.barMax;
    if (exitRange) {
      barMin = Math.min(barMin, exitRange.lowerPrice * 0.95);
      barMax = Math.max(barMax, exitRange.upperPrice * 1.05, ctx.markPrice * 1.02);
    }
    const step = (barMax - barMin) / HEDGE_EXIT_RANGE_SLIDER_STEPS;
    return { min: barMin, max: barMax, step: Math.max(step, 1e-8) };
  }, [ctx, exitRange]);

  const sliderValue = useMemo((): [number, number] | null => {
    if (!exitRange || !sliderDomain) return null;
    const { min, max } = sliderDomain;
    return [
      sliderStepToPrice(priceToSliderStep(exitRange.lowerPrice, min, max), min, max),
      sliderStepToPrice(priceToSliderStep(exitRange.upperPrice, min, max), min, max),
    ];
  }, [exitRange, sliderDomain]);

  const markTouched = useCallback(() => {
    if (settingsKey) setTouched(settingsKey);
  }, [settingsKey, setTouched]);

  const handleSliderChange = useCallback(
    (next: [number, number]) => {
      if (!settingsKey) return;
      setExitRange({ lowerPrice: next[0], upperPrice: next[1] });
      markTouched();
    },
    [settingsKey, setExitRange, markTouched]
  );

  const handleLowerPriceCommit = useCallback(
    (price: number) => {
      if (!exitRange || !ctx || !settingsKey) return;
      const maxLower = ctx.markPrice * (1 - HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);
      const minLower = ctx.longLiqValid ? ctx.minLowerStop : (sliderDomain?.min ?? 0);
      const lowerPrice = Math.min(maxLower, Math.max(minLower, price));
      let upperPrice = exitRange.upperPrice;
      const minGap = (sliderDomain?.step ?? 0.0001) * 2;
      if (upperPrice <= lowerPrice + minGap) {
        upperPrice = Math.min(ctx.maxUpperStop, lowerPrice + minGap);
      }
      setExitRange({ lowerPrice, upperPrice });
      markTouched();
    },
    [exitRange, ctx, settingsKey, sliderDomain, setExitRange, markTouched]
  );

  const handleUpperPriceCommit = useCallback(
    (price: number) => {
      if (!exitRange || !ctx || !settingsKey) return;
      const minUpper = ctx.markPrice * (1 + HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);
      const maxUpper = ctx.maxUpperStop;
      const upperPrice = Math.max(minUpper, Math.min(maxUpper, price));
      let lowerPrice = exitRange.lowerPrice;
      const minGap = (sliderDomain?.step ?? 0.0001) * 2;
      const maxLower = ctx.markPrice * (1 - HEDGE_EXIT_RANGE_MIN_DISTANCE_PERCENT / 100);
      if (lowerPrice >= upperPrice - minGap) {
        lowerPrice = Math.max(
          ctx.longLiqValid ? ctx.minLowerStop : (sliderDomain?.min ?? 0),
          Math.min(maxLower, upperPrice - minGap)
        );
      }
      setExitRange({ lowerPrice, upperPrice });
      markTouched();
    },
    [exitRange, ctx, settingsKey, sliderDomain, setExitRange, markTouched]
  );

  const controlsReady = enabled && marginValue > 0 && ctx;

  const markPct =
    ctx && sliderDomain ? priceToPct(ctx.markPrice, sliderDomain.min, sliderDomain.max) : 50;
  const minLowerPct =
    ctx?.longLiqValid && sliderDomain
      ? priceToPct(ctx.minLowerStop, sliderDomain.min, sliderDomain.max)
      : null;
  const maxUpperPct =
    ctx?.shortLiqValid && sliderDomain
      ? priceToPct(ctx.maxUpperStop, sliderDomain.min, sliderDomain.max)
      : null;
  const lowerPct =
    exitRange && sliderDomain
      ? priceToPct(exitRange.lowerPrice, sliderDomain.min, sliderDomain.max)
      : null;
  const upperPct =
    exitRange && sliderDomain
      ? priceToPct(exitRange.upperPrice, sliderDomain.min, sliderDomain.max)
      : null;

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <label className="text-xs text-text-muted-60 uppercase tracking-wide">
        Exit limits <span className="text-yellow-600/90">(recommended)</span>
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-border-white-10/40 bg-card/30 px-3 py-2.5 hover:bg-card/45 transition-colors">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border-white-20 bg-card/60 accent-emerald-500"
        />
        <span className="text-xs text-text-muted-60 leading-relaxed">
          Add a lower and upper limit to stop your position from liquidation
        </span>
      </label>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            key="exit-range-controls"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-border-white-10/50 bg-card/40 backdrop-blur-sm px-3 py-3 shadow-md shadow-black/10 space-y-3">
              {!controlsReady ? (
                <p className="text-xs text-text-muted-60 py-0.5">
                  Enter margin above to set your limits.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-end">
                    <span className="text-[10px] text-text-muted-60 tabular-nums">
                      Mark ${formatExitPrice(ctx.markPrice, ctx.markPrice)}
                    </span>
                  </div>

                  <div className="relative pt-4 pb-1 mx-0.5 min-h-[2.25rem]">
                    <div className="absolute inset-x-0 bottom-1 h-1 rounded-full bg-white/8 border border-border-white-10/60" />

                    {lowerPct != null && upperPct != null && (
                      <div
                        className="absolute bottom-1 h-1 rounded-full bg-emerald-500/50"
                        style={{ left: `${lowerPct}%`, width: `${upperPct - lowerPct}%` }}
                      />
                    )}

                    {minLowerPct != null && ctx.longLiqValid && (
                      <LiqPriceMarker
                        pct={minLowerPct}
                        price={ctx.minLowerStop}
                        mark={ctx.markPrice}
                        align="left"
                        title={
                          ctx.longLiqPrice != null
                            ? `Long liq ~$${formatExitPrice(ctx.longLiqPrice, ctx.markPrice)} — lower stop must stay 2% above`
                            : 'Minimum lower stop'
                        }
                      />
                    )}

                    <div
                      className="absolute bottom-0 w-px h-4 -translate-x-1/2 bg-text-primary/50"
                      style={{ left: `${clampPct(markPct)}%` }}
                      title="Mark price"
                    />

                    {maxUpperPct != null && ctx.shortLiqValid && (
                      <LiqPriceMarker
                        pct={maxUpperPct}
                        price={ctx.maxUpperStop}
                        mark={ctx.markPrice}
                        align="right"
                        title={
                          ctx.shortLiqPrice != null
                            ? `Short liq ~$${formatExitPrice(ctx.shortLiqPrice, ctx.markPrice)} — upper stop must stay 2% below`
                            : 'Maximum upper stop'
                        }
                      />
                    )}
                  </div>

                  {sliderDomain && sliderValue && (
                    <DualRangeSlider
                      min={sliderDomain.min}
                      max={sliderDomain.max}
                      step={sliderDomain.step}
                      value={sliderValue}
                      onValueChange={handleSliderChange}
                      aria-label="Exit limits"
                    />
                  )}

                  {exitRange && (
                    <div className="grid grid-cols-2 gap-2">
                      <ExitStopCard
                        label="Lower"
                        price={exitRange.lowerPrice}
                        mark={ctx.markPrice}
                        variant="lower"
                        onPriceCommit={handleLowerPriceCommit}
                      />
                      <ExitStopCard
                        label="Upper"
                        price={exitRange.upperPrice}
                        mark={ctx.markPrice}
                        variant="upper"
                        onPriceCommit={handleUpperPriceCommit}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExitStopCard({
  label,
  price,
  mark,
  variant,
  onPriceCommit,
}: {
  label: string;
  price: number;
  mark: number;
  variant: 'lower' | 'upper';
  onPriceCommit: (price: number) => void;
}) {
  const pct = percentFromMark(price, mark);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  const formatted = formatExitPrice(price, mark);

  const handleFocus = () => {
    setDraft(formatted);
    setFocused(true);
  };

  const commitDraft = () => {
    const parsed = parseFloat(draft.replace(/[$,\s]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      onPriceCommit(parsed);
    }
    setFocused(false);
  };

  return (
    <div className="rounded-md border border-border-white-10/50 bg-white/[0.04] px-2.5 py-2">
      <p className="text-[10px] text-text-muted-60 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-muted-60 pointer-events-none">
          $
        </span>
        <Input
          type="text"
          inputMode="decimal"
          aria-label={`${label} limit price`}
          value={focused ? draft : formatted}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={handleFocus}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="h-8 pl-5 pr-2 text-sm font-medium tabular-nums bg-card/40 border-border-white-10/50 focus:bg-card/60 focus:border-border-white-20"
        />
      </div>
      <p
        className={cn(
          'text-[10px] tabular-nums mt-1',
          variant === 'lower' ? 'text-amber-400/90' : 'text-emerald-400/90'
        )}
      >
        {pct >= 0 ? '+' : ''}
        {pct.toFixed(1)}%
      </p>
    </div>
  );
}

export function ExitRangeValidationBanner({ className }: { className?: string }) {
  const enabled = useAtomValue(hedgeExitRangeEnabledAtom);
  const validation = useAtomValue(exitRangeValidationAtom);

  if (!enabled || !validation.error) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2',
        className
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-200/90 leading-relaxed">{validation.error}</p>
    </div>
  );
}
