'use client';

/**
 * Trading Dashboard Layout
 * Main layout component that arranges chart, positions table, and position controls
 */

import { cn } from '@/lib/utils';

interface TradingDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export function TradingDashboard({
  className,
  children,
}: TradingDashboardProps) {
  return (
    <div
      className={cn(
        'flex flex-col lg:flex-row gap-0 h-full overflow-hidden',
        className
      )}>
      {children}
    </div>
  );
}

/**
 * Chart Section Component
 * Left side - contains the chart area
 */
interface ChartSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function ChartSection({ className, children }: ChartSectionProps) {
  return (
    <div className={cn('flex-1 flex flex-col bg-background', className)}>
      {children}
    </div>
  );
}

/**
 * Positions Table Section Component
 * Below the chart - shows positions/closed tabs
 */
interface PositionsTableSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function PositionsTableSection({
  className,
  children,
}: PositionsTableSectionProps) {
  return (
    <div
      className={cn(
        'border-t border-border-white-10 bg-background',
        className
      )}>
      {children}
    </div>
  );
}

/**
 * Position Controls Section Component
 * Right side - contains position controls panel
 */
interface PositionControlsSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function PositionControlsSection({
  className,
  children,
}: PositionControlsSectionProps) {
  return (
    <div
      className={cn(
        'w-full lg:w-[400px] xl:w-[450px] flex flex-col border border-border-white-10 bg-background',
        className
      )}>
      {children}
    </div>
  );
}
