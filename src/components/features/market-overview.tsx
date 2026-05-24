'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';
import Image from 'next/image';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AssetDropdown } from '@/components/ui/asset-dropdown';
import { formatPrice, formatPercentWithSign } from '@/lib/utils';
import { selectedAssetAtom, marketFeedDataAtom } from '@/lib/stores/market-feed.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { MarketOverviewSkeleton } from '@/components/ui/skeletons';
import { hyperliquidCoinIconUrl } from '@/lib/hyperliquid/coin-icon-url';
import type { AssetDropdownItem } from '@/types/positions';

interface MarketOverviewProps {
  className?: string;
  onAssetChange?: (asset: AssetDropdownItem) => void;
}

function StatCell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center gap-0.5 px-4 py-3 border-r border-border-white-10 min-w-[100px]',
        className
      )}
    >
      <span className="stat-label">{label}</span>
      <div className="stat-value">{children}</div>
    </div>
  );
}

export function MarketOverview({ className, onAssetChange }: MarketOverviewProps) {
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const { getBestPairForAsset } = useBestPair();

  if (marketFeedData.length === 0) {
    return <MarketOverviewSkeleton className={className} />;
  }

  const currentPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;
  const bestPair = getBestPairForAsset(selectedAsset);
  const longProtocolData = selectedAsset?.protocols?.[bestPair.long];
  const shortProtocolData = selectedAsset?.protocols?.[bestPair.short];
  const longFundingRate = longProtocolData?.fundingRateYearly || 0;
  const shortFundingRate = shortProtocolData?.fundingRateYearly || 0;
  const estimatedAPR = selectedAsset?.netAPR || 0;
  const priceFormatter = (val: number) => formatPrice(val, 'USD', 'en-US', 2, 4);

  const longLabel =
    bestPair.long.charAt(0).toUpperCase() + bestPair.long.slice(1);
  const shortLabel =
    bestPair.short.charAt(0).toUpperCase() + bestPair.short.slice(1);

  const assetIcon = selectedAsset?.asset
    ? hyperliquidCoinIconUrl(selectedAsset.asset)
    : '';

  return (
    <div className={cn('panel shrink-0 overflow-hidden', className)}>
      <div className="flex items-stretch min-h-[72px] overflow-x-auto custom-scrollbar">
        {/* Asset identity + price */}
        <div className="flex items-center gap-4 px-4 md:px-5 py-3 border-r border-border-white-10 shrink-0">
          {selectedAsset && assetIcon ? (
            <Image
              src={assetIcon}
              alt={selectedAsset.asset}
              width={36}
              height={36}
              className="rounded-full ring-1 ring-border-white-10"
            />
          ) : null}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <AssetDropdown
                variant="header"
                selectedAsset={selectedAsset || undefined}
                onSelect={(asset) => onAssetChange?.(asset)}
              />
            </div>
            {selectedAsset ? (
              <AnimatedNumber
                value={currentPrice}
                formatter={priceFormatter}
                duration={300}
                className="text-xl font-semibold font-tabular text-text-primary leading-none"
              />
            ) : (
              <span className="text-sm text-text-muted-40">Select asset</span>
            )}
          </div>
        </div>

        {selectedAsset ? (
          <>
            <StatCell label="Long funding">
              <span className="inline-flex items-center gap-1">
                <ArrowUp className="h-3 w-3 text-green shrink-0" />
                <span
                  className={cn(
                    'font-tabular',
                    longFundingRate >= 0 ? 'text-green' : 'text-red'
                  )}
                >
                  {formatPercentWithSign(longFundingRate)}
                </span>
                <span className="text-[10px] text-text-muted-40 font-normal normal-case">
                  {longLabel}
                </span>
              </span>
            </StatCell>

            <StatCell label="Short funding">
              <span className="inline-flex items-center gap-1">
                <ArrowDown className="h-3 w-3 text-red shrink-0" />
                <span
                  className={cn(
                    'font-tabular',
                    shortFundingRate >= 0 ? 'text-green' : 'text-red'
                  )}
                >
                  {formatPercentWithSign(shortFundingRate)}
                </span>
                <span className="text-[10px] text-text-muted-40 font-normal normal-case">
                  {shortLabel}
                </span>
              </span>
            </StatCell>

            <StatCell label="Best pair" className="hidden lg:flex">
              <span className="text-xs font-medium text-text-muted-80 normal-case tracking-normal">
                {longLabel} / {shortLabel}
              </span>
            </StatCell>

            <div className="flex flex-col justify-center gap-0.5 px-5 py-3 ml-auto shrink-0">
              <span className="stat-label">Est. APR</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-tabular text-green leading-none">
                  {formatPercentWithSign(estimatedAPR)}
                </span>
                <span className="h-2 w-2 rounded-full bg-green shadow-[0_0_8px_var(--green)] animate-pulse" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center px-5 text-sm text-text-muted-40">
            Select an asset to view funding spreads
          </div>
        )}
      </div>
    </div>
  );
}
