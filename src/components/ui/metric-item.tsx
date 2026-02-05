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
        'flex flex-col gap-1.5 border-l-[0.5px] border-l-border-white-10 pl-8 py-4 w-[180px] relative group',
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
