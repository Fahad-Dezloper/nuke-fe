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

  const handlePercent = (percent: number) => {
    if (validation.maxMargin > 0) {
      const calculated = (validation.maxMargin * (percent / 100)).toFixed(2);
      setPositionSize(calculated);
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <label className="text-text-muted-60 font-medium">Margin</label>
        {validation.maxMargin > 0 && (
          <span className="text-[11px] text-text-muted-60">
            Available:{' '}
            <span className="text-text-primary font-mono font-semibold">
              $
              {validation.maxMargin.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <Input
          type="number"
          placeholder="0.00"
          value={positionSize}
          onChange={(e) => setPositionSize(e.target.value)}
          className={cn(
            'w-full pr-16 bg-card/40 backdrop-blur-sm border-border-white-10/50 rounded-md text-text-primary placeholder:text-text-muted-40 shadow-md shadow-black/10 focus:bg-card/60 focus:border-border-white-20',
            validation.error && 'border-red-500/40 focus:border-red-500/60'
          )}
        />
        <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none select-none">
          <Image
            src="/tokens/usdc.png"
            alt="USDC"
            width={14}
            height={14}
            className="shrink-0 rounded-full"
          />
          <span className="text-xs text-text-muted-60 font-semibold">USD</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => handlePercent(pct)}
            className="py-1 rounded-sm bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-white/[0.12] active:bg-white/[0.05] text-[10px] font-bold text-text-muted-60 hover:text-text-primary transition-all duration-150 cursor-pointer text-center"
          >
            {pct === 100 ? 'MAX' : `${pct}%`}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted-60 min-h-4">
        {validation.error ? (
          <span className="text-[10px] text-red-400 font-medium leading-none">
            {validation.error}
          </span>
        ) : (
          <span />
        )}
        <span className="font-medium">
          ≈{' '}
          {assetAmount.toLocaleString(undefined, {
            minimumFractionDigits: assetAmount >= 1 ? 2 : 4,
            maximumFractionDigits: assetAmount >= 1 ? 2 : 4,
          })}{' '}
          {assetName}
        </span>
      </div>
    </div>
  );
}
