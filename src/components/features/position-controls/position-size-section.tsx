'use client';

/**
 * Position Size Section Component
 * Input field for position size with currency dropdown, conversion,
 * MAX button, and margin validation feedback.
 */

import { useAtom, useAtomValue } from 'jotai';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { marginAtom, marginValidationAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';

interface PositionSizeSectionProps {
  className?: string;
}

export function PositionSizeSection({ className }: PositionSizeSectionProps) {
  const [positionSize, setPositionSize] = useAtom(marginAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const validation = useAtomValue(marginValidationAtom);

  // Get asset name and price from selected asset
  const assetName = selectedAsset?.asset || 'N/A';
  const assetPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

  // Calculate asset amount: margin / price
  const assetAmount = positionSize && assetPrice > 0 ? parseFloat(positionSize) / assetPrice : 0;

  const handleMax = () => {
    if (validation.maxMargin > 0) {
      setPositionSize(validation.maxMargin.toFixed(2));
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-xs text-text-muted-60 uppercase tracking-wide">MARGIN</label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="number"
            placeholder="Enter USD amount"
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            className={cn(
              'w-full pr-28 bg-card/40 backdrop-blur-sm border-border-white-10/50 rounded-md text-text-primary placeholder:text-text-muted-40 shadow-md shadow-black/10 focus:bg-card/60 focus:border-border-white-20',
              validation.error && 'border-red-500/40 focus:border-red-500/60'
            )}
          />
          {validation.maxMargin > 0 && (
            <button
              type="button"
              onClick={handleMax}
              className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[10px] font-semibold text-text-muted-60 hover:text-text-primary uppercase tracking-wider transition-colors"
            >
              MAX{' '}
              <span className="text-text-muted-60/60 font-normal">
                ${validation.maxMargin.toFixed(2)}
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 bg-card/40 backdrop-blur-sm border border-border-white-10/50 rounded-md px-3 py-2 shadow-md shadow-black/10">
          <Image
            src="/tokens/usdc.png"
            alt="USDC"
            width={16}
            height={16}
            className="shrink-0 rounded-full"
          />
          <span className="text-sm text-text-primary font-medium">USD</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted-60">
        {validation.error ? (
          <span className="text-[10px] text-red-400">{validation.error}</span>
        ) : (
          <span />
        )}
        <span>
          ≈ {assetAmount.toFixed(assetAmount >= 1 ? 2 : 4)} {assetName}
        </span>
      </div>
    </div>
  );
}
