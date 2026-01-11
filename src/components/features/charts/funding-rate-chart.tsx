'use client';

/**
 * Funding Rate Chart Component
 * Line chart comparing funding rates between Hyperliquid and Lighter
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  hyperliquid: {
    label: 'HYPERLIQUID (LONG)',
    color: 'var(--chart-hyperliquid)',
  },
  lighter: {
    label: 'LIGHTER (SHORT)',
    color: 'var(--chart-pink)',
  },
  projected: {
    label: 'PROJECTED',
    color: '#ffffff',
  },
} satisfies ChartConfig;

interface FundingRateChartProps {
  data: Array<{
    time: string;
    hyperliquid: number;
    lighter: number;
    projectedHyperliquid: number | null;
    projectedLighter: number | null;
  }>;
}

export function FundingRateChart({ data }: FundingRateChartProps) {
  return (
    <ChartContainer config={chartConfig} className='h-[300px] w-full'>
      <LineChart
        data={data}
        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray='3 3'
          stroke='rgba(255, 255, 255, 0.1)'
          vertical={false}
        />
        <XAxis
          dataKey='time'
          tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval='preserveStartEnd'
          minTickGap={30}
          tickFormatter={(value) => {
            // If it's a date format (MM/DD), show as is
            if (value.includes('/')) {
              return value;
            }
            // If it's time format, show every 6 hours
            const hour = parseInt(value.split(':')[0]);
            return hour % 6 === 0 ? value : '';
          }}
        />
        <YAxis
          tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(0)}%`}
          domain={[-60, 120]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator='line'
              labelFormatter={(value) => `Time: ${value}`}
            />
          }
        />
        <Line
          type='monotone'
          dataKey='hyperliquid'
          stroke='var(--chart-hyperliquid)'
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type='monotone'
          dataKey='lighter'
          stroke='var(--chart-pink)'
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type='monotone'
          dataKey='projectedHyperliquid'
          stroke='var(--chart-hyperliquid)'
          strokeWidth={2}
          strokeDasharray='5 5'
          dot={false}
          connectNulls={false}
        />
        <Line
          type='monotone'
          dataKey='projectedLighter'
          stroke='var(--chart-pink)'
          strokeWidth={2}
          strokeDasharray='5 5'
          dot={false}
          connectNulls={false}
        />
        <ChartLegend
          content={() => (
            <div className='flex items-center justify-start gap-6 pt-3 px-4'>
              <div className='flex items-center gap-2'>
                <div
                  className='h-2 w-6'
                  style={{ backgroundColor: 'var(--chart-hyperliquid)' }}
                />
                <span className='text-xs text-text-muted-60'>
                  HYPERLIQUID (LONG)
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <div
                  className='h-2 w-6'
                  style={{ backgroundColor: 'var(--chart-pink)' }}
                />
                <span className='text-xs text-text-muted-60'>
                  LIGHTER (SHORT)
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <div
                  className='h-0.5 w-6 border-t-2 border-dashed'
                  style={{ borderColor: '#ffffff' }}
                />
                <span className='text-xs text-text-muted-60'>PROJECTED</span>
              </div>
            </div>
          )}
        />
      </LineChart>
    </ChartContainer>
  );
}

