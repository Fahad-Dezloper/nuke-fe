'use client';

/**
 * Position Size Section Component
 * Input field for position size with currency dropdown and conversion
 */

import { useAtom, useAtomValue } from 'jotai';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { marginAtom, marginCurrencyAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';

interface PositionSizeSectionProps {
  className?: string;
}

export function PositionSizeSection({ className }: PositionSizeSectionProps) {
  const [positionSize, setPositionSize] = useAtom(marginAtom);
  const [currency, setCurrency] = useAtom(marginCurrencyAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);

  // Get asset name and price from selected asset
  const assetName = selectedAsset?.asset || 'N/A';
  const assetPrice = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

  // Calculate asset amount: margin / price
  const assetAmount = positionSize && assetPrice > 0
    ? parseFloat(positionSize) / assetPrice
    : 0;

  // Step size - use a reasonable default based on asset price
  // For high-value assets, use larger steps; for low-value, use smaller steps
  const getStepSize = () => {
    if (!assetPrice || assetPrice <= 0) return '0.01';
    if (assetPrice >= 1000) return '0.01';
    if (assetPrice >= 100) return '0.1';
    if (assetPrice >= 10) return '1';
    return '10';
  };

  const stepSize = getStepSize();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
        MARGIN
      </label>
      <div className='flex gap-2'>
        <div className='flex-1 relative'>
          <Input
            type='number'
            placeholder='Enter USD amount'
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            className='w-full bg-card/40 backdrop-blur-sm border-border-white-10/50 rounded-xl text-text-primary placeholder:text-text-muted-40 shadow-md shadow-black/10 focus:bg-card/60 focus:border-border-white-20'
          />
        </div>
        <div className='relative'>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className='appearance-none bg-card/40 backdrop-blur-sm border border-border-white-10/50 rounded-xl px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-card/60 cursor-pointer shadow-md shadow-black/10'>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
          <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted-60 pointer-events-none' />
        </div>
      </div>
      <div className='flex items-center justify-end text-xs text-text-muted-60'>
        <span>≈ {assetAmount.toFixed(assetAmount >= 1 ? 2 : 4)} {assetName}</span>
        {/* <span>Step: {stepSize} {assetName}</span> */}
      </div>
    </div>
  );
}
