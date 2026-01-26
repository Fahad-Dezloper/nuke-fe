'use client';

import { useSetAtom } from 'jotai';
import { MarketOverview } from '@/components/features/market-overview';
import {
  TradingDashboard,
  ChartSectionContent,
  PositionsTableSectionContent,
  PositionControlsSectionContent,
} from '@/components/features';
import { selectedAssetAtom as positionSelectedAssetAtom } from '@/components/features/position-controls/store';
import type { AssetDropdownItem } from '@/types/positions';

export default function Home() {
  const setPositionSelectedAsset = useSetAtom(positionSelectedAssetAtom);

  // Normalize asset name (e.g., "BTC-PERP" -> "BTC")
  const normalizeAssetName = (asset: string): string => {
    // Remove common suffixes
    return asset.replace(/-PERP$/, '').toUpperCase();
  };

  const handleAssetChange = (asset: AssetDropdownItem) => {
    // Sync with position controls store (for filtering pairs)
    const normalizedAsset = normalizeAssetName(asset.asset);
    setPositionSelectedAsset(normalizedAsset);
    // The full asset data is already stored in market-feed.store.selectedAssetAtom
    // by the AssetDropdown component
  };

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='shrink-0'>
        <MarketOverview onAssetChange={handleAssetChange} />
      </div>
      <TradingDashboard className='flex-1 min-h-0'>
        {/* Left Side - Chart Section */}
        <div className='flex-1 flex flex-col overflow-hidden min-w-0'>
          <div className='mb-4 shrink-0'>
            <ChartSectionContent />
          </div>
          <div className='flex-1 min-h-0'>
            <PositionsTableSectionContent />
          </div>
        </div>

        {/* Right Side - Position Controls */}
        <PositionControlsSectionContent />
      </TradingDashboard>
    </div>
  );
}
