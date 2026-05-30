'use client';

/**
 * Market Overview Component
 * Displays asset name, current index price, funding rates, and estimated APY in a compact ticker bar
 */

import { ArrowUp, ArrowDown } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AssetDropdown } from '@/components/ui/asset-dropdown';
import { formatPrice, formatPercentWithSign } from '@/lib/utils';
import { selectedAssetAtom, marketFeedDataAtom } from '@/lib/stores/market-feed.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { fundingSpreadAprYearly } from '@/lib/arbitrage/asset-table-pairs';
import { MarketOverviewSkeleton } from '@/components/ui/skeletons';
import type { AssetDropdownItem } from '@/types/positions';
import { getProtocolConfig } from '@/lib/protocols/config';

interface MarketOverviewProps {
  className?: string;
  onAssetChange?: (asset: AssetDropdownItem) => void;
}

export function MarketOverview({ className, onAssetChange }: MarketOverviewProps) {
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const { getBestPairForAsset } = useBestPair();

  if (marketFeedData.length === 0) {
    return <MarketOverviewSkeleton className={className} />;
  }

  // Get price from selected asset (use hyperliquid mark price as index price)
  const currentPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

  // Get funding rates based on best pair direction
  const bestPair = getBestPairForAsset(selectedAsset);
  const longProtocolData = selectedAsset?.protocols?.[bestPair.long];
  const shortProtocolData = selectedAsset?.protocols?.[bestPair.short];

  const longFundingRate = longProtocolData?.fundingRateYearly || 0;
  const shortFundingRate = shortProtocolData?.fundingRateYearly || 0;
  const longProtocolConfig = getProtocolConfig(bestPair.long);
  const shortProtocolConfig = getProtocolConfig(bestPair.short);

  // Spread for the active long/short pair (NET APY)
  const estimatedAPR = fundingSpreadAprYearly(longFundingRate, shortFundingRate);

  // Handle asset selection (already handled by dropdown, but call callback if provided)
  const handleAssetSelect = (asset: AssetDropdownItem) => {
    onAssetChange?.(asset);
  };

  const getDecimalCount = (val: number) => {
    if (val < 1) return 4;
    if (val < 10) return 3;
    if (val < 100) return 2;
    return 1;
  };

  const decimals = getDecimalCount(currentPrice);
  const priceFormatter = (val: number) => formatPrice(val, 'USD', 'en-US', decimals, decimals);

  return (
    <div className={cn('bg-[#1B1B1B] rounded-md  h-16 flex items-center select-none', className)}>
      <div className="w-full px-4 overflow-visible">
        <div className="flex items-center gap-8 md:gap-10">
          {/* Asset Selector Dropdown */}
          <div className="relative z-[10000] shrink-0">
            <AssetDropdown
              selectedAsset={selectedAsset || undefined}
              onSelect={handleAssetSelect}
            />
          </div>

          {selectedAsset ? (
            <>
              {/* Index Price */}
              <div className="flex flex-col justify-center shrink-0">
                <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider leading-none mb-1.5">
                  Index Price
                </span>
                <span className="text-base font-bold text-white leading-none tabular-nums">
                  <AnimatedNumber value={currentPrice} formatter={priceFormatter} duration={300} />
                </span>
              </div>

              <div className="h-6 w-px bg-white/[0.06] shrink-0" />

              {/* Long Funding Rate */}
              <div className="flex items-center gap-2">
                {longProtocolConfig?.logo ? (
                  <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md overflow-hidden shadow-xs">
                    <Image
                      src={longProtocolConfig.logo}
                      alt={`${longProtocolConfig.displayName} logo`}
                      width={bestPair.long === 'backpack' ? 14 : 24}
                      height={bestPair.long === 'backpack' ? 14 : 24}
                      className="shrink-0 object-contain"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col justify-center shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-semibold uppercase tracking-wider leading-none mb-1.5">
                    <span>Long Funding</span>
                  </div>
                  <span
                    className="text-sm font-bold leading-none tabular-nums flex items-center gap-1 transition-colors duration-300"
                    style={{
                      color: longProtocolConfig ? `var(${longProtocolConfig.colorVar})` : undefined,
                    }}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    {formatPercentWithSign(longFundingRate)}
                  </span>
                </div>
              </div>

              <div className="h-6 w-px bg-white/[0.06] shrink-0" />

              {/* Short Funding Rate */}
              <div className="flex items-center gap-2">
                {shortProtocolConfig?.logo ? (
                  <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md overflow-hidden shadow-xs">
                    <Image
                      src={shortProtocolConfig.logo}
                      alt={`${shortProtocolConfig.displayName} logo`}
                      width={bestPair.short === 'backpack' ? 14 : 24}
                      height={bestPair.short === 'backpack' ? 14 : 24}
                      className="shrink-0 object-contain"
                    />
                  </div>
                ) : null}

                <div className="flex flex-col justify-center shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-semibold uppercase tracking-wider leading-none mb-1.5">
                    <span>Short Funding</span>
                  </div>
                  <span
                    className="text-sm font-bold leading-none tabular-nums flex items-center gap-1 transition-colors duration-300"
                    style={{
                      color: shortProtocolConfig
                        ? `var(${shortProtocolConfig.colorVar})`
                        : undefined,
                    }}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    {formatPercentWithSign(shortFundingRate)}
                  </span>
                </div>
              </div>

              <div className="h-6 w-px bg-white/[0.06] shrink-0" />

              {/* EST APY */}
              <div className="flex flex-col justify-center shrink-0">
                <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider leading-none mb-1.5">
                  EST APY
                </span>
                <span className="text-sm text-[#00C076] font-bold leading-none tabular-nums flex items-center gap-0.5">
                  {formatPercentWithSign(estimatedAPR)}
                  <span className="text-amber-400">⚡</span>
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center text-text-muted-60 text-sm">
              Select an asset to view metrics
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
