'use client';

import { useMemo } from 'react';
import type { PerformanceTimeframe, PnlChartPoint } from '@/lib/api/services';

interface PerformanceChartProps {
  points: PnlChartPoint[];
  rangeStart?: string;
  rangeEnd?: string;
  timeframe: PerformanceTimeframe;
  loading?: boolean;
}

const VIEW_W = 96;
const VIEW_H = 80;
const Y_TICKS = 5;
const X_LABEL_COUNT = 6;

function formatUsdAxis(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000) {
    const k = abs / 1000;
    const formatted = k >= 10 ? k.toFixed(0) : k.toFixed(1);
    return `${sign}$${formatted}k`;
  }
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(1)}`;
  if (abs === 0) return '$0';
  return `${sign}$${abs.toFixed(2)}`;
}

function formatXLabel(date: Date, timeframe: PerformanceTimeframe): string {
  if (timeframe === 'day') {
    const hour = date.getHours();
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour} ${meridiem}`;
  }
  if (timeframe === 'week') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  if (timeframe === 'month') {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  // all
  const yy = String(date.getFullYear()).slice(-2);
  return `${date.getMonth() + 1}/${yy}`;
}

/**
 * Monotone cubic interpolation (Fritsch-Carlson). Same algorithm D3 / Recharts
 * use for "monotone" curves: smooth, never overshoots, never wobbles between
 * close-y points (which is what the older midpoint-Bézier approach did).
 */
function buildSmoothPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (n === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  const dx = new Array<number>(n - 1);
  const slope = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1]!.x - points[i]!.x;
    slope[i] = (points[i + 1]!.y - points[i]!.y) / (dx[i]! || 1);
  }

  const tangent = new Array<number>(n);
  tangent[0] = slope[0]!;
  tangent[n - 1] = slope[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const m0 = slope[i - 1]!;
    const m1 = slope[i]!;
    if (m0 * m1 <= 0) {
      tangent[i] = 0;
    } else {
      const w1 = 2 * dx[i]! + dx[i - 1]!;
      const w2 = dx[i]! + 2 * dx[i - 1]!;
      tangent[i] = (w1 + w2) / (w1 / m0 + w2 / m1);
    }
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const h = dx[i]!;
    const cp1x = p0.x + h / 3;
    const cp1y = p0.y + (tangent[i]! * h) / 3;
    const cp2x = p1.x - h / 3;
    const cp2y = p1.y - (tangent[i + 1]! * h) / 3;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }
  return path;
}

export function PerformanceChart({
  points,
  rangeStart,
  rangeEnd,
  timeframe,
  loading,
}: PerformanceChartProps) {
  const { svgPoints, yLabels, xLabels, hasData, zeroY } = useMemo(() => {
    if (!points.length || !rangeStart || !rangeEnd) {
      return {
        svgPoints: [],
        yLabels: ['$0', '$0', '$0', '$0', '$0'],
        xLabels: Array.from({ length: X_LABEL_COUNT }, () => ''),
        hasData: false,
        zeroY: VIEW_H,
      };
    }

    const startMs = new Date(rangeStart).getTime();
    const endMs = new Date(rangeEnd).getTime();
    const xSpan = Math.max(endMs - startMs, 1);

    const values = points.map((p) => p.cumulativePnlUsd);
    let yMin = Math.min(0, ...values);
    let yMax = Math.max(0, ...values);
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const ySpan = yMax - yMin;

    // Y axis: 5 evenly-spaced labels, top → bottom (highest first).
    const yLabels = Array.from({ length: Y_TICKS }, (_, i) => {
      const v = yMax - (ySpan * i) / (Y_TICKS - 1);
      return formatUsdAxis(v);
    });

    // X axis: 6 evenly-spaced labels across [rangeStart, rangeEnd].
    const xLabels = Array.from({ length: X_LABEL_COUNT }, (_, i) => {
      const t = startMs + (xSpan * i) / (X_LABEL_COUNT - 1);
      return formatXLabel(new Date(t), timeframe);
    });

    const svgPoints = points.map((p) => {
      const tMs = new Date(p.timestamp).getTime();
      const x = ((tMs - startMs) / xSpan) * VIEW_W;
      const yNorm = (p.cumulativePnlUsd - yMin) / ySpan;
      const y = VIEW_H - yNorm * VIEW_H;
      return { x, y };
    });

    const zeroY = VIEW_H - ((0 - yMin) / ySpan) * VIEW_H;

    return { svgPoints, yLabels, xLabels, hasData: true, zeroY };
  }, [points, rangeStart, rangeEnd, timeframe]);

  const linePath = buildSmoothPath(svgPoints);
  const areaPath = svgPoints.length
    ? `${linePath} L ${svgPoints[svgPoints.length - 1]!.x} ${VIEW_H} L ${svgPoints[0]!.x} ${VIEW_H} Z`
    : '';

  return (
    <div className="relative h-57.5 w-full overflow-hidden border-l border-border-white-5 pl-8">
      {yLabels.map((label, index) => (
        <div
          key={`${label}-${index}`}
          className="absolute left-0 right-0 flex items-end"
          style={{ top: `${(index * 100) / (Y_TICKS - 1)}%`, height: `${100 / (Y_TICKS - 1)}%` }}
        >
          <span className="absolute -left-3 -translate-x-full text-[10px] text-text-muted-60">
            {label}
          </span>
          <div className="h-px w-full border-t border-border-white-5/70" />
        </div>
      ))}

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-2 h-[calc(100%-42px)] w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="portfolio-pnl-area" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
          </linearGradient>
        </defs>
        {hasData && (
          <>
            <path
              d={areaPath}
              fill="url(#portfolio-pnl-area)"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              x2={VIEW_W}
              y1={zeroY}
              y2={zeroY}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={linePath}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {!hasData && !loading && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex h-[calc(100%-42px)] items-center justify-center">
          <span className="text-[11px] text-text-muted-60">No PnL data yet</span>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex h-[calc(100%-42px)] items-center justify-center">
          <span className="text-[11px] text-text-muted-60">Loading…</span>
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 grid pt-2"
        style={{ gridTemplateColumns: `repeat(${X_LABEL_COUNT}, minmax(0, 1fr))` }}
      >
        {xLabels.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="text-center text-[10px] text-text-muted-60"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
