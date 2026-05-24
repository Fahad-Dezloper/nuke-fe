'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChartTabs,
  PnLChart,
  FundingRateChart,
  type ChartTab,
} from './charts';
import type { PnLDuration } from './charts/pnl-chart';
import { useFundingRateChart } from '@/hooks/use-funding-rate-chart';
import { ChartSkeleton } from '@/components/ui/skeletons';
import type { ChartTimeframe } from '@/lib/api/services/chart.service';
import { ChevronDown } from 'lucide-react';

const TIMEFRAME_OPTIONS: { value: ChartTimeframe; label: string }[] = [
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
];

const PNL_DURATION_OPTIONS: { value: PnLDuration; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
];

interface FundingRatesChartProps {
  className?: string;
}

export function FundingRatesChart({ className }: FundingRatesChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('funding');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('30m');
  const [pnlDuration, setPnlDuration] = useState<PnLDuration>('1D');

  const {
    data: fundingData,
    loading: fundingLoading,
    error: fundingError,
  } = useFundingRateChart({ timeframe });

  const { data: pnlFundingData, loading: pnlLoading } = useFundingRateChart({
    timeframe: '1h',
  });

  const isInitialLoad = fundingLoading && (!fundingData || fundingData.length === 0);
  if (isInitialLoad) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div className={cn('panel flex flex-col h-full min-h-[280px] overflow-hidden', className)}>
      <div className="flex items-center justify-between panel-header shrink-0">
        <ChartTabs activeTab={activeTab} onTabChange={setActiveTab} className="border-b-0 px-0" />
        {activeTab === 'funding' && (
          <TimeframeDropdown value={timeframe} onChange={setTimeframe} />
        )}
        {activeTab === 'pnl' && (
          <DurationDropdown value={pnlDuration} onChange={setPnlDuration} />
        )}
      </div>

      <div className="flex-1 px-4 pb-4 pt-2 md:px-5 min-h-0">
        {activeTab === 'pnl' && (
          <>
            {pnlLoading && (!pnlFundingData || pnlFundingData.length === 0) ? (
              <div className="h-[240px] flex items-center justify-center text-text-muted-60 text-xs">
                Loading PnL data...
              </div>
            ) : (
              <PnLChart fundingData={pnlFundingData} duration={pnlDuration} />
            )}
          </>
        )}
        {activeTab === 'funding' && (
          <>
            {fundingLoading && (
              <div className="h-[240px] flex items-center justify-center text-text-muted-60 text-xs">
                Loading chart data...
              </div>
            )}
            {fundingError && (
              <div className="h-[240px] flex items-center justify-center text-red text-xs">
                Failed to load chart
              </div>
            )}
            {!fundingLoading && !fundingError && fundingData && (
              <FundingRateChart data={fundingData} timeframe={timeframe} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TimeframeDropdown({
  value,
  onChange,
}: {
  value: ChartTimeframe;
  onChange: (v: ChartTimeframe) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = TIMEFRAME_OPTIONS.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border-white-10 bg-secondary text-xs font-medium text-text-primary hover:border-border-white-20 cursor-pointer"
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 text-text-muted-60', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[88px] rounded-sm border border-border-white-10 bg-card py-1 shadow-xl">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-xs hover:bg-secondary cursor-pointer',
                  value === opt.value ? 'text-green' : 'text-text-primary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DurationDropdown({
  value,
  onChange,
}: {
  value: PnLDuration;
  onChange: (v: PnLDuration) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = PNL_DURATION_OPTIONS.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border-white-10 bg-secondary text-xs font-medium text-text-primary hover:border-border-white-20 cursor-pointer"
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 text-text-muted-60', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[88px] rounded-sm border border-border-white-10 bg-card py-1 shadow-xl">
            {PNL_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-xs hover:bg-secondary cursor-pointer',
                  value === opt.value ? 'text-green' : 'text-text-primary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
