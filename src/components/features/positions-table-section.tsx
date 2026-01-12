'use client';

/**
 * Positions Table Section Component
 * Shows positions and closed tabs
 */

import { PositionsTableSection } from './trading-dashboard';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PositionsTable } from './positions/positions-table';

interface PositionsTableSectionContentProps {
  className?: string;
}

// Hardcoded positions data
const mockPositions = [
  {
    asset: 'HYPE',
    leverage: '5x',
    assetLogo: '/tokens/hype.png',
    long: {
      platform: 'Hyperliquid',
    },
    short: {
      platform: 'Lighter',
    },
    size: '893.23',
    apr: '21.9%',
    pricePnl: '$0.00',
    fundingPnl: {
      current: '-$0.00',
      estimated: '~+$0.0025 2m',
    },
    totalPnl: '-$0.00',
  },
  {
    asset: 'ETH',
    leverage: '10x',
    assetLogo: '/tokens/eth.png',
    long: {
      platform: 'Lighter',
    },
    short: {
      platform: 'Hyperliquid',
    },
    size: '100.00',
    apr: '21.9%',
    pricePnl: '+$120.00',
    fundingPnl: {
      current: '-$0.00',
      estimated: '~+$0.0025 2m',
    },
    totalPnl: '+$120.00',
  },
];

export function PositionsTableSectionContent({
  className,
}: PositionsTableSectionContentProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'closed'>(
    'positions'
  );
  const [positions, setPositions] = useState(mockPositions);

  const handleClosePosition = (asset: string) => {
    setPositions((prev) =>
      prev.filter((p) => `${p.asset}-${p.leverage}` !== asset)
    );
  };

  return (
    <PositionsTableSection className={className}>
      <div className='flex flex-col h-full overflow-hidden py-4'>
        {/* Tabs and Actions */}
        <div className='flex items-center justify-between border-b border-border-white-10 px-3 md:px-4 lg:px-5 shrink-0'>
          <div className='flex items-center gap-6'>
            <button
              onClick={() => setActiveTab('positions')}
              className={cn(
                'pb-3 text-sm font-medium transition-colors relative',
                activeTab === 'positions'
                  ? 'text-text-primary'
                  : 'text-text-muted-60 hover:text-text-primary'
              )}>
              POSITIONS ({positions.length})
              {activeTab === 'positions' && (
                <span className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent' />
              )}
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={cn(
                'pb-3 text-sm font-medium transition-colors relative',
                activeTab === 'closed'
                  ? 'text-text-primary'
                  : 'text-text-muted-60 hover:text-text-primary'
              )}>
              CLOSED
              {activeTab === 'closed' && (
                <span className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent' />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='flex-1 min-h-0 overflow-hidden'>
          {activeTab === 'positions' ? (
            <PositionsTable
              positions={positions}
              onClosePosition={handleClosePosition}
            />
          ) : (
            <div className='flex items-center justify-center py-12'>
              <p className='text-text-muted-60 text-sm'>No closed positions</p>
            </div>
          )}
        </div>
      </div>
    </PositionsTableSection>
  );
}
