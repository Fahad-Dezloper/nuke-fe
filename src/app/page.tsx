'use client';

import { useEffect, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { MarketOverview } from '@/components/features/market-overview';
import {
  TradingDashboard,
  ChartSectionContent,
  PositionsTableSectionContent,
  PositionControlsSectionContent,
} from '@/components/features';
import { SectionErrorBoundary } from '@/components/error-boundary';
import { selectedAssetAtom as positionSelectedAssetAtom } from '@/components/features/position-controls/store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import type { AssetDropdownItem } from '@/types/positions';

/**
 * Normalize asset name (e.g., "BTC-PERP" -> "BTC").
 * Defined outside the component to avoid recreating on every render.
 */
function normalizeAssetName(asset: string): string {
  return asset.replace(/-PERP$/, '').toUpperCase();
}

export default function Home() {
  const setPositionSelectedAsset = useSetAtom(positionSelectedAssetAtom);
  const globalSelectedAsset = useAtomValue(selectedAssetAtom);

  // Sync symbol only when the *ticker* changes — not when the same row gets a
  // new object reference from market-feed polling.
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0">
        <SectionErrorBoundary name="Market Overview">
          <MarketOverview onAssetChange={handleAssetChange} />
        </SectionErrorBoundary>
      </div>
      <TradingDashboard className="flex-1 min-h-0">
        {/* Left Side - Chart Section */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="mb-4 shrink-0">
            <SectionErrorBoundary name="Chart">
              <ChartSectionContent />
            </SectionErrorBoundary>
          </div>
          <div className="flex-1 min-h-0">
            <SectionErrorBoundary name="Positions">
              <PositionsTableSectionContent />
            </SectionErrorBoundary>
          </div>
        </div>

        {/* Right Side - Position Controls */}
        <SectionErrorBoundary name="Position Controls">
          <PositionControlsSectionContent />
        </SectionErrorBoundary>
      </TradingDashboard>
    </div>
  );
}
