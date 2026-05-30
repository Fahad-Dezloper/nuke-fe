'use client';

/**
 * PnL Chart Component
 * Bar chart showing funding profit and loss with positive/negative coloring
 * Calculates net funding PnL from real chart data
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
  Customized,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartLegend, type ChartConfig } from '@/components/ui/chart';
import type { ChartDataPoint } from '@/hooks/use-funding-rate-chart';
import type { Protocol } from '@/hooks/use-best-pair';
import { cn } from '@/lib/utils';

const NOTIONAL_SIZE = 10000; // $10,000 assumed position size

const chartConfig = {
  pnl: {
    label: 'PnL',
    color: 'var(--green)',
  },
  projected: {
    label: 'PROJECTED FUNDING',
    color: 'var(--green)',
  },
} satisfies ChartConfig;

// --- Types ---

export interface PnLBarData {
  time: string;
  fullTimestamp: string;
  value: number;
  projected: number | null;
}

export type PnLDuration = '1D' | '1W' | '1M';

interface PnLChartProps {
  /** Raw funding rate chart data (1h timeframe) */
  fundingData: ChartDataPoint[];
  /** Duration view */
  duration: PnLDuration;
  chartClassName?: string;
}

// --- Helpers ---

/**
 * Calculate single-candle PnL from a data point.
 */
function rawRateFor(point: ChartDataPoint, p: Protocol): number {
  switch (p) {
    case 'hyperliquid':
      return point.hyperliquidRaw;
    case 'pacifica':
      return point.pacificaRaw;
    case 'phoenix':
      return point.phoenixRaw;
    case 'backpack':
      return point.backpackRaw;
    case 'lighter':
      return point.lighterRaw;
    default: {
      const _x: never = p;
      return _x;
    }
  }
}

function calcPointPnL(point: ChartDataPoint, longProtocol: Protocol): number {
  const rateFor = (p: Protocol) => rawRateFor(point, p);

  const shortProtocol = point.shortProtocol;
  const longRate = rateFor(longProtocol);
  const shortRate = rateFor(shortProtocol);
  return (shortRate - longRate) * NOTIONAL_SIZE;
}

/**
 * Extract a short date label from fullTimestamp (DD/MM/YYYY, HH:MM:SS → DD/MM HH:MM)
 */
function shortDateLabel(fullTimestamp: string): string {
  const m = fullTimestamp.match(/^(\d{2})\/(\d{2})\/\d{4}, (\d{2}):(\d{2})/);
  return m ? `${m[1]}/${m[2]} ${m[3]}:${m[4]}` : fullTimestamp;
}

// --- PnL Computation ---

const NUM_PROJECTED = 5;

/**
 * Compute PnL bars from funding rate data.
 *
 * For 1D:    last 23 hourly candles + 5 projected = 28 bars  (1h per bar)
 * For 1W/1M: sample every 5th candle → 30 bars + 5 projected = 35 bars  (5h per bar)
 *
 * Formula: PnL = (short_rate - long_rate) * notional
 * Long/Short determined from the latest data point's assignment (consistent across all bars).
 */
function computePnLBars(data: ChartDataPoint[], duration: PnLDuration): PnLBarData[] {
  if (!data.length) return [];

  // Determine Long/Short from the latest data point (fixed across all bars)
  const latestPoint = data[data.length - 1];
  const longProtocol = latestPoint.longProtocol;

  if (duration === '1D') {
    return compute1DBars(data, longProtocol);
  }

  // 1W and 1M (1M mirrors 1W for now)
  return compute1WBars(data, longProtocol);
}

/**
 * 1D: last 23 hourly candles + 5 projected (1h step) = 28 bars
 */
function compute1DBars(data: ChartDataPoint[], longProtocol: Protocol): PnLBarData[] {
  const historicalPoints = data.slice(-23);

  const bars: PnLBarData[] = historicalPoints.map((point) => ({
    time: point.time,
    fullTimestamp: point.fullTimestamp,
    value: Number(calcPointPnL(point, longProtocol).toFixed(4)),
    projected: null,
  }));

  // Projected bars — 1h step
  if (bars.length > 0) {
    const lastBar = bars[bars.length - 1];
    const lastPnl = lastBar.value;
    const timeParts = lastBar.time.match(/^(\d{2}):(\d{2})$/);
    let hour = timeParts ? parseInt(timeParts[1]) : 0;
    const min = timeParts ? timeParts[2] : '00';

    for (let i = 0; i < NUM_PROJECTED; i++) {
      hour = (hour + 1) % 24;
      bars.push({
        time: `${String(hour).padStart(2, '0')}:${min}`,
        fullTimestamp: 'Projected',
        value: lastPnl,
        projected: lastPnl,
      });
    }
  }

  return bars;
}

/**
 * 1W / 1M: sample every 5th hourly candle → 30 historical bars + 5 projected (5h step) = 35 bars
 */
function compute1WBars(data: ChartDataPoint[], longProtocol: Protocol): PnLBarData[] {
  const SAMPLE_INTERVAL = 5; // every 5th hourly candle
  const NUM_HISTORICAL = 30;
  const neededCandles = NUM_HISTORICAL * SAMPLE_INTERVAL; // 150

  // Take the last 150 hourly candles, then sample every 5th
  const sliced = data.slice(-neededCandles);

  const bars: PnLBarData[] = [];
  for (let i = 0; i < sliced.length; i += SAMPLE_INTERVAL) {
    const point = sliced[i];
    bars.push({
      time: shortDateLabel(point.fullTimestamp),
      fullTimestamp: point.fullTimestamp,
      value: Number(calcPointPnL(point, longProtocol).toFixed(4)),
      projected: null,
    });
  }

  // Projected bars — 5h step, use last bar's PnL
  if (bars.length > 0) {
    const lastPnl = bars[bars.length - 1].value;

    for (let i = 0; i < NUM_PROJECTED; i++) {
      bars.push({
        time: `+${(i + 1) * SAMPLE_INTERVAL}h`,
        fullTimestamp: 'Projected',
        value: lastPnl,
        projected: lastPnl,
      });
    }
  }

  return bars;
}

// --- Tooltip ---

function PnLTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PnLBarData; value?: number; name?: string }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as PnLBarData;
  if (!data) return null;

  const value = data.value;
  const isPositive = value >= 0;
  const isProjected = data.projected !== null;

  return (
    <div className="rounded-md border border-border-white-10/80 bg-background/95 backdrop-blur-md px-3.5 py-2.5 text-xs shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
      <div className="mb-1.5 font-medium text-text-muted-60">
        {isProjected ? 'Projected' : data.fullTimestamp || data.time}
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-text-muted-60 font-medium">PnL:</span>
        <span
          className="font-bold tabular-nums"
          style={{ color: isPositive ? 'var(--green)' : 'var(--red)' }}
        >
          {isPositive ? '+' : '-'}${Math.abs(value).toFixed(4)}
        </span>
      </div>
    </div>
  );
}

// --- Chart Component ---

export function PnLChart({ fundingData, duration, chartClassName = 'h-[260px]' }: PnLChartProps) {
  const data = useMemo(() => computePnLBars(fundingData, duration), [fundingData, duration]);

  // Compute Y-axis domain
  const allValues = data.map((d) => d.value);
  const maxVal = Math.max(...allValues, 0);
  const minVal = Math.min(...allValues, 0);
  const padding = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.2 || 0.01;
  const yMax = maxVal + padding;
  const yMin = minVal - padding;

  // Index of the first projected bar (for the "now" divider)
  const firstProjectedIdx = data.findIndex((d) => d.projected !== null);

  if (!data.length) {
    return (
      <div
        className={cn(
          chartClassName,
          'flex items-center justify-center text-text-muted-60 text-xs'
        )}
      >
        No data available for PnL chart
      </div>
    );
  }

  return (
    <div>
      <ChartContainer
        config={chartConfig}
        className={cn(
          chartClassName,
          'w-full max-w-full min-w-0 [&_.recharts-responsive-container]:!w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none focus:outline-none'
        )}
      >
        <BarChart
          data={data}
          margin={{ top: 16, right: 16, left: 10, bottom: 8 }}
          barCategoryGap="20%"
          style={{ outline: 'none' }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255, 255, 255, 0.04)"
            vertical={false}
          />
          <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.1)" strokeWidth={1} />
          {firstProjectedIdx > 0 && (
            <Customized
              component={({ xAxisMap, yAxisMap }: any) => {
                const xAxis = xAxisMap?.[Object.keys(xAxisMap)[0]];
                const yAxis = yAxisMap?.[Object.keys(yAxisMap)[0]];
                if (!xAxis || !yAxis) return null;

                const bandWidth = xAxis.bandSize || 0;
                const prevX = xAxis.scale(data[firstProjectedIdx - 1].time);
                const currX = xAxis.scale(data[firstProjectedIdx].time);
                const lineX = prevX + bandWidth + (currX - prevX - bandWidth) / 2;

                return (
                  <line
                    x1={lineX}
                    x2={lineX}
                    y1={yAxis.y}
                    y2={yAxis.y + yAxis.height}
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                );
              }}
            />
          )}
          <XAxis
            dataKey="time"
            tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={62}
            tickFormatter={(value) => {
              if (value === 0) return '$0';
              return value > 0 ? `+$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
            }}
            domain={[yMin, yMax]}
          />
          <ChartTooltip
            cursor={{ fill: 'rgba(255, 255, 255, 0.06)', radius: 4 }}
            content={<PnLTooltip />}
          />
          <Bar
            dataKey="value"
            radius={[3, 3, 0, 0]}
            activeBar={{ opacity: 0.8, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }}
          >
            {data.map((entry, index) => {
              const isProjected = entry.projected !== null;
              const isPositive = entry.value >= 0;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    isProjected
                      ? isPositive
                        ? 'rgba(2, 192, 118, 0.25)'
                        : 'rgba(246, 70, 93, 0.25)'
                      : isPositive
                        ? 'var(--green)'
                        : 'var(--red)'
                  }
                  stroke={isProjected ? (isPositive ? 'var(--green)' : 'var(--red)') : undefined}
                  strokeWidth={isProjected ? 1.5 : 0}
                  strokeDasharray={isProjected ? '4 3' : undefined}
                />
              );
            })}
          </Bar>

          <ChartLegend
            verticalAlign="bottom"
            content={() => (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 sm:gap-x-5 sm:pt-3">
                <div className="flex items-center gap-1.5">
                  <div
                    className="size-1.5 rounded-full sm:size-2"
                    style={{ backgroundColor: 'var(--green)' }}
                  />
                  <span className="text-[10px] text-text-muted-60 sm:text-xs">PROFIT</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="size-1.5 rounded-full sm:size-2"
                    style={{ backgroundColor: 'var(--red)' }}
                  />
                  <span className="text-[10px] text-text-muted-60 sm:text-xs">LOSS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="size-1.5 rounded-sm border border-dashed sm:size-2"
                    style={{
                      borderColor: 'var(--green)',
                      backgroundColor: 'rgba(2, 192, 118, 0.25)',
                    }}
                  />
                  <span className="text-[10px] text-text-muted-60 sm:text-xs font-semibold">
                    PROJECTED
                  </span>
                </div>
              </div>
            )}
          />
        </BarChart>
      </ChartContainer>
      {/* Position size note */}
      <div className="mt-1 pr-1 text-right text-[9px] text-text-muted-40 sm:pr-2 sm:text-[10px]">
        Based on ${NOTIONAL_SIZE.toLocaleString()} position size
      </div>
    </div>
  );
}
