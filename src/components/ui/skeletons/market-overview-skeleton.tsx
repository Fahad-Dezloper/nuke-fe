'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketOverviewSkeletonProps {
  className?: string;
}

export function MarketOverviewSkeleton({ className }: MarketOverviewSkeletonProps) {
  return (
    <div className={cn('panel flex items-stretch min-h-[72px] overflow-hidden', className)}>
      <div className="flex items-center px-5 py-3 border-r border-border-white-10 gap-3 shrink-0">
        <Skeleton className="h-9 w-9 rounded-full bg-border-white-10" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 bg-border-white-10" />
          <Skeleton className="h-5 w-28 bg-border-white-10" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col justify-center gap-2 px-4 py-3 border-r border-border-white-10 shrink-0"
        >
          <Skeleton className="h-3 w-16 bg-border-white-10" />
          <Skeleton className="h-4 w-20 bg-border-white-10" />
        </div>
      ))}
      <div className="flex flex-col justify-center gap-2 px-5 py-3 ml-auto shrink-0">
        <Skeleton className="h-3 w-14 bg-border-white-10" />
        <Skeleton className="h-7 w-24 bg-border-white-10" />
      </div>
    </div>
  );
}
