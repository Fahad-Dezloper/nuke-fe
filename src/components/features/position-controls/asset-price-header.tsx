'use client';

import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { formatPrice, formatPercentWithSign } from '@/lib/utils';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { hyperliquidCoinIconUrl } from '@/lib/hyperliquid/coin-icon-url';
import Image from 'next/image';

interface AssetPriceHeaderProps {
  className?: string;
}

export function AssetPriceHeader({ className }: AssetPriceHeaderProps) {
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const { getBestPairForAsset } = useBestPair();

  const asset = selectedAsset?.asset || '—';
  const assetLogo = selectedAsset?.asset ? hyperliquidCoinIconUrl(selectedAsset.asset) : '';
  const currentPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;
  const netAPR = selectedAsset?.netAPR || 0;
  const bestPair = getBestPairForAsset(selectedAsset);

  const priceFormatter = (val: number) => formatPrice(val, 'USD', 'en-US', 2, 4);

  return (
    <div className={cn('panel-header flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {assetLogo ? (
          <Image
            src={assetLogo}
            alt={asset}
            width={28}
            height={28}
            className="rounded-full ring-1 ring-border-white-10 shrink-0"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{asset} Perp</p>
          <p className="text-[11px] text-text-muted-40 truncate">
            {bestPair.long} / {bestPair.short}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <AnimatedNumber
          value={currentPrice}
          formatter={priceFormatter}
          duration={300}
          className="text-base font-semibold font-tabular text-text-primary block"
        />
        {netAPR !== 0 && (
          <span
            className={cn(
              'text-xs font-semibold font-tabular',
              netAPR >= 0 ? 'text-green' : 'text-red'
            )}
          >
            {formatPercentWithSign(netAPR)} APR
          </span>
        )}
      </div>
    </div>
  );
}
