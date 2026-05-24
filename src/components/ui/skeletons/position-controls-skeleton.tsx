'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PositionControlsSkeletonProps {
  className?: string;
}

export function PositionControlsSkeleton({ className }: PositionControlsSkeletonProps) {
  return (
    <div
      className={cn(
        'w-full lg:w-[380px] xl:w-[420px] flex flex-col border border-border-white-10 bg-card rounded-sm',
        'ml-4 lg:shrink-0 h-full overflow-hidden mt-4',
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Asset Price Header skeleton */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-white-10">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-4.5 w-4.5 rounded-full bg-border-white-5" />
            <Skeleton className="h-4 w-10 bg-border-white-5" />
            <Skeleton className="h-3 w-8 bg-border-white-5" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24 bg-border-white-5" />
            <Skeleton className="h-3.5 w-12 bg-border-white-5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Margin section */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-12 bg-border-white-5" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-sm bg-border-white-5" />
              <Skeleton className="h-10 w-16 rounded-sm bg-border-white-5" />
            </div>
          </div>

          {/* Leverage section */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between">
              <Skeleton className="h-2.5 w-14 bg-border-white-5" />
              <Skeleton className="h-7 w-12 rounded-sm bg-border-white-5" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full bg-border-white-5" />
            <div className="flex justify-between px-1">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-2.5 w-4 bg-border-white-5" />
              ))}
            </div>
          </div>

          {/* Position Details */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-24 bg-border-white-5" />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2.5 p-3 border border-border-white-10 border-l-2 border-l-green/30 rounded-sm bg-background">
                <div className="flex justify-between">
                  <Skeleton className="h-2.5 w-8 bg-border-white-5" />
                  <Skeleton className="h-2.5 w-16 bg-border-white-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-10 bg-border-white-5" />
                    <Skeleton className="h-2.5 w-10 bg-border-white-5" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-8 bg-border-white-5" />
                    <Skeleton className="h-2.5 w-12 bg-border-white-5" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-3 border border-border-white-10 border-l-2 border-l-red/30 rounded-sm bg-background">
                <div className="flex justify-between">
                  <Skeleton className="h-2.5 w-10 bg-border-white-5" />
                  <Skeleton className="h-2.5 w-14 bg-border-white-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-10 bg-border-white-5" />
                    <Skeleton className="h-2.5 w-10 bg-border-white-5" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-8 bg-border-white-5" />
                    <Skeleton className="h-2.5 w-12 bg-border-white-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trade Details */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-20 bg-border-white-5" />
            <div className="border border-border-white-10 rounded-sm bg-background">
              <div className="px-3 py-2 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-2.5 w-20 bg-border-white-5" />
                  <Skeleton className="h-2.5 w-16 bg-border-white-5" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-2.5 w-14 bg-border-white-5" />
                  <Skeleton className="h-2.5 w-12 bg-border-white-5" />
                </div>
              </div>
              <div className="flex justify-center py-1.5 border-t border-border-white-10">
                <Skeleton className="h-2.5 w-10 bg-border-white-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-border-white-10">
          <Skeleton className="h-11 w-full rounded-sm bg-green/10" />
        </div>
      </div>
    </div>
  );
}
