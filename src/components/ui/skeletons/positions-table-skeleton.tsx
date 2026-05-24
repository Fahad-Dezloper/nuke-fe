'use client';

/**
 * Positions Table Skeleton
 * Shows placeholder for the positions table section
 * Displayed while positions are loading for the first time
 */

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PositionsTableSkeletonProps {
  className?: string;
  /** Number of placeholder rows to render (default 3) */
  rows?: number;
}

/** Single row skeleton matching the positions table grid */
function PositionRowSkeleton() {
  return (
    <div className="px-4 md:px-6 py-2.5 border-b border-border-white-10/30 last:border-0">
      <div className="grid grid-cols-[minmax(100px,1fr)_minmax(180px,1.5fr)_minmax(70px,0.8fr)_minmax(70px,0.8fr)_minmax(90px,1fr)_minmax(110px,1.2fr)_minmax(90px,1fr)_40px] gap-3 lg:gap-4 items-center max-w-full">
        {/* Asset */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full bg-border-white-5" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-10 bg-border-white-5" />
            <Skeleton className="h-2.5 w-6 bg-border-white-5" />
          </div>
        </div>
        {/* Long / Short badges */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-24 rounded-sm bg-border-white-5" />
          <Skeleton className="h-5 w-24 rounded-sm bg-border-white-5" />
        </div>
        {/* Size */}
        <Skeleton className="h-3 w-12 bg-border-white-5" />
        {/* APR */}
        <Skeleton className="h-3 w-10 bg-border-white-5" />
        {/* Price PnL */}
        <Skeleton className="h-3 w-14 bg-border-white-5" />
        {/* Funding PnL */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-14 bg-border-white-5" />
          <Skeleton className="h-2.5 w-10 bg-border-white-5" />
        </div>
        {/* Total PnL */}
        <Skeleton className="h-3 w-14 bg-border-white-5" />
        {/* Close button */}
        <Skeleton className="h-5 w-5 rounded-sm bg-border-white-5 ml-auto" />
      </div>
    </div>
  );
}

export function PositionsTableSkeleton({ className, rows = 3 }: PositionsTableSkeletonProps) {
  return (
    <div
      className={cn(
        'border rounded-sm border-border-white-5 bg-background h-full flex flex-col overflow-hidden',
        className
      )}
    >
      <div className="flex flex-col h-full overflow-hidden py-4">
        {/* Tabs skeleton */}
        <div className="flex items-center justify-between border-b border-border-white-10 px-3 md:px-4 lg:px-5 pb-3 shrink-0">
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-28 bg-border-white-5" />
            <Skeleton className="h-4 w-16 bg-border-white-5" />
          </div>
        </div>

        {/* Table header skeleton */}
        <div className="sticky top-0 z-[1] px-4 md:px-6 py-3 border-b border-border-white-10/50 bg-card shrink-0">
          <div className="grid grid-cols-[minmax(100px,1fr)_minmax(180px,1.5fr)_minmax(70px,0.8fr)_minmax(70px,0.8fr)_minmax(90px,1fr)_minmax(110px,1.2fr)_minmax(90px,1fr)_40px] gap-3 lg:gap-4 max-w-full">
            {['w-12', 'w-20', 'w-8', 'w-8', 'w-16', 'w-20', 'w-16', 'w-0'].map((w, i) => (
              <Skeleton key={i} className={cn('h-3 bg-border-white-5', w)} />
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {[...Array(rows)].map((_, i) => (
            <PositionRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
