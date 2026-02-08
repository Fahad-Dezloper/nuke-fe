'use client';

/**
 * Market Overview Skeleton
 * Shows placeholder for the asset dropdown trigger + metric items
 * Displayed while market feed data loads for the first time
 */

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketOverviewSkeletonProps {
  className?: string;
}

/** Mimics a single MetricItem with label + value */
function MetricItemSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 border-l-[0.5px] border-l-border-white-10 pl-8 py-4 w-[180px]">
      <Skeleton className="h-3 w-20 bg-border-white-5" />
      <Skeleton className="h-5 w-24 bg-border-white-5" />
    </div>
  );
}

export function MarketOverviewSkeleton({ className }: MarketOverviewSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-background via-background/98 to-background',
        'border-b-[0.5px] border-l-[0.5px] border-r-[0.5px] border-border-white-10',
        'relative',
        className
      )}
    >
      <div className="mx-auto px-3 md:px-4 lg:px-5 py-0 relative z-10">
        <div className="flex flex-wrap items-center gap-6 md:gap-8">
          {/* Asset Dropdown Trigger Skeleton */}
          <div className="relative z-[10000]">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card/40 border border-border-white-10/50 min-w-[140px]">
              <Skeleton className="h-5 w-5 rounded-full bg-border-white-5" />
              <Skeleton className="h-4 w-12 bg-border-white-5" />
              <Skeleton className="h-3.5 w-3.5 ml-auto bg-border-white-5" />
            </div>
          </div>

          {/* Metric Items Skeleton */}
          <div className="flex flex-wrap items-center gap-6 md:gap-8 flex-1">
            <MetricItemSkeleton />
            <MetricItemSkeleton />
            <MetricItemSkeleton />
            <MetricItemSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
