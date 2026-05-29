'use client';

/**
 * Market Overview Component
 * Displays asset name, current price, funding rates, and estimated APR
 */

import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { MetricItem } from '@/components/ui/metric-item';
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

  // Get price from selected asset (use hyperliquid mark price as primary)
  const currentPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

  // Get funding rates based on best pair direction
  const bestPair = getBestPairForAsset(selectedAsset);
  const longProtocolData = selectedAsset?.protocols?.[bestPair.long];
  const shortProtocolData = selectedAsset?.protocols?.[bestPair.short];

  const longFundingRate = longProtocolData?.fundingRateYearly || 0;
  const shortFundingRate = shortProtocolData?.fundingRateYearly || 0;
  const longProtocolConfig = getProtocolConfig(bestPair.long);
  const shortProtocolConfig = getProtocolConfig(bestPair.short);

  // Spread for the active long/short pair (not global min/max across all venues)
  const estimatedAPR = fundingSpreadAprYearly(longFundingRate, shortFundingRate);

  // Handle asset selection (already handled by dropdown, but call callback if provided)
  const handleAssetSelect = (asset: AssetDropdownItem) => {
    onAssetChange?.(asset);
  };

  const priceFormatter = (val: number) => formatPrice(val, 'USD', 'en-US', 4, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn(
        'bg-gradient-to-r from-background via-background/98 to-background',
        'border-b-[0.5px] border-l-[0.5px] border-r-[0.5px] border-border-white-10',
        'relative',
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--chart-hyperliquid)]/5 via-transparent to-[var(--chart-pink)]/5 pointer-events-none" />

      <div className="mx-auto px-3 md:px-4 lg:px-5 py-0 relative z-10">
        <div className="flex flex-col gap-3 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-6 lg:py-0 xl:gap-8">
          {/* Asset Selector Dropdown */}
          <div className="relative z-[10000] w-full shrink-0 sm:w-auto">
            <AssetDropdown
              selectedAsset={selectedAsset || undefined}
              onSelect={handleAssetSelect}
            />
          </div>

          {/* Metrics Grid */}
          {selectedAsset ? (
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-6 xl:gap-8">
              {/* Current Price */}
              <MetricItem label="CURRENT PRICE">
                <AnimatedNumber
                  value={currentPrice}
                  formatter={priceFormatter}
                  duration={300}
                  className="text-base font-semibold"
                />
              </MetricItem>

              {/* Long Funding Rate (Hyperliquid) */}
              <MetricItem label="LONG FUNDING RATE">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded bg-[var(--chart-hyperliquid)]/20">
                      <ArrowUp className="h-3 w-3 text-[var(--chart-hyperliquid)]" />
                    </div>
                    <span className={cn('text-sm tabular-nums ')}>
                      {formatPercentWithSign(longFundingRate)}
                    </span>
                  </div>

                  {longProtocolConfig?.logo ? (
                    <Image
                      src={longProtocolConfig.logo}
                      alt={`${longProtocolConfig.displayName} logo`}
                      width={16}
                      height={16}
                      className="h-4 w-4 rounded-full opacity-90"
                    />
                  ) : null}
                </div>
              </MetricItem>

              {/* Short Funding Rate (Pacifica) */}
              <MetricItem label="SHORT FUNDING RATE">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded bg-[var(--chart-pink)]/20">
                      <ArrowDown className="h-3 w-3 text-[var(--chart-pink)]" />
                    </div>
                    <span className={cn('text-sm tabular-nums ')}>
                      {formatPercentWithSign(shortFundingRate)}
                    </span>
                  </div>

                  {shortProtocolConfig?.logo ? (
                    <Image
                      src={shortProtocolConfig.logo}
                      alt={`${shortProtocolConfig.displayName} logo`}
                      width={16}
                      height={16}
                      className="h-4 w-4 rounded-full opacity-90"
                    />
                  ) : null}
                </div>
              </MetricItem>

              {/* Estimated APR (NET APR) */}
              <MetricItem label="EST. APR">
                <div className="flex items-center gap-1.5">
                  <div className="px-2 py-0.5 rounded-md backdrop-blur-sm border shadow-sm bg-green-900/30 border-green-500/20">
                    <span className="text-sm font-semibold tabular-nums text-green-400">
                      {formatPercentWithSign(estimatedAPR)}
                    </span>
                  </div>
                </div>
              </MetricItem>
            </div>
          ) : (
            <div className="flex items-center text-text-muted-60 text-sm">
              Select an asset to view metrics
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
