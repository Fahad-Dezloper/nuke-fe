'use client';

/**
 * Mirrored exit range — dual-handle price bar with liquidation markers.
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { DualRangeSlider } from '@/components/ui/dual-range-slider';
import {
  marginAtom,
  leverageAtom,
  hedgeExitRangeAtom,
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

function protocolLabel(exchange: string): string {
  const ex = exchange.toLowerCase();
  if (ex === 'hyperliquid') return 'Hyperliquid';
  if (ex === 'pacifica') return 'Pacifica';
  if (ex === 'phoenix') return 'Phoenix';
  if (ex === 'lighter') return 'Lighter';
  return exchange;
}

export function ExitRangeSection({ className }: ExitRangeSectionProps) {
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
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
        selectedAsset ? overrides[selectedAsset.asset] ?? null : null,
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

  // Reset defaults only when asset / margin / leverage / pair change — not when mark ticks.
  useEffect(() => {
    if (!ctx || !settingsKey) return;
    if (touched === settingsKey) return;
    setExitRange(ctx.defaultStops);
  }, [ctx, settingsKey, touched, setExitRange]);

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
      sliderStepToPrice(
        priceToSliderStep(exitRange.lowerPrice, min, max),
        min,
        max
      ),
      sliderStepToPrice(
        priceToSliderStep(exitRange.upperPrice, min, max),
        min,
        max
      ),
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
      const minLower = ctx.longLiqValid ? ctx.minLowerStop : sliderDomain?.min ?? 0;
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
          ctx.longLiqValid ? ctx.minLowerStop : sliderDomain?.min ?? 0,
          Math.min(maxLower, upperPrice - minGap)
        );
      }
      setExitRange({ lowerPrice, upperPrice });
      markTouched();
    },
    [exitRange, ctx, settingsKey, sliderDomain, setExitRange, markTouched]
  );

  const disabled = !ctx || marginValue <= 0;

  const markPct = ctx && sliderDomain ? priceToPct(ctx.markPrice, sliderDomain.min, sliderDomain.max) : 50;
  const longLiqPct =
    ctx?.longLiqPrice != null && sliderDomain
      ? priceToPct(ctx.longLiqPrice, sliderDomain.min, sliderDomain.max)
      : null;
  const shortLiqPct =
    ctx?.shortLiqPrice != null && sliderDomain
      ? priceToPct(ctx.shortLiqPrice, sliderDomain.min, sliderDomain.max)
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
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-text-muted-60 uppercase tracking-wide">
          Mirrored exit range
        </label>
        {ctx && (
          <span className="text-[10px] text-text-muted-60 tabular-nums">
            Mark ${formatExitPrice(ctx.markPrice, ctx.markPrice)}
          </span>
        )}
      </div>

      <div className="rounded-md border border-border-white-10/50 bg-gradient-to-br from-card/60 via-card/40 to-card/30 px-3 py-3 backdrop-blur-md shadow-lg shadow-black/10 space-y-3">
        {disabled ? (
          <p className="text-xs text-text-muted-60 py-2">
            Enter margin to configure mirrored take-profit and stop-loss levels.
          </p>
        ) : (
          <>
            {/* Price bar with liq + mark markers */}
            <div className="relative h-10 mx-1 mb-1">
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted/60 border border-border-white-10" />

              {lowerPct != null && upperPct != null && (
                <div
                  className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-emerald-500/40 border border-emerald-500/30"
                  style={{
                    left: `${lowerPct}%`,
                    width: `${upperPct - lowerPct}%`,
                  }}
                />
              )}

              {longLiqPct != null && ctx.longLiqValid && (
                <div
                  className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                  style={{ left: `${clampPct(longLiqPct)}%` }}
                  title={`Long liq (${protocolLabel(ctx.longExchange)})`}
                >
                  <span className="text-[9px] text-red-400/90 font-medium leading-none mb-0.5">
                    L liq
                  </span>
                  <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500/80" />
                </div>
              )}

              <div
                className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${clampPct(markPct)}%` }}
                title="Mark price"
              >
                <div className="w-px h-5 bg-text-muted-60/80" />
                <span className="text-[9px] text-text-muted-60 mt-0.5">Mark</span>
              </div>

              {shortLiqPct != null && ctx.shortLiqValid && (
                <div
                  className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                  style={{ left: `${clampPct(shortLiqPct)}%` }}
                  title={`Short liq (${protocolLabel(ctx.shortExchange)})`}
                >
                  <span className="text-[9px] text-red-400/90 font-medium leading-none mb-0.5">
                    S liq
                  </span>
                  <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500/80" />
                </div>
              )}
            </div>

            {sliderDomain && sliderValue && (
              <DualRangeSlider
                min={sliderDomain.min}
                max={sliderDomain.max}
                step={sliderDomain.step}
                value={sliderValue}
                onValueChange={handleSliderChange}
                aria-label="Mirrored exit range"
              />
            )}

            {exitRange && ctx && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <ExitStopCard
                  label="Lower stop"
                  sublabel="Long SL · Short TP"
                  price={exitRange.lowerPrice}
                  mark={ctx.markPrice}
                  variant="lower"
                  onPriceCommit={handleLowerPriceCommit}
                />
                <ExitStopCard
                  label="Upper stop"
                  sublabel="Long TP · Short SL"
                  price={exitRange.upperPrice}
                  mark={ctx.markPrice}
                  variant="upper"
                  onPriceCommit={handleUpperPriceCommit}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-text-muted-60 border-t border-border-white-5 pt-2">
              <span>
                Long liq ({protocolLabel(ctx.longExchange)}):{' '}
                <span className="text-red-400/90 tabular-nums">
                  {ctx.longLiqValid && ctx.longLiqPrice != null
                    ? `$${formatExitPrice(ctx.longLiqPrice, ctx.markPrice)}`
                    : '— (wide at low lev.)'}
                </span>
              </span>
              <span className="text-right">
                Short liq ({protocolLabel(ctx.shortExchange)}):{' '}
                <span className="text-red-400/90 tabular-nums">
                  {ctx.shortLiqValid && ctx.shortLiqPrice != null
                    ? `$${formatExitPrice(ctx.shortLiqPrice, ctx.markPrice)}`
                    : '—'}
                </span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function clampPct(p: number) {
  return Math.min(98, Math.max(2, p));
}

function ExitStopCard({
  label,
  sublabel,
  price,
  mark,
  variant,
  onPriceCommit,
}: {
  label: string;
  sublabel: string;
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
    <div className="rounded border border-border-white-10/40 bg-card/30 px-2 py-1.5">
      <p className="text-[10px] text-text-muted-60 uppercase tracking-wide">{label}</p>
      <p className="text-[10px] text-text-muted-60">{sublabel}</p>
      <div className="relative mt-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-muted-60 pointer-events-none">
          $
        </span>
        <Input
          type="text"
          inputMode="decimal"
          aria-label={`${label} price`}
          value={focused ? draft : formatted}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={handleFocus}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="h-8 pl-5 pr-2 text-sm font-medium tabular-nums bg-card/50 border-border-white-10/60"
        />
      </div>
      <p
        className={cn(
          'text-[10px] tabular-nums mt-1',
          variant === 'lower' ? 'text-amber-400/90' : 'text-emerald-400/90'
        )}
      >
        {pct >= 0 ? '+' : ''}
        {pct.toFixed(1)}% from mark
      </p>
    </div>
  );
}

export function ExitRangeValidationBanner({ className }: { className?: string }) {
  const validation = useAtomValue(exitRangeValidationAtom);

  if (!validation.error) return null;

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
