'use client';

/**
 * Funding Rates Chart Component
 * Main chart container with tabs and controls
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DASHBOARD_SECTION_SHELL } from './trading-dashboard';
import { ChartTabs, PnLChart, FundingRateChart, type ChartTab } from './charts';
import type { PnLDuration } from './charts/pnl-chart';
import { useFundingRateChart } from '@/hooks/use-funding-rate-chart';
import { ChartSkeleton } from '@/components/ui/skeletons';
import type { ChartTimeframe } from '@/lib/api/services/chart.service';
import { ChevronDown } from 'lucide-react';

const TIMEFRAME_OPTIONS: { value: ChartTimeframe; label: string }[] = [
  { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '1 Day' },
];

const PNL_DURATION_OPTIONS: { value: PnLDuration; label: string }[] = [
  { value: '1D', label: '1 Day' },
  { value: '1W', label: '1 Week' },
  { value: '1M', label: '1 Month' },
];

interface FundingRatesChartProps {
  className?: string;
  /** Fill available height on mobile tab views */
  fluidHeight?: boolean;
}

const CHART_HEIGHT_FIXED = 'h-[260px]';
const CHART_HEIGHT_FLUID = 'h-full min-h-[220px] flex-1';

export function FundingRatesChart({ className, fluidHeight }: FundingRatesChartProps) {
  const chartHeight = fluidHeight ? CHART_HEIGHT_FLUID : CHART_HEIGHT_FIXED;
  const [activeTab, setActiveTab] = useState<ChartTab>('funding');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('30m');
  const [pnlDuration, setPnlDuration] = useState<PnLDuration>('1D');

  // Funding rate chart data (uses user-selected timeframe)
  const {
    data: fundingData,
    loading: fundingLoading,
    error: fundingError,
  } = useFundingRateChart({ timeframe });

  // PnL chart data — always uses 1h timeframe for hourly candles
  const { data: pnlFundingData, loading: pnlLoading } = useFundingRateChart({ timeframe: '1h' });

  const isInitialLoad = fundingLoading && (!fundingData || fundingData.length === 0);
  if (isInitialLoad) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        DASHBOARD_SECTION_SHELL,
        'flex h-full min-h-0 w-full max-w-full min-w-0 flex-col overflow-hidden py-1 sm:py-3',
        fluidHeight && 'flex-1',
        className
      )}
    >
      {/* Tabs + Controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-white-10 px-2 sm:px-3 md:px-4 lg:px-5">
        <ChartTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="min-w-0 flex-1 border-b-0 px-0"
          compact
        />

        <div className="shrink-0">
          {activeTab === 'funding' && (
            <TimeframeDropdown value={timeframe} onChange={setTimeframe} />
          )}
          {activeTab === 'pnl' && (
            <DurationDropdown value={pnlDuration} onChange={setPnlDuration} />
          )}
        </div>
      </div>

      {/* Chart Content */}
      <div
        className={cn(
          'flex w-full min-w-0 flex-col overflow-hidden px-2 pb-2 sm:px-3 md:px-4 lg:px-5 sm:pb-4',
          fluidHeight && 'min-h-0 flex-1'
        )}
      >
        {activeTab === 'pnl' && (
          <>
            {pnlLoading && (!pnlFundingData || pnlFundingData.length === 0) ? (
              <div
                className={cn(
                  chartHeight,
                  'flex items-center justify-center text-text-muted-60 text-xs'
                )}
              >
                Loading PnL data...
              </div>
            ) : (
              <PnLChart fundingData={pnlFundingData} duration={pnlDuration} chartClassName={chartHeight} />
            )}
          </>
        )}
        {activeTab === 'funding' && (
          <>
            {fundingLoading && (
              <div
                className={cn(chartHeight, 'flex items-center justify-center text-text-muted-60')}
              >
                Loading chart data...
              </div>
            )}
            {fundingError && (
              <div className={cn(chartHeight, 'flex items-center justify-center text-red-400')}>
                Error loading chart data: {fundingError.message}
              </div>
            )}
            {!fundingLoading && !fundingError && (
              <FundingRateChart
                data={fundingData}
                timeframe={timeframe}
                chartClassName={chartHeight}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Dropdown Components ---

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
    <GenericDropdown
      open={open}
      onOpenChange={setOpen}
      label={selectedLabel}
      options={TIMEFRAME_OPTIONS}
      value={value}
      onChange={(v) => {
        onChange(v as ChartTimeframe);
        setOpen(false);
      }}
    />
  );
}

function DurationDropdown({
  value,
  onChange,
}: {
  value: PnLDuration;
  onChange: (d: PnLDuration) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = PNL_DURATION_OPTIONS.find((o) => o.value === value)?.label ?? value;

  return (
    <GenericDropdown
      open={open}
      onOpenChange={setOpen}
      label={selectedLabel}
      options={PNL_DURATION_OPTIONS}
      value={value}
      onChange={(v) => {
        onChange(v as PnLDuration);
        setOpen(false);
      }}
    />
  );
}

function GenericDropdown<T extends string>({
  open,
  onOpenChange,
  label,
  options,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
          'bg-card/40 border border-border-white-10/50',
          'text-text-muted-60 hover:text-text-primary hover:border-border-white-20',
          'transition-all duration-200 select-none'
        )}
      >
        {label}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => onOpenChange(false)} />
          <div
            className={cn(
              'absolute right-0 top-full mt-1 z-[101]',
              'min-w-[100px] py-1 rounded-md',
              'bg-background/95 backdrop-blur-xl border border-border-white-20/50',
              'shadow-xl shadow-black/40'
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
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
