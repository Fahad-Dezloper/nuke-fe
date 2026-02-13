/**
 * Position Details Card Component
 * Reusable card component for displaying position details (LONG/SHORT)
 */

import { cn } from '@/lib/utils';
import type { PositionDetailsCard as PositionDetailsCardType } from '@/types/positions';

export interface PositionDetailsCardProps extends PositionDetailsCardType {
  className?: string;
  /** Optional existing exchange balance to show */
  existingBalance?: string;
}

export function PositionDetailsCard({
  label,
  platform,
  gradientColor,
  margin,
  size,
  existingBalance,
  className,
}: PositionDetailsCardProps) {
  const gradientClass =
    gradientColor === 'long'
      ? 'bg-gradient-to-br from-[var(--chart-hyperliquid)]/15 via-[var(--chart-hyperliquid)]/8 to-[var(--chart-hyperliquid)]/5'
      : 'bg-gradient-to-br from-[var(--chart-pink)]/15 via-[var(--chart-pink)]/8 to-[var(--chart-pink)]/5'; // pacifica uses pink color

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border border-border-white-10/50',
        'backdrop-blur-md bg-gradient-to-br',
        'shadow-lg shadow-black/20',
        gradientClass,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-muted-60">{platform}</span>
      </div>
      <div className="flex flex-col gap-2">
        {existingBalance !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted-60/70">BALANCE</span>
            <span className="text-[10px] text-text-muted-60">{existingBalance}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted-60">MARGIN</span>
          <span className="text-xs text-text-primary">{margin}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted-60">SIZE</span>
          <span className="text-xs text-text-primary">{size}</span>
        </div>
      </div>
    </div>
  );
}
