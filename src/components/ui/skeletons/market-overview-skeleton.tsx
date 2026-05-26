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
    <div className="flex w-full flex-col gap-1.5 rounded-md border border-border-white-10 px-3 py-2.5 lg:w-[180px] lg:rounded-none lg:border-0 lg:border-l lg:pl-8 lg:py-4">
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
        <div className="flex flex-col gap-3 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-6 lg:py-0">
          <div className="relative z-[10000] w-full sm:w-auto">
            <div className="flex min-w-[140px] items-center gap-2 rounded-md border border-border-white-10/50 bg-card/40 px-3 py-1.5">
              <Skeleton className="h-5 w-5 rounded-full bg-border-white-5" />
              <Skeleton className="h-4 w-12 bg-border-white-5" />
              <Skeleton className="ml-auto h-3.5 w-3.5 bg-border-white-5" />
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-1 lg:flex-wrap lg:gap-6">
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
