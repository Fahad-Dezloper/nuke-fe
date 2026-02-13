'use client';

/**
 * Position Size Section Component
 * Input field for position size with currency dropdown, conversion,
 * MAX button, and margin validation feedback.
 */

import { useAtom, useAtomValue } from 'jotai';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { marginAtom, marginCurrencyAtom, marginValidationAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';

interface PositionSizeSectionProps {
  className?: string;
}

export function PositionSizeSection({ className }: PositionSizeSectionProps) {
  const [positionSize, setPositionSize] = useAtom(marginAtom);
  const [currency, setCurrency] = useAtom(marginCurrencyAtom);
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
      <div className="flex items-center justify-between">
        <label className="text-xs text-text-muted-60 uppercase tracking-wide">MARGIN</label>
        {validation.maxMargin > 0 && (
          <button
            type="button"
            onClick={handleMax}
            className="text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
          >
            MAX ${validation.maxMargin.toFixed(2)}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="number"
            placeholder="Enter USD amount"
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            className={cn(
              'w-full bg-card/40 backdrop-blur-sm border-border-white-10/50 rounded-xl text-text-primary placeholder:text-text-muted-40 shadow-md shadow-black/10 focus:bg-card/60 focus:border-border-white-20',
              validation.error && 'border-red-500/40 focus:border-red-500/60'
            )}
          />
        </div>
        <div className="relative">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="appearance-none bg-card/40 backdrop-blur-sm border border-border-white-10/50 rounded-xl px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-card/60 cursor-pointer shadow-md shadow-black/10"
          >
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted-60 pointer-events-none" />
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
