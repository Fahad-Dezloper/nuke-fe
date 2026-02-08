'use client';

/**
 * Funding Rates Chart Component
 * Main chart container with tabs and controls
 */

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ChartTabs,
  PnLChart,
  CumulativePnLChart,
  FundingRateChart,
  generatePnLData,
  generateCumulativePnLData,
  type ChartTab,
} from './charts';
import { useFundingRateChart } from '@/hooks/use-funding-rate-chart';
import { ChartSkeleton } from '@/components/ui/skeletons';
import type { ChartTimeframe } from '@/lib/api/services/chart.service';
import { ChevronDown } from 'lucide-react';

const TIMEFRAME_OPTIONS: { value: ChartTimeframe; label: string }[] = [
  { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '1 Day' },
];

interface FundingRatesChartProps {
  className?: string;
}

export function FundingRatesChart({ className }: FundingRatesChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('funding');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('30m');

  // Use real API data for funding rate chart
  const {
    data: fundingData,
    loading: fundingLoading,
    error: fundingError,
  } = useFundingRateChart({ timeframe });

  const pnlData = useMemo(() => generatePnLData('1 Hour', '1 Hour'), []);
  const cumulativeData = useMemo(() => generateCumulativePnLData('1 Hour', '1 Hour'), []);

  const isInitialLoad = fundingLoading && (!fundingData || fundingData.length === 0);
  if (isInitialLoad) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gradient-to-br from-background/80 via-card/40 to-background/80',
        'border border-border-white-10/50 rounded-2xl py-4 mt-4',
        'backdrop-blur-md shadow-xl shadow-black/30',
        className
      )}
    >
      {/* Tabs + Timeframe Dropdown */}
      <div className="flex items-center justify-between border-b border-border-white-10 px-3 md:px-4 lg:px-5">
        <ChartTabs activeTab={activeTab} onTabChange={setActiveTab} className="border-b-0" />

        {/* Timeframe Dropdown — only show for funding tab */}
        {activeTab === 'funding' && (
          <TimeframeDropdown value={timeframe} onChange={setTimeframe} />
        )}
      </div>

      {/* Chart Content */}
      <div className="px-3 md:px-4 lg:px-5 pb-4">
        {activeTab === 'pnl' && <PnLChart data={pnlData} />}
        {activeTab === 'cumulative' && <CumulativePnLChart data={cumulativeData} />}
        {activeTab === 'funding' && (
          <>
            {fundingLoading && (
              <div className="h-[260px] flex items-center justify-center text-text-muted-60">
                Loading chart data...
              </div>
            )}
            {fundingError && (
              <div className="h-[260px] flex items-center justify-center text-red-400">
                Error loading chart data: {fundingError.message}
              </div>
            )}
            {!fundingLoading && !fundingError && (
              <FundingRateChart data={fundingData} timeframe={timeframe} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Timeframe Dropdown Component
 */
function TimeframeDropdown({
  value,
  onChange,
}: {
  value: ChartTimeframe;
  onChange: (tf: ChartTimeframe) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = TIMEFRAME_OPTIONS.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
          'bg-card/40 border border-border-white-10/50',
          'text-text-muted-60 hover:text-text-primary hover:border-border-white-20',
          'transition-all duration-200 select-none'
        )}
      >
        {selectedLabel}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          {/* Invisible backdrop to close dropdown */}
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />

          <div
            className={cn(
              'absolute right-0 top-full mt-1 z-[101]',
              'min-w-[100px] py-1 rounded-lg',
              'bg-background/95 backdrop-blur-xl border border-border-white-20/50',
              'shadow-xl shadow-black/40'
            )}
          >
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs font-medium transition-colors',
                  option.value === value
                    ? 'text-accent bg-accent/10'
                    : 'text-text-muted-60 hover:text-text-primary hover:bg-card/30'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
