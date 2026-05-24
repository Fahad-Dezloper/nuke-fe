'use client';

import { PositionRow } from './position-row';
import type { ArbitragePosition } from '@/types/positions';

interface PositionsTableProps {
  positions: ArbitragePosition[];
  onClosePosition?: (asset: string) => void;
}

export function PositionsTable({ positions, onClosePosition }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-text-muted-40 text-xs">No open arbitrage positions</p>
      </div>
    );
  }

  const headers = [
    'ASSET',
    'LONG / SHORT',
    'SIZE',
    'MARGIN',
    'PRICE PNL',
    'FUNDING PNL',
    'TOTAL PNL',
    'LIQ PRICE',
    '',
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Table Header */}
      <div className="px-4 md:px-5 py-2.5 border-b border-border-white-10 bg-secondary/40 shrink-0">
        <div className="grid grid-cols-[minmax(80px,0.8fr)_minmax(140px,1.2fr)_minmax(65px,0.7fr)_minmax(80px,0.8fr)_minmax(80px,0.9fr)_minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(140px,1.4fr)_36px] gap-2 lg:gap-3 max-w-full">
          {headers.map((header) => (
            <span
              key={header}
              className="stat-label truncate normal-case"
            >
              {header}
            </span>
          ))}
        </div>
      </div>

      {/* Table Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="divide-y divide-border-white-10">
          {positions.map((position) => (
            <PositionRow
              key={`${position.asset}-${position.leverage}`}
              position={position}
              onClose={onClosePosition}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
