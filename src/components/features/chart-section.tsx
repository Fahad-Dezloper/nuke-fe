'use client';

/**
 * Chart Section Component
 * Contains the funding rates chart
 */

import { ChartSection } from './trading-dashboard';
import { FundingRatesChart } from './funding-rates-chart';
import { cn } from '@/lib/utils';

interface ChartSectionContentProps {
  className?: string;
}

export function ChartSectionContent({
  className,
}: ChartSectionContentProps) {
  return (
    <ChartSection className={className}>
      <FundingRatesChart className='h-full' />
    </ChartSection>
  );
}

