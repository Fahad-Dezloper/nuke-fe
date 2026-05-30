/**
 * Metric Item Component
 * Reusable component for displaying labeled metrics
 */

import { cn } from '@/lib/utils';

export interface MetricItemProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function MetricItem({ label, children, className }: MetricItemProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1 rounded-md border border-border-white-10 bg-section-surface/50 px-3 py-2.5',
        'lg:w-[180px] lg:rounded-none lg:border-0 lg:border-l lg:border-l-border-white-10 lg:bg-transparent lg:py-4 lg:pl-8',
        className
      )}
    >
      <span className="text-xs text-text-muted-40 font-medium">
        {label}
      </span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
