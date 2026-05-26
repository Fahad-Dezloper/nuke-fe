'use client';

/**
 * Position Controls (Panel) Skeleton
 * Full right-side panel skeleton with header, asset price, inputs, details, and CTA
 * Displayed while initial data is loading
 */

import { DASHBOARD_SECTION_SHELL } from '@/components/features/trading-dashboard';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PositionControlsSkeletonProps {
  className?: string;
}

export function PositionControlsSkeleton({ className }: PositionControlsSkeletonProps) {
  return (
    <div
      className={cn(
        DASHBOARD_SECTION_SHELL,
        'w-full lg:w-[400px] xl:w-[450px] flex flex-col backdrop-blur-sm',
        'ml-4 lg:shrink-0 h-full overflow-hidden mt-4',
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3 border-b border-border-white-10/70 bg-card/25 rounded-t-lg">
          <Skeleton className="h-4 w-28 bg-border-white-5" />
        </div>

        {/* Asset Price Header skeleton */}
        <div className="mx-4 mt-3 mb-4 px-4 py-3.5 bg-gradient-to-br from-card/60 via-card/40 to-card/30 backdrop-blur-xl border border-border-white-10/50 rounded-md shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full bg-border-white-5" />
              <Skeleton className="h-5 w-12 bg-border-white-5" />
            </div>
            <Skeleton className="h-5 w-24 bg-border-white-5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
          {/* Margin section */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-14 bg-border-white-5" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-md bg-border-white-5" />
              <Skeleton className="h-10 w-16 rounded-md bg-border-white-5" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-3 w-20 bg-border-white-5" />
            </div>
          </div>

          {/* Leverage section */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-16 bg-border-white-5" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-2 flex-1 rounded-full bg-border-white-5" />
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-12 rounded-md bg-border-white-5" />
                <Skeleton className="h-4 w-3 bg-border-white-5" />
              </div>
            </div>
            {/* Marks */}
            <div className="flex justify-between px-1">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-2.5 w-4 bg-border-white-5" />
              ))}
            </div>
          </div>

          {/* Position Details section */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-28 bg-border-white-5" />
            <div className="grid grid-cols-2 gap-3">
              {/* Long card */}
              <div className="flex flex-col gap-3 p-4 rounded-md border border-border-white-10/50 bg-gradient-to-br from-[var(--chart-hyperliquid)]/5 to-transparent">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-10 bg-border-white-5" />
                  <Skeleton className="h-3 w-20 bg-border-white-5" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12 bg-border-white-5" />
                    <Skeleton className="h-3 w-10 bg-border-white-5" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-8 bg-border-white-5" />
                    <Skeleton className="h-3 w-14 bg-border-white-5" />
                  </div>
                </div>
              </div>
              {/* Short card */}
              <div className="flex flex-col gap-3 p-4 rounded-md border border-border-white-10/50 bg-gradient-to-br from-[var(--chart-pink)]/5 to-transparent">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-10 bg-border-white-5" />
                  <Skeleton className="h-3 w-16 bg-border-white-5" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12 bg-border-white-5" />
                    <Skeleton className="h-3 w-10 bg-border-white-5" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-8 bg-border-white-5" />
                    <Skeleton className="h-3 w-14 bg-border-white-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trade Details section */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24 bg-border-white-5" />
            <div className="bg-gradient-to-br from-card/60 via-card/40 to-card/30 border border-border-white-10/50 rounded-md overflow-hidden backdrop-blur-md shadow-lg shadow-black/20">
              <div className="px-3 py-2.5 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20 bg-border-white-5" />
                  <Skeleton className="h-3 w-16 bg-border-white-5" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-14 bg-border-white-5" />
                  <Skeleton className="h-3 w-12 bg-border-white-5" />
                </div>
              </div>
              {/* View More button */}
              <div className="flex justify-center py-2 border-t border-border-white-10">
                <Skeleton className="h-3 w-16 bg-border-white-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer - CTA button skeleton */}
        <div className="px-4 md:px-6 pb-4 pt-3 border-t border-border-white-10/50 bg-gradient-to-t from-card/40 to-transparent backdrop-blur-sm rounded-b-lg">
          <Skeleton className="h-10 w-full rounded-md bg-border-white-5" />
        </div>
      </div>
    </div>
  );
}
