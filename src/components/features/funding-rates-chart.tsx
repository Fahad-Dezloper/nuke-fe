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
  generateFundingRateData,
  generatePnLData,
  generateCumulativePnLData,
  type ChartTab,
} from './charts';
import { useFundingRateChart } from '@/hooks/use-funding-rate-chart';

interface FundingRatesChartProps {
  className?: string;
}

export function FundingRatesChart({ className }: FundingRatesChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('funding');
  // Hardcode duration to 1 Hour for now
  const duration = '1 Hour';

  // Use real API data for funding rate chart
  const {
    data: fundingData,
    loading: fundingLoading,
    error: fundingError,
  } = useFundingRateChart({ duration });

  // Keep mock data for other charts (using default resolution for compatibility)
  const pnlData = useMemo(
    () => generatePnLData(duration, '1 Hour'),
    [duration]
  );
  const cumulativeData = useMemo(
    () => generateCumulativePnLData(duration, '1 Hour'),
    [duration]
  );

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gradient-to-br from-background/80 via-card/40 to-background/80',
        'border border-border-white-10/50 rounded-2xl py-4 mt-4',
        'backdrop-blur-md shadow-xl shadow-black/30',
        className
      )}>
      {/* Tabs */}
      <ChartTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Chart Controls - Removed for now, hardcoded to 1 Hour */}

      {/* Chart Content */}
      <div className='px-3 md:px-4 lg:px-5 pb-4'>
        {activeTab === 'pnl' && <PnLChart data={pnlData} />}
        {activeTab === 'cumulative' && (
          <CumulativePnLChart data={cumulativeData} />
        )}
        {activeTab === 'funding' && (
          <>
            {fundingLoading && (
              <div className='h-[260px] flex items-center justify-center text-text-muted-60'>
                Loading chart data...
              </div>
            )}
            {fundingError && (
              <div className='h-[260px] flex items-center justify-center text-red-400'>
                Error loading chart data: {fundingError.message}
              </div>
            )}
            {!fundingLoading && !fundingError && (
              <FundingRateChart data={fundingData} duration={duration} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
