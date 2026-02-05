'use client';

/**
 * PnL Chart Component
 * Bar chart showing funding profit and loss
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  profit: {
    label: 'FUNDING PROFIT',
    color: '#22c55e',
  },
  loss: {
    label: 'FUNDING LOSS',
    color: '#ef4444',
  },
  projected: {
    label: 'PROJECTED FUNDING',
    color: '#22c55e',
  },
} satisfies ChartConfig;

interface PnLChartProps {
  data: Array<{
    time: string;
    value: number;
    profit: number;
    loss: number;
    projected: number | null;
  }>;
}

export function PnLChart({ data }: PnLChartProps) {
  // Transform data: use actual value (positive for profit, negative for loss)
  const transformedData = data.map((item, index) => ({
    ...item,
    pnl: item.value, // Positive = profit (up), Negative = loss (down)
    // For projected: show as separate value, hide regular pnl
    projectedValue: index > 160 && item.projected ? item.projected : null,
    pnlValue: index > 160 && item.projected ? null : item.value,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <BarChart
        data={transformedData}
        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        barCategoryGap="1%"
        barGap={0}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
        <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" strokeWidth={1} />
        <XAxis
          dataKey="time"
          tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
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
          tickFormatter={(value) => {
            if (value === 0) return '$0.0';
            return value > 0 ? `+$${value.toFixed(1)}` : `$${value.toFixed(1)}`;
          }}
          domain={[-2, 6]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent indicator="line" labelFormatter={(value) => `Time: ${value}`} />
          }
        />
        {/* Main PnL bars - colored based on value (green up, red down) */}
        <Bar dataKey="pnlValue" radius={0} barSize={6}>
          {transformedData.map((entry, index) => {
            // Color based on positive (green) or negative (red)
            return (
              <Cell
                key={`cell-${index}`}
                fill={entry.pnlValue && entry.pnlValue >= 0 ? '#22c55e' : '#ef4444'}
              />
            );
          })}
        </Bar>
        {/* Projected bars (green outline) */}
        <Bar
          dataKey="projectedValue"
          fill="transparent"
          stroke="#22c55e"
          strokeWidth={2}
          strokeDasharray="4 4"
          radius={0}
          barSize={6}
        />
        <ChartLegend
          content={() => (
            <div className="flex items-center justify-start gap-6 pt-3 px-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-text-muted-60">FUNDING PROFIT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs text-text-muted-60">FUNDING LOSS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 border-2 border-dashed border-green-400" />
                <span className="text-xs text-text-muted-60">PROJECTED FUNDING</span>
              </div>
            </div>
          )}
        />
      </BarChart>
    </ChartContainer>
  );
}
