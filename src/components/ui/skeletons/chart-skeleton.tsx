'use client';

/**
 * Chart Skeleton
 * Shows placeholder for the funding-rates chart section
 * Displayed while chart data loads for the first time
 */

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gradient-to-br from-background/80 via-card/40 to-background/80',
        'border border-border-white-10/50 rounded-2xl py-4 mt-4',
        'backdrop-blur-md shadow-xl shadow-black/30',
        className
      )}
    >
      {/* Tab bar skeleton */}
      <div className="flex items-center gap-6 border-b border-border-white-10 px-3 md:px-4 lg:px-5 pb-3">
        <Skeleton className="h-4 w-24 bg-border-white-5" />
        <Skeleton className="h-4 w-12 bg-border-white-5" />
      </div>

      {/* Chart area skeleton */}
      <div className="px-3 md:px-4 lg:px-5 pt-4 pb-4 flex-1">
        <div className="h-[260px] flex flex-col justify-between">
          {/* Y-axis labels + horizontal grid lines */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-10 shrink-0 bg-border-white-5" />
              <div className="flex-1 h-[1px] bg-border-white-5/50" />
            </div>
          ))}

          {/* Simulated bar chart at the bottom */}
          <div className="flex items-end gap-1.5 mt-2 h-24 px-12">
            {[40, 65, 35, 80, 55, 70, 45, 90, 60, 50, 75, 85, 55, 65, 40, 70, 50, 80, 60, 45].map(
              (h, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-t-sm bg-border-white-5"
                  style={{ height: `${h}%` }}
                />
              )
            )}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between px-12 mt-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-8 bg-border-white-5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
