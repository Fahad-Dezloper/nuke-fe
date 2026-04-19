'use client';

import { chartXLabels, chartYLabels } from '../data';

const pnlPoints = [
  { x: 0, y: 46 },
  { x: 4, y: 47 },
  { x: 8, y: 8 },
  { x: 12, y: 18 },
  { x: 18, y: 70 },
  { x: 24, y: 22 },
  { x: 30, y: 40 },
  { x: 36, y: 8 },
  { x: 42, y: 16 },
  { x: 48, y: 8 },
  { x: 56, y: 8 },
  { x: 60, y: 78 },
  { x: 66, y: 60 },
  { x: 72, y: 48 },
  { x: 78, y: 40 },
  { x: 84, y: 38 },
  { x: 88, y: 70 },
  { x: 92, y: 54 },
  { x: 96, y: 14 },
] as const;

function buildSmoothPath(points: ReadonlyArray<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let path = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let index = 0; index < points.length - 1; index++) {
    const current = points[index]!;
    const next = points[index + 1]!;
    const controlX = (current.x + next.x) / 2;

    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

export function PerformanceChart() {
  const linePath = buildSmoothPath(pnlPoints);
  const areaPath = `${linePath} L 96 80 L 0 80 Z`;

  return (
    <div className="relative h-[230px] w-full overflow-hidden border-l border-border-white-5 pl-8">
      {chartYLabels.map((label, index) => (
        <div
          key={label}
          className="absolute left-0 right-0 flex items-end"
          style={{ top: `${index * 25}%`, height: '25%' }}
        >
          <span className="absolute -left-3 -translate-x-full text-[10px] text-text-muted-60">
            {label}
          </span>
          <div className="h-px w-full border-t border-border-white-5/70" />
        </div>
      ))}

      <svg
        viewBox="0 0 96 80"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-2 h-[calc(100%-42px)] w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="portfolio-pnl-line" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#9edcf5" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#d4f4ff" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="portfolio-pnl-area" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#9edcf5" stopOpacity="0.1" />
            <stop offset="55%" stopColor="#9edcf5" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#9edcf5" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#portfolio-pnl-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#portfolio-pnl-line)"
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="absolute bottom-5 left-0 right-0 border-t border-dashed border-border-white-10" />
      <div className="absolute bottom-[14px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#ff3b30]" />

      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-23 gap-0.5 pt-2">
        {chartXLabels.map((label) => (
          <span key={label} className="text-center text-[10px] text-text-muted-60">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
