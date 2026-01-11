'use client';

/**
 * Position Details Section Component
 * Cards showing LONG and SHORT position details
 */

import { cn } from '@/lib/utils';

interface PositionDetailsSectionProps {
  className?: string;
}

interface PositionCardProps {
  label: string;
  platform: string;
  gradientColor: 'hyperliquid' | 'lighter';
  margin: string;
  size: string;
}

function PositionCard({
  label,
  platform,
  gradientColor,
  margin,
  size,
}: PositionCardProps) {
  const gradientClass =
    gradientColor === 'hyperliquid'
      ? 'bg-gradient-to-br from-[var(--chart-hyperliquid)]/15 via-[var(--chart-hyperliquid)]/8 to-[var(--chart-hyperliquid)]/5'
      : 'bg-gradient-to-br from-[var(--chart-pink)]/15 via-[var(--chart-pink)]/8 to-[var(--chart-pink)]/5';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border border-border-white-10/50',
        'backdrop-blur-md bg-gradient-to-br',
        'shadow-lg shadow-black/20',
        gradientClass
      )}>
      <div className='flex items-center justify-between'>
        <span className='text-xs font-medium text-text-primary'>{label}</span>
        <span className='text-xs text-text-muted-60'>{platform}</span>
      </div>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='text-xs text-text-muted-60'>MARGIN</span>
          <span className='text-xs text-text-primary'>{margin}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-xs text-text-muted-60'>SIZE</span>
          <span className='text-xs text-text-primary'>{size}</span>
        </div>
      </div>
    </div>
  );
}

export function PositionDetailsSection({
  className,
}: PositionDetailsSectionProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
        POSITION DETAILS
      </label>
      <div className='grid grid-cols-2 gap-3'>
        <PositionCard
          label='LONG'
          platform='HYPERLIQUID'
          gradientColor='hyperliquid'
          margin='$0.00'
          size='-'
        />
        <PositionCard
          label='SHORT'
          platform='LIGHTER'
          gradientColor='lighter'
          margin='$0.00'
          size='-'
        />
      </div>
    </div>
  );
}
