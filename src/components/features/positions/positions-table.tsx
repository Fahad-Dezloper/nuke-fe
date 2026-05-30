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
    '',
  ];

  return (
    <div className="flex flex-col h-full min-h-0 border border-border-white-10/50 rounded-lg overflow-hidden">
      {/* Table Header - Sticky */}
      <div className="sticky top-0 z-[1] px-4 md:px-6 py-3 border-b border-border-white-10/50 bg-gradient-to-r from-card/50 via-card/40 to-card/50 backdrop-blur-md rounded-t-lg shadow-lg shadow-black/20 shrink-0">
        <div className={`${POSITIONS_TABLE_GRID} max-w-full`}>
          {headers.map((header) => (
            <span
              key={header}
              className="text-xs text-text-muted-60 font-medium truncate"
            >
              {header}
            </span>
          ))}
        </div>
      </div>

      {/* Table Rows - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div>
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
