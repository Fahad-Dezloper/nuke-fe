'use client';

/**
 * Leverage Section Component
 * Slider and input for leverage selection (1x to maxLeverage)
 */

import { useAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { leverageAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';

interface LeverageSectionProps {
  className?: string;
}

export function LeverageSection({ className }: LeverageSectionProps) {
  const [leverage, setLeverage] = useAtom(leverageAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);

  // Get max leverage from selected asset, default to 5 if not available
  const maxLeverage = selectedAsset?.maxLeverage || 5;

  // Ensure current leverage doesn't exceed max leverage when asset changes
  useEffect(() => {
    if (leverage > maxLeverage) {
      setLeverage(maxLeverage);
    }
  }, [maxLeverage, leverage, setLeverage]);

  // Ensure current leverage doesn't exceed max leverage
  const currentLeverage = Math.min(leverage, maxLeverage);

  // Generate strategic marks (only show a few key values)
  const getMarks = (max: number): number[] => {
    if (max <= 5) {
      return [1, max];
    } else if (max <= 10) {
      return [1, 5, max];
    } else if (max <= 20) {
      return [1, 5, 10, 15, max];
    } else if (max <= 30) {
      return [1, 5, 10, 20, max];
    } else if (max <= 50) {
      return [1, 5, 10, 25, max];
    } else {
      // For very high leverage, show marks at 1, 5, 10, 25, 50, and max
      const marks = [1, 5, 10, 25, 50];
      if (max > 50) marks.push(max);
      return marks;
    }
  };

  const marks = getMarks(maxLeverage);

  const handleSliderChange = (value: number) => {
    setLeverage(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(1, Math.min(maxLeverage, value));
    setLeverage(clampedValue);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className="text-xs text-text-muted-60 uppercase tracking-wide">LEVERAGE</label>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Slider
            min={1}
            max={maxLeverage}
            step={1}
            value={currentLeverage}
            onValueChange={handleSliderChange}
            marks={marks}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={1}
            max={maxLeverage}
            value={currentLeverage}
            onChange={handleInputChange}
            className="w-12 h-8 bg-card/40 backdrop-blur-sm border-border-white-10/50 rounded-xl text-text-primary text-sm text-center p-0 shadow-md shadow-black/10 focus:bg-card/60 focus:border-border-white-20"
          />
          <span className="text-sm text-text-muted-60">x</span>
        </div>
      </div>
    </div>
  );
}
