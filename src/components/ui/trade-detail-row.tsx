/**
 * Trade Detail Row Component
 * Reusable component for displaying key-value pairs in trade details
 */

import { cn } from '@/lib/utils';

export interface TradeDetailRowProps {
  label: string;
  value: string | React.ReactNode;
  valueColor?: 'default' | 'green' | 'red' | 'muted';
  className?: string;
}

export function TradeDetailRow({
  label,
  value,
  valueColor = 'default',
  className,
}: TradeDetailRowProps) {
  const valueClass = {
    default: 'text-text-primary',
    green: 'text-green',
    red: 'text-red',
    muted: 'text-text-muted-40',
  }[valueColor];

  return (
    <div className={cn('flex items-center justify-between py-1', className)}>
      <span className="text-[10px] text-text-muted-40">{label}</span>
      <span className={cn('text-[10px] font-medium tabular-nums', valueClass)}>{value}</span>
    </div>
  );
}
