'use client';

import { useAtom, useAtomValue } from 'jotai';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { marginAtom, marginValidationAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';

interface PositionSizeSectionProps {
  className?: string;
}

const QUICK_PERCENTAGES = [25, 50, 75] as const;

export function PositionSizeSection({ className }: PositionSizeSectionProps) {
  const [positionSize, setPositionSize] = useAtom(marginAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const validation = useAtomValue(marginValidationAtom);

  const assetName = selectedAsset?.asset || 'N/A';
  const assetPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;
  const assetAmount = positionSize && assetPrice > 0 ? parseFloat(positionSize) / assetPrice : 0;

  const handleMax = () => {
    if (validation.maxMargin > 0) {
      setPositionSize(validation.maxMargin.toFixed(2));
    }
  };

  const handleQuickPercent = (pct: number) => {
    if (validation.maxMargin > 0) {
      setPositionSize(((validation.maxMargin * pct) / 100).toFixed(2));
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className="stat-label">Margin</label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="number"
            placeholder="0.00"
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            className={cn(
              'w-full pr-14 h-11 rounded-sm bg-secondary border-border-white-10 text-text-primary font-tabular placeholder:text-text-muted-30 focus:border-green/50 focus:ring-0',
              validation.error && 'border-red/50 focus:border-red/60'
            )}
          />
          {validation.maxMargin > 0 && (
            <button
              type="button"
              onClick={handleMax}
              className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-sm bg-border-white-10 hover:bg-border-white-20 text-[10px] font-semibold text-text-muted-60 hover:text-text-primary uppercase transition-colors"
            >
              Max
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 bg-secondary border border-border-white-10 rounded-sm px-3 h-11 shrink-0">
          <Image
            src="/tokens/usdc.png"
            alt="USDC"
            width={18}
            height={18}
            className="rounded-full"
          />
          <span className="text-sm text-text-primary font-medium">USD</span>
        </div>
      </div>

      {validation.maxMargin > 0 && (
        <div className="flex gap-2">
          {QUICK_PERCENTAGES.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handleQuickPercent(pct)}
              className="flex-1 h-8 rounded-sm border border-border-white-10 bg-secondary text-xs font-medium text-text-muted-60 hover:text-text-primary hover:border-border-white-20 transition-colors cursor-pointer"
            >
              {pct}%
            </button>
          ))}
          <button
            type="button"
            onClick={handleMax}
            className="flex-1 h-8 rounded-sm border border-border-white-10 bg-secondary text-xs font-medium text-text-muted-60 hover:text-text-primary hover:border-border-white-20 transition-colors cursor-pointer"
          >
            Max
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px]">
        {validation.error ? (
          <span className="text-red">{validation.error}</span>
        ) : (
          <span />
        )}
        <span className="text-text-muted-40 font-tabular">
          ≈ {assetAmount.toFixed(assetAmount >= 1 ? 2 : 4)} {assetName}
        </span>
      </div>
    </div>
  );
}
