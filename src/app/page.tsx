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
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      <SectionErrorBoundary name="Market Overview">
        <MarketOverview onAssetChange={handleAssetChange} />
      </SectionErrorBoundary>

      <TradingDashboard className="flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">
          <SectionErrorBoundary name="Chart">
            <ChartSectionContent />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Positions">
            <PositionsTableSectionContent className="flex-1 min-h-0" />
          </SectionErrorBoundary>
        </div>

        <SectionErrorBoundary name="Position Controls">
          <PositionControlsSectionContent />
        </SectionErrorBoundary>
      </TradingDashboard>
    </div>
  );
}
