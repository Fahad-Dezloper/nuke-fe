'use client';

/**
 * Funding Rates Chart Component
 * Main chart container with tabs and controls
 */

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ChartTabs,
  ChartControls,
  PnLChart,
  CumulativePnLChart,
  FundingRateChart,
  generateFundingRateData,
  generatePnLData,
  generateCumulativePnLData,
  type ChartTab,
} from './charts';

interface FundingRatesChartProps {
  className?: string;
}

export function FundingRatesChart({ className }: FundingRatesChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('funding');
  const [duration, setDuration] = useState('1 Week');
  const [resolution, setResolution] = useState('1 Hour');

  const fundingData = useMemo(
    () => generateFundingRateData(duration, resolution),
    [duration, resolution]
  );
  const pnlData = useMemo(
    () => generatePnLData(duration, resolution),
    [duration, resolution]
  );
  const cumulativeData = useMemo(
    () => generateCumulativePnLData(duration, resolution),
    [duration, resolution]
  );

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gradient-to-br from-background via-card/30 to-background',
        'border-[0.5px] border-border-white-10 py-4 mt-4',
        className
      )}>
      {/* Tabs */}
      <ChartTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Chart Controls */}
      <ChartControls
        duration={duration}
        resolution={resolution}
        onDurationChange={setDuration}
        onResolutionChange={setResolution}
      />

      {/* Chart Content */}
      <div className='px-3 md:px-4 lg:px-5 pb-4'>
        {activeTab === 'pnl' && <PnLChart data={pnlData} />}
        {activeTab === 'cumulative' && (
          <CumulativePnLChart data={cumulativeData} />
        )}
        {activeTab === 'funding' && <FundingRateChart data={fundingData} />}
      </div>
    </div>
  );
}
