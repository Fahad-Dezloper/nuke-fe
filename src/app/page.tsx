'use client';

import { Suspense, useEffect, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { MarketOverview } from '@/components/features/market-overview';
import {
  TradingDashboard,
  ChartSectionContent,
  PositionsTableSectionContent,
  PositionControlsSectionContent,
} from '@/components/features';
import { MobileTradingView } from '@/components/features/mobile/mobile-trading-view';
import { SectionErrorBoundary } from '@/components/error-boundary';
import { TradingUrlSync } from '@/components/features/trading-url-sync';
import { selectedAssetAtom as positionSelectedAssetAtom } from '@/components/features/position-controls/store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import type { AssetDropdownItem } from '@/types/positions';

/**
 * Normalize asset name (e.g., "BTC-PERP" -> "BTC").
 */
function normalizeAssetName(asset: string): string {
  return asset.replace(/-PERP$/, '').toUpperCase();
}

export default function Home() {
  const setPositionSelectedAsset = useSetAtom(positionSelectedAssetAtom);
  const globalSelectedAsset = useAtomValue(selectedAssetAtom);

  const globalAssetSymbol = globalSelectedAsset?.asset;
  useEffect(() => {
    if (globalAssetSymbol) {
      setPositionSelectedAsset(normalizeAssetName(globalAssetSymbol));
    }
  }, [globalAssetSymbol, setPositionSelectedAsset]);

  const handleAssetChange = useCallback(
    (asset: AssetDropdownItem) => {
      const normalizedAsset = normalizeAssetName(asset.asset);
      setPositionSelectedAsset(normalizedAsset);
    },
    [setPositionSelectedAsset]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Suspense fallback={null}>
        <TradingUrlSync />
      </Suspense>

      {/* Mobile: DexScreener-style tabbed views */}
      <MobileTradingView onAssetChange={handleAssetChange} />

      {/* Desktop: split trading terminal */}
      <div className="hidden min-h-0 mt-2 mx-4 flex-1 flex-col overflow-hidden lg:flex">
        <div className="shrink-0">
          <SectionErrorBoundary name="Market Overview">
            <MarketOverview onAssetChange={handleAssetChange} />
          </SectionErrorBoundary>
        </div>
        <TradingDashboard className="min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden gap-4">
            <div className="flex-1 min-h-0 flex flex-col">
              <SectionErrorBoundary name="Chart">
                <ChartSectionContent fluidHeight={true} />
              </SectionErrorBoundary>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <SectionErrorBoundary name="Positions">
                <PositionsTableSectionContent />
              </SectionErrorBoundary>
            </div>
          </div>
          <SectionErrorBoundary name="Position Controls">
            <PositionControlsSectionContent />
          </SectionErrorBoundary>
        </TradingDashboard>
      </div>
    </div>
  );
}
