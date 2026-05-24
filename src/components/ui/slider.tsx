'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  marks?: number[];
}

export function Slider({
  className,
  min = 0,
  max = 100,
  step = 1,
  value,
  onValueChange,
  marks,
  id,
  ...props
}: SliderProps) {
  const [internalValue, setInternalValue] = React.useState(value ?? min);
  const sliderId = id || `slider-${Math.random().toString(36).substr(2, 9)}`;

  const currentValue = value ?? internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const percentage = ((currentValue - min) / (max - min)) * 100;

  return (
    <div className={cn('relative w-full', className)}>
      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={handleChange}
        className="w-full h-1 bg-card border border-border-white-10 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--green) 0%, var(--green) ${percentage}%, rgba(255, 255, 255, 0.08) ${percentage}%, rgba(255, 255, 255, 0.08) 100%)`,
        }}
        {...props}
      />
      {marks && (
        <div className="relative mt-2" style={{ height: '16px' }}>
          {marks.map((mark) => {
            // Calculate the percentage position of this mark
            const markPercentage = ((mark - min) / (max - min)) * 100;
            return (
              <span
                key={mark}
                className="absolute text-xs text-text-muted-60 transform -translate-x-1/2"
                style={{ left: `${markPercentage}%` }}
              >
                {mark}x
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
