'use client';

/**
 * Position Details Section Component
 * Cards showing LONG and SHORT position details
 */

import { cn } from '@/lib/utils';
import { PositionDetailsCard } from '@/components/ui/position-details-card';
import { mockPositionDetailsCards } from '@/lib/mocks';

interface PositionDetailsSectionProps {
  className?: string;
  cards?: typeof mockPositionDetailsCards;
}

export function PositionDetailsSection({
  className,
  cards = mockPositionDetailsCards,
}: PositionDetailsSectionProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
        POSITION DETAILS
      </label>
      <div className='grid grid-cols-2 gap-3'>
        {cards.map((card) => (
          <PositionDetailsCard
            key={card.label}
            {...card}
          />
        ))}
      </div>
    </div>
  );
}
