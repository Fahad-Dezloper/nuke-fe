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
    green: 'text-green-400',
    red: 'text-red-400',
    muted: 'text-text-muted-40',
  }[valueColor];

  return (
    <div className={cn('flex items-center justify-between py-1.5', className)}>
      <span className='text-xs text-text-muted-60'>{label}</span>
      <span className={cn('text-xs font-medium tabular-nums', valueClass)}>
        {value}
      </span>
    </div>
  );
}

