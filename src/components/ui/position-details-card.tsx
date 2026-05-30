/**
 * Position Details Card Component
 * Reusable card component for displaying position details (LONG/SHORT)
 */

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PositionDetailsCard as PositionDetailsCardType } from '@/types/positions';

export interface PositionDetailsCardProps extends PositionDetailsCardType {
  className?: string;
  /** Optional existing exchange balance to show */
  existingBalance?: string;
  /** Show the "Add Margin" button */
  showAddMargin?: boolean;
  /** If true, render button disabled (non-clickable) */
  addMarginDisabled?: boolean;
  /** Called when user clicks "Add Margin" */
  onAddMargin?: () => void;
}

export function PositionDetailsCard({
  label,
  platform,
  gradientColor,
  margin,
  size,
  existingBalance,
  showAddMargin,
  addMarginDisabled,
  onAddMargin,
  className,
}: PositionDetailsCardProps) {
  const borderClass =
    gradientColor === 'long'
      ? 'border-l-2 border-l-[var(--green)]'
      : 'border-l-2 border-l-[var(--red)]';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-sm border border-border-white-10 bg-card',
        borderClass,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-muted-60">{platform}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted-60">MARGIN</span>
          <span className="text-xs text-text-primary">{margin}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted-60">SIZE</span>
          <span className="text-xs text-text-primary">{size}</span>
        </div>

        {existingBalance !== undefined && (
          <div className="flex items-center justify-between border-t-[0.5px] border-white/15 pt-2">
            <span className="text-xs text-text-muted-60 uppercase">Existing Mar.</span>
            <span className="text-xs text-text-muted-60">{existingBalance}</span>
          </div>
        )}

        {showAddMargin && (
          <button
            onClick={addMarginDisabled ? undefined : onAddMargin}
            disabled={!!addMarginDisabled}
            className={cn(
              'flex items-center justify-center gap-1.5 mt-1',
              'w-full py-1.5 rounded-lg',
              'text-[10px] font-medium tracking-wide',
              'bg-white/5 border border-border-white-10/40',
              addMarginDisabled
                ? 'text-text-muted-60/40 cursor-not-allowed opacity-60'
                : 'text-text-muted-60 hover:text-text-primary cursor-pointer hover:bg-white/10 hover:border-border-white-20/50',
              'transition-all duration-150'
            )}
          >
            <Plus className="w-3 h-3" />
            ADD MARGIN
          </button>
        )}
      </div>
    </div>
  );
}
