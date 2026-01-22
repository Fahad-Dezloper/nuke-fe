'use client';

/**
 * Leverage Section Component
 * Slider and input for leverage selection (1x-5x)
 */

import { useAtom } from 'jotai';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { leverageAtom } from './store';

interface LeverageSectionProps {
  className?: string;
}

export function LeverageSection({ className }: LeverageSectionProps) {
  const [leverage, setLeverage] = useAtom(leverageAtom);

  const handleSliderChange = (value: number) => {
    setLeverage(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(1, Math.min(5, value));
    setLeverage(clampedValue);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
        LEVERAGE
      </label>
      <div className='flex items-center gap-4'>
        <div className='flex-1'>
          <Slider
            min={1}
            max={5}
            step={1}
            value={leverage}
            onValueChange={handleSliderChange}
            marks={[1, 2, 3, 4, 5]}
            className='w-full'
          />
        </div>
        <div className='flex items-center gap-1'>
          <Input
            type='number'
            min={1}
            max={5}
            value={leverage}
            onChange={handleInputChange}
            className='w-12 h-8 bg-card/40 backdrop-blur-sm border-border-white-10/50 rounded-xl text-text-primary text-sm text-center p-0 shadow-md shadow-black/10 focus:bg-card/60 focus:border-border-white-20'
          />
          <span className='text-sm text-text-muted-60'>x</span>
        </div>
      </div>
    </div>
  );
}
