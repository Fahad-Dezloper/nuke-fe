'use client';

/**
 * Chart Controls Component
 * Reusable controls for duration and resolution
 */

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartControlsProps {
  duration: string;
  onDurationChange: (duration: string) => void;
  className?: string;
}

export function ChartControls({
  duration,
  onDurationChange,
  className,
}: ChartControlsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-3 px-3 md:px-4 lg:px-5 pt-3 pb-2',
        className
      )}>
      {/* Duration Dropdown */}
      <div className='relative'>
        <select
          value={duration}
          onChange={(e) => onDurationChange(e.target.value)}
          className='appearance-none bg-card border border-border-white-10 rounded px-2.5 py-1 pr-7 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer'>
          <option>1 Hour</option>
          <option>1 Day</option>
          <option>1 Week</option>
        </select>
        <ChevronDown className='absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted-60 pointer-events-none' />
      </div>
    </div>
  );
}

