'use client';

import { useState } from 'react';
import { SectionErrorBoundary } from '@/components/error-boundary';
import {
  ChartSectionContent,
  PositionControlsSectionContent,
} from '@/components/features';
import type { AssetDropdownItem } from '@/types/positions';
import { MobileMarketHeader } from './mobile-market-header';
import { MobileTradingTabBar, type MobileTradingTab } from './mobile-trading-tab-bar';
import { MobileInfoPanel } from './mobile-info-panel';
import { MobilePositionsPanel } from './mobile-positions-panel';

interface MobileTradingViewProps {
  onAssetChange?: (asset: AssetDropdownItem) => void;
}

export function MobileTradingView({ onAssetChange }: MobileTradingViewProps) {
  const [tab, setTab] = useState<MobileTradingTab>('chart');

  return (
    <div className="flex h-full min-h-0 flex-col lg:hidden">
      <MobileMarketHeader onAssetChange={onAssetChange} />
      <MobileTradingTabBar active={tab} onChange={setTab} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'info' && (
          <SectionErrorBoundary name="Market Info">
            <MobileInfoPanel />
          </SectionErrorBoundary>
        )}

        {tab === 'chart' && (
          <SectionErrorBoundary name="Chart">
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden p-2">
              <ChartSectionContent className="min-h-0 min-w-0 flex-1" fluidHeight />
            </div>
          </SectionErrorBoundary>
        )}

        {tab === 'positions' && (
          <SectionErrorBoundary name="Positions">
            <MobilePositionsPanel />
          </SectionErrorBoundary>
        )}

        {tab === 'trade' && (
          <SectionErrorBoundary name="Trade">
            <div className="scroll-touch h-full min-h-0 overflow-y-auto">
              <PositionControlsSectionContent embedded />
            </div>
          </SectionErrorBoundary>
        )}
      </div>
    </div>
  );
}
