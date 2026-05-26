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
        'group relative flex w-full flex-col gap-1 rounded-md border border-border-white-10 bg-section-surface/50 px-3 py-2.5',
        'lg:w-[180px] lg:rounded-none lg:border-0 lg:border-l lg:border-l-border-white-10 lg:bg-transparent lg:py-4 lg:pl-8',
        className
      )}
    >
      {/* Subtle hover effect */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <span className="text-xs text-text-muted-60 uppercase tracking-wide font-medium">
        {label}
      </span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
