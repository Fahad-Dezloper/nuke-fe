'use client';

/**
 * Asset Price Header Component
 * Displays asset name, logo, and real-time price in a compact card style
 */

import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { formatPrice } from '@/lib/utils';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import Image from 'next/image';

interface AssetPriceHeaderProps {
  className?: string;
}

export function AssetPriceHeader({ className }: AssetPriceHeaderProps) {
  // Get selected asset from global store
  const selectedAsset = useAtomValue(selectedAssetAtom);

  const asset = selectedAsset?.asset || 'N/A';
  const assetLogo = `https://app.hyperliquid.xyz/coins/${selectedAsset?.asset.toUpperCase()}.svg`;
  const currentPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

  const priceFormatter = (val: number) => formatPrice(val);

  // const isPositive = priceChange >= 0;

  return (
    <div
      className={cn(
        'mx-4 mt-3 mb-4 px-4 py-3.5 relative',
        'bg-gradient-to-br from-card/60 via-card/40 to-card/30',
        'backdrop-blur-xl border border-border-white-10/50',
        'rounded-xl shadow-2xl shadow-black/40',
        'hover:border-border-white-30 hover:shadow-black/50',
        'hover:backdrop-blur-2xl hover:from-card/70 hover:via-card/50 hover:to-card/40',
        'transition-all duration-300',
        'overflow-hidden',
        className
      )}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-between">
        {/* Asset Info */}
        <div className="flex items-center gap-3">
          <Image src={assetLogo} alt={asset} width={20} height={20} />
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-bold text-text-primary leading-tight">{asset}</span>
            {/* <span className='text-xs text-text-muted-60 uppercase tracking-wide'>
              {asset}USD
            </span> */}
          </div>
        </div>

        {/* Price and Change */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <AnimatedNumber
              value={currentPrice}
              formatter={priceFormatter}
              duration={300}
              className="text-base font-bold"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
