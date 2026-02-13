'use client';

/**
 * PnL Chart Component
 * Bar chart showing funding profit and loss with positive/negative coloring
 * Calculates net funding PnL from real chart data
 */

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';
import type { ChartDataPoint } from '@/hooks/use-funding-rate-chart';

const NOTIONAL_SIZE = 10000; // $10,000 assumed position size

const chartConfig = {
  pnl: {
    label: 'PnL',
    color: '#22c55e',
  },
  projected: {
    label: 'PROJECTED FUNDING',
    color: '#22c55e',
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
}

// --- Helpers ---

/**
 * Calculate single-candle PnL from a data point.
 */
function calcPointPnL(
  point: ChartDataPoint,
  longProtocol: 'hyperliquid' | 'pacifica'
): number {
  const longRate =
    longProtocol === 'hyperliquid' ? point.hyperliquidRaw : point.pacificaRaw;
  const shortRate =
    longProtocol === 'hyperliquid' ? point.pacificaRaw : point.hyperliquidRaw;
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
function computePnLBars(
  data: ChartDataPoint[],
  duration: PnLDuration
): PnLBarData[] {
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
function compute1DBars(
  data: ChartDataPoint[],
  longProtocol: 'hyperliquid' | 'pacifica'
): PnLBarData[] {
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
function compute1WBars(
  data: ChartDataPoint[],
  longProtocol: 'hyperliquid' | 'pacifica'
): PnLBarData[] {
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

function PnLTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PnLBarData; value?: number; name?: string }> }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as PnLBarData;
  if (!data) return null;

  const value = data.value;
  const isPositive = value >= 0;
  const isProjected = data.projected !== null;

  return (
    <div className="rounded-lg border border-border-white-10 bg-card px-3 py-2 text-xs shadow-md">
      <div className="mb-1 text-text-muted-60">
        {isProjected ? 'Projected' : data.fullTimestamp || data.time}
      </div>
      <span
        className="font-semibold"
        style={{ color: isPositive ? '#22c55e' : '#ef4444' }}
      >
        {isPositive ? '+' : '-'}${Math.abs(value).toFixed(4)}
      </span>
    </div>
  );
}

// --- Chart Component ---

export function PnLChart({ fundingData, duration }: PnLChartProps) {
  const data = useMemo(
    () => computePnLBars(fundingData, duration),
    [fundingData, duration]
  );

  // Compute Y-axis domain
  const allValues = data.map((d) => d.value);
  const maxVal = Math.max(...allValues, 0);
  const minVal = Math.min(...allValues, 0);
  const padding = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.2 || 0.01;
  const yMax = maxVal + padding;
  const yMin = minVal - padding;

  if (!data.length) {
    return (
      <div className="h-[260px] flex items-center justify-center text-text-muted-60 text-xs">
        No data available for PnL chart
      </div>
    );
  }

  return (
    <div>
      <ChartContainer
        config={chartConfig}
        className="h-[260px] w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none focus:outline-none"
      >
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          barCategoryGap="20%"
          style={{ outline: 'none' }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255, 255, 255, 0.06)"
            vertical={false}
          />
          <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.15)" strokeWidth={1} />
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
            width={55}
            tickFormatter={(value) => {
              if (value === 0) return '$0';
              return value > 0
                ? `+$${value.toFixed(2)}`
                : `-$${Math.abs(value).toFixed(2)}`;
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
                        ? 'rgba(34, 197, 94, 0.35)'
                        : 'rgba(239, 68, 68, 0.35)'
                      : isPositive
                        ? '#22c55e'
                        : '#ef4444'
                  }
                  stroke={isProjected ? (isPositive ? '#22c55e' : '#ef4444') : undefined}
                  strokeWidth={isProjected ? 1.5 : 0}
                  strokeDasharray={isProjected ? '4 3' : undefined}
                />
              );
            })}
          </Bar>

          <ChartLegend
            verticalAlign="bottom"
            content={() => (
              <div className="flex items-center justify-start gap-6 pt-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-[11px] text-text-muted-60">FUNDING PROFIT</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-[11px] text-text-muted-60">FUNDING LOSS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm border border-dashed border-green-500 bg-green-500/30" />
                  <span className="text-[11px] text-text-muted-60">PROJECTED FUNDING</span>
                </div>
              </div>
            )}
          />
        </BarChart>
      </ChartContainer>
      {/* Position size note */}
      <div className="text-[10px] text-text-muted-40 text-right mt-1 pr-2">
        Based on ${NOTIONAL_SIZE.toLocaleString()} position size
      </div>
    </div>
  );
}
