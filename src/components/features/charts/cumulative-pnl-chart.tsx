'use client';

/**
 * Cumulative PnL Chart Component
 * Area chart showing cumulative profit and loss over time
 */

import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  cumulative: {
    label: 'CUMULATIVE APR',
    color: '#22c55e',
  },
  initial: {
    label: 'INITIAL VALUE',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  projected: {
    label: 'PROJECTED',
    color: '#ffffff',
  },
} satisfies ChartConfig;

interface CumulativePnLChartProps {
  data: Array<{
    time: string;
    cumulative: number;
    initial: number;
    projected: number | null;
  }>;
}

export function CumulativePnLChart({ data }: CumulativePnLChartProps) {
  return (
    <ChartContainer
      config={chartConfig}
      className='h-[260px] w-full'>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient
            id='colorCumulative'
            x1='0'
            y1='0'
            x2='0'
            y2='1'>
            <stop
              offset='5%'
              stopColor='#22c55e'
              stopOpacity={0.3}
            />
            <stop
              offset='95%'
              stopColor='#22c55e'
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
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
            // If it's time format, show every 12 hours
            const hour = parseInt(value.split(':')[0]);
            return hour % 12 === 0 ? value : '';
          }}
        />
        <YAxis
          tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator='line'
              labelFormatter={(value) => `Time: ${value}`}
            />
          }
        />
        <Area
          type='monotone'
          dataKey='cumulative'
          stroke='#22c55e'
          strokeWidth={2}
          fill='url(#colorCumulative)'
        />
        <Line
          type='monotone'
          dataKey='initial'
          stroke='rgba(255, 255, 255, 0.5)'
          strokeWidth={1}
          strokeDasharray='5 5'
          dot={false}
        />
        <ChartLegend
          content={() => (
            <div className='flex items-center justify-start gap-6 pt-3 px-4'>
              <div className='flex items-center gap-2'>
                <div className='h-2 w-2 bg-green-500' />
                <span className='text-xs text-text-muted-60'>
                  CUMULATIVE APR
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='h-0.5 w-4 border-t border-dashed border-white/50' />
                <span className='text-xs text-text-muted-60'>
                  INITIAL VALUE
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='h-0.5 w-4 border-t border-dotted border-white/50' />
                <span className='text-xs text-text-muted-60'>PROJECTED</span>
              </div>
            </div>
          )}
        />
      </AreaChart>
    </ChartContainer>
  );
}
