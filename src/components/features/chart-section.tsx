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
  fluidHeight?: boolean;
}

export function ChartSectionContent({ className, fluidHeight }: ChartSectionContentProps) {
  return (
    <ChartSection className={className}>
      <FundingRatesChart className="h-full min-h-0" fluidHeight={fluidHeight} />
    </ChartSection>
  );
}
