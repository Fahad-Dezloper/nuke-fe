'use client';

/**
 * Positions Table Component
 * Displays open positions in a table format
 */

import { PositionRow } from './position-row';
import { POSITIONS_TABLE_GRID } from './positions-table-grid';
import type { ArbitragePosition } from '@/types/positions';

interface PositionsTableProps {
  positions: ArbitragePosition[];
  onClosePosition?: (asset: string) => void;
}

export function PositionsTable({ positions, onClosePosition }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted-60 text-sm">No open arbitrage positions</p>
      </div>
    );
  }

  const headers = [
    'ASSET',
    'Long / Short',
    'SIZE',
    'MARGIN',
    'Price PnL',
    'Funding PnL',
    'APR',
    'Total PnL',
    'Liq. Price',
    'Close Position',
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Scroll container for both horizontal and vertical scrolling */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <div className="w-full min-w-[1230px] flex flex-col min-h-full">
          {/* Table Header - Sticky */}
          <div className="sticky top-0 z-[1] px-5 py-3.5 border-b border-white/[0.06] bg-[#131417]/90 backdrop-blur-md shrink-0 shadow-sm">
            <div className={`${POSITIONS_TABLE_GRID} max-w-full`}>
              {headers.map((header) => (
                <span
                  key={header}
                  className="text-[10px] text-white/40 font-bold uppercase tracking-wider truncate"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>

          {/* Table Rows */}
          <div className="flex-1 divide-y divide-white/[0.04]">
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
    </div>
  );
}
