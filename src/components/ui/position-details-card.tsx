import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PositionDetailsCard as PositionDetailsCardType } from '@/types/positions';

export interface PositionDetailsCardProps extends PositionDetailsCardType {
  className?: string;
  existingBalance?: string;
  showAddMargin?: boolean;
  addMarginDisabled?: boolean;
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
  const isLong = gradientColor === 'long';

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 p-3 rounded-sm border border-border-white-10 bg-background',
        isLong ? 'border-l-2 border-l-green' : 'border-l-2 border-l-red',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', isLong ? 'text-green' : 'text-red')}>
          {label}
        </span>
        <span className="text-[10px] text-text-muted-40 uppercase">{platform}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted-40 uppercase">Margin</span>
          <span className="text-xs tabular-nums text-text-primary">{margin}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted-40 uppercase">Size</span>
          <span className="text-xs tabular-nums text-text-primary">{size}</span>
        </div>

        {existingBalance !== undefined && (
          <div className="flex items-center justify-between pt-1.5 border-t border-border-white-10">
            <span className="text-[10px] text-text-muted-40 uppercase">Balance</span>
            <span className="text-[10px] tabular-nums text-text-muted-60">{existingBalance}</span>
          </div>
        )}

        {showAddMargin && (
          <button
            onClick={addMarginDisabled ? undefined : onAddMargin}
            disabled={!!addMarginDisabled}
            className={cn(
              'flex items-center justify-center gap-1 mt-0.5 w-full py-1.5 rounded-sm text-[10px] font-medium tracking-wide border transition-colors',
              addMarginDisabled
                ? 'border-border-white-10 text-text-muted-40 cursor-not-allowed opacity-50'
                : 'border-border-white-10 text-text-muted-60 hover:text-text-primary hover:border-border-white-20 cursor-pointer'
            )}
          >
            <Plus className="w-2.5 h-2.5" />
            ADD MARGIN
          </button>
        )}
      </div>
    </div>
  );
}
