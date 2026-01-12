'use client';

/**
 * Positions Table Section Component
 * Shows positions and closed tabs
 */

import { PositionsTableSection } from './trading-dashboard';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PositionsTable } from './positions/positions-table';
import { mockArbitragePositions } from '@/lib/mocks';
import type { ArbitragePosition } from '@/types/positions';

interface PositionsTableSectionContentProps {
  className?: string;
  initialPositions?: ArbitragePosition[];
}

export function PositionsTableSectionContent({
  className,
  initialPositions = mockArbitragePositions,
}: PositionsTableSectionContentProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'closed'>(
    'positions'
  );
  const [positions, setPositions] = useState(initialPositions);

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
