import { cn } from '@/lib/utils';

export interface MetricItemProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function MetricItem({ label, children, className }: MetricItemProps) {
  return (
    <div className={cn('flex flex-col gap-1 px-4 border-r border-border-white-10 py-3', className)}>
      <span className="text-[10px] text-text-muted-40 uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
