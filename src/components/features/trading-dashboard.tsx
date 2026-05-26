'use client';

/**
 * Trading Dashboard Layout
 * Main layout component that arranges chart, positions table, and position controls
 */

import { cn } from '@/lib/utils';

/** Subtle panel chrome shared by chart, positions table, and position panel. */
export const DASHBOARD_SECTION_SHELL =
  'bg-section-surface border border-border-white-10/70 rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.35)]';

interface TradingDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export function TradingDashboard({ className, children }: TradingDashboardProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 overflow-hidden p-2 sm:p-3 md:gap-0 md:p-0 lg:flex-row lg:gap-4 lg:pt-4',
        className
      )}
    >
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
  return <div className={cn('flex-1 flex flex-col min-h-0', className)}>{children}</div>;
}

/**
 * Positions Table Section Component
 * Below the chart - shows positions/closed tabs
 */
interface PositionsTableSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function PositionsTableSection({ className, children }: PositionsTableSectionProps) {
  return (
    <div
      className={cn(
        DASHBOARD_SECTION_SHELL,
        'h-full flex flex-col overflow-hidden min-h-0',
        className
      )}
    >
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
  /** Flat layout for mobile trade tab (no panel chrome) */
  embedded?: boolean;
}

export function PositionControlsSection({
  className,
  children,
  embedded,
}: PositionControlsSectionProps) {
  return (
    <div
      className={cn(
        !embedded && DASHBOARD_SECTION_SHELL,
        'flex w-full flex-col backdrop-blur-sm lg:w-[400px] xl:w-[450px]',
        embedded && 'bg-section-surface',
        className
      )}
    >
      {children}
    </div>
  );
}
