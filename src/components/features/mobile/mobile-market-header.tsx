'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { AssetDropdown } from '@/components/ui/asset-dropdown';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { formatPercentWithSign, formatPrice } from '@/lib/utils';
import { selectedAssetAtom, marketFeedDataAtom } from '@/lib/stores/market-feed.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { MarketOverviewSkeleton } from '@/components/ui/skeletons';
import type { AssetDropdownItem } from '@/types/positions';

interface MobileMarketHeaderProps {
  className?: string;
  onAssetChange?: (asset: AssetDropdownItem) => void;
}

export function MobileMarketHeader({ className, onAssetChange }: MobileMarketHeaderProps) {
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const { getBestPairForAsset } = useBestPair();

  if (marketFeedData.length === 0) {
    return <MarketOverviewSkeleton className={className} />;
  }

  const currentPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;
  const bestPair = getBestPairForAsset(selectedAsset);
  const longFundingRate = selectedAsset?.protocols?.[bestPair.long]?.fundingRateYearly || 0;
  const shortFundingRate = selectedAsset?.protocols?.[bestPair.short]?.fundingRateYearly || 0;
  const estimatedAPR = selectedAsset?.netAPR || 0;
  const priceFormatter = (val: number) => formatPrice(val, 'USD', 'en-US', 4, 4);

  return (
    <header
      className={cn(
        'shrink-0 border-b border-border-white-10 bg-background px-3 py-2.5',
        className
      )}
    >
      <div className="relative z-[10000] mb-2.5">
        <AssetDropdown
          selectedAsset={selectedAsset || undefined}
          onSelect={(asset) => onAssetChange?.(asset)}
        />
      </div>

      {selectedAsset ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border-white-10 bg-border-white-10">
          <StatCell label="PRICE">
            <AnimatedNumber
              value={currentPrice}
              formatter={priceFormatter}
              duration={300}
              className="text-sm font-semibold tabular-nums"
            />
          </StatCell>
          <StatCell label="EST. APR">
            <span className="text-sm font-semibold tabular-nums text-green-400">
              {formatPercentWithSign(estimatedAPR)}
            </span>
          </StatCell>
          <StatCell label="LONG FUNDING">
            <span className="flex items-center gap-1 text-sm tabular-nums">
              <ArrowUp className="size-3 text-[var(--chart-hyperliquid)]" aria-hidden />
              {formatPercentWithSign(longFundingRate)}
            </span>
          </StatCell>
          <StatCell label="SHORT FUNDING">
            <span className="flex items-center gap-1 text-sm tabular-nums">
              <ArrowDown className="size-3 text-[var(--chart-pink)]" aria-hidden />
              {formatPercentWithSign(shortFundingRate)}
            </span>
          </StatCell>
        </div>
      ) : (
        <p className="text-xs text-text-muted-60">Select an asset to view metrics</p>
      )}
    </header>
  );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-section-surface px-2.5 py-2">
      <p className="text-[9px] font-medium uppercase tracking-wider text-text-muted-40">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
