'use client';

import { cn } from '@/lib/utils';

interface TradingDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export function TradingDashboard({ className, children }: TradingDashboardProps) {
  return (
    <div
      className={cn(
        'flex flex-col lg:flex-row h-full min-h-0 overflow-hidden gap-3',
        className
      )}
    >
      {children}
    </div>
  );
}

interface ChartSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function ChartSection({ className, children }: ChartSectionProps) {
  return (
    <div className={cn('flex flex-col shrink-0 lg:shrink min-h-[280px] lg:min-h-0', className)}>
      {children}
    </div>
  );
}

interface PositionsTableSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function PositionsTableSection({ className, children }: PositionsTableSectionProps) {
  return (
    <div className={cn('panel flex flex-col overflow-hidden min-h-0', className)}>
      {children}
    </div>
  );
}

interface PositionControlsSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function PositionControlsSection({ className, children }: PositionControlsSectionProps) {
  return (
    <div
      className={cn(
        'w-full lg:w-[min(100%,380px)] xl:w-[400px] flex flex-col panel overflow-hidden lg:shrink-0 h-full min-h-0',
        className
      )}
    >
      {children}
    </div>
  );
}
