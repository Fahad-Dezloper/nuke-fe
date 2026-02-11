'use client';

/**
 * Funding Rate Chart Component
 * Modular line chart comparing funding rates across protocols
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartLegend, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { ChartDataPoint } from '@/hooks/use-funding-rate-chart';
import type { ChartTimeframe } from '@/lib/api/services/chart.service';
import { getProtocolConfig, getAllProtocolIds } from '@/lib/protocols/config';

/**
 * Build chart config dynamically from protocol configurations
 */
function buildChartConfig(): ChartConfig {
  const config: ChartConfig = {
    projected: {
      label: 'PROJECTED',
      color: '#ffffff',
    },
  };

  // Add all protocols dynamically
  getAllProtocolIds().forEach((protocolId) => {
    const protocolConfig = getProtocolConfig(protocolId);
    if (protocolConfig) {
      config[protocolId] = {
        label: protocolConfig.displayName.toUpperCase(),
        color: `var(${protocolConfig.colorVar})`,
      };
    }
  });

  return config;
}

const chartConfig = buildChartConfig();

interface FundingRateChartProps {
  data: ChartDataPoint[];
  timeframe?: ChartTimeframe;
  /** @deprecated Use timeframe instead */
  duration?: string;
}

/**
 * Custom Tooltip Component
 */
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint; value?: number; name?: string }> }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload as ChartDataPoint;
  if (!data) return null;

  // Get protocol display names from config
  const longProtocolConfig = getProtocolConfig(data.longProtocol);
  const shortProtocolConfig = getProtocolConfig(data.shortProtocol);
  const longProtocolName = longProtocolConfig?.displayName || data.longProtocol;
  const shortProtocolName = shortProtocolConfig?.displayName || data.shortProtocol;

  // Format percentage with sign
  const formatPercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(4)}%`;
  };

  // Get all protocols with data dynamically
  const protocolsWithData = getAllProtocolIds()
    .map((protocolId) => {
      const protocolConfig = getProtocolConfig(protocolId);
      if (!protocolConfig) return null;

      // Get data value based on protocol ID
      let value: number | null = null;
      if (protocolId === 'hyperliquid') {
        value = data.hyperliquid;
      } else if (protocolId === 'pacifica') {
        value = data.pacifica;
      }
      // Future protocols can be added here

      if (value === null || value === undefined) return null;

      const isLong = data.longProtocol === protocolId;
      const isShort = data.shortProtocol === protocolId;
      const hasBothData = data.hyperliquid !== null && data.pacifica !== null;

      return {
        protocolId,
        displayName: protocolConfig.displayName,
        value,
        color: `var(${protocolConfig.colorVar})`,
        label: hasBothData
          ? isLong
            ? `${protocolConfig.displayName} (Long)`
            : isShort
              ? `${protocolConfig.displayName} (Short)`
              : protocolConfig.displayName
          : protocolConfig.displayName,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const hasBothData = data.hyperliquid !== null && data.pacifica !== null;

  return (
    <div className="rounded-lg border border-border-white-10 bg-card px-3 py-2 text-xs shadow-md">
      <div className="mb-2 text-text-muted-60">{data.fullTimestamp}</div>
      <div className="space-y-1">
        {protocolsWithData.map((protocol) => (
          <div key={protocol.protocolId} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: protocol.color,
              }}
            />
            <span className="text-text-muted-60">{protocol.label}:</span>
            <span className="font-medium" style={{ color: protocol.color }}>
              {formatPercent(protocol.value)}
            </span>
          </div>
        ))}
        {hasBothData && (
          <div className="flex items-center gap-2 pt-1 border-t border-border-white-10">
            <span className="text-text-muted-60">Net:</span>
            <span
              className={cn(
                'font-medium',
                data.netRate >= 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {formatPercent(data.netRate)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function FundingRateChart({ data, timeframe = '30m' }: FundingRateChartProps) {
  // Determine which protocol is LONG and which is SHORT based on the first data point
  const longProtocol = useMemo(() => {
    if (data.length === 0) return 'hyperliquid';
    return data[0].longProtocol;
  }, [data]);

  const shortProtocol = useMemo(() => {
    if (data.length === 0) return 'pacifica';
    return data[0].shortProtocol;
  }, [data]);

  // Get protocol display names from config
  const longProtocolConfig = getProtocolConfig(longProtocol);
  const shortProtocolConfig = getProtocolConfig(shortProtocol);
  const longProtocolName =
    longProtocolConfig?.displayName.toUpperCase() || longProtocol.toUpperCase();
  const shortProtocolName =
    shortProtocolConfig?.displayName.toUpperCase() || shortProtocol.toUpperCase();

  // Calculate domain based on data (only include non-null values)
  // Dynamically get all protocol values
  const domain = useMemo(() => {
    if (data.length === 0) return [-60, 120];

    const allValues: number[] = [];
    data.forEach((d) => {
      // Add all protocol values dynamically
      getAllProtocolIds().forEach((protocolId) => {
        if (protocolId === 'hyperliquid') {
          if (d.hyperliquid !== null && d.hyperliquid !== undefined) allValues.push(d.hyperliquid);
          if (d.projectedHyperliquid !== null && d.projectedHyperliquid !== undefined)
            allValues.push(d.projectedHyperliquid);
        } else if (protocolId === 'pacifica') {
          if (d.pacifica !== null && d.pacifica !== undefined) allValues.push(d.pacifica);
          if (d.projectedPacifica !== null && d.projectedPacifica !== undefined)
            allValues.push(d.projectedPacifica);
        }
        // Future protocols can be added here
      });
    });

    if (allValues.length === 0) return [-60, 120];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1 || 10;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="h-[260px] w-full flex items-center justify-center text-text-muted-60">
        No data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
        <XAxis
          dataKey="dataIndex"
          type="number"
          domain={['dataMin', 'dataMax']}
          hide={timeframe !== '24h'}
          tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => {
            // For 24h, show the date label from the data point
            const point = data[value];
            return point?.time ?? '';
          }}
        />
        <YAxis
          tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(0)}%`}
          domain={domain}
        />
        <ChartTooltip content={<CustomTooltip />} />
        {/* Render lines dynamically for all protocols */}
        {getAllProtocolIds().flatMap((protocolId) => {
          const protocolConfig = getProtocolConfig(protocolId);
          if (!protocolConfig) return [];

          // Map protocol ID to data key (for now, only hyperliquid and pacifica are supported)
          const dataKey =
            protocolId === 'hyperliquid'
              ? 'hyperliquid'
              : protocolId === 'pacifica'
                ? 'pacifica'
                : null;
          const projectedDataKey =
            protocolId === 'hyperliquid'
              ? 'projectedHyperliquid'
              : protocolId === 'pacifica'
                ? 'projectedPacifica'
                : null;

          if (!dataKey || !projectedDataKey) return [];

          return [
            <Line
              key={protocolId}
              type="monotone"
              dataKey={dataKey}
              stroke={`var(${protocolConfig.colorVar})`}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />,
            <Line
              key={`${protocolId}-projected`}
              type="monotone"
              dataKey={projectedDataKey}
              stroke={`var(${protocolConfig.colorVar})`}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={false}
            />,
          ];
        })}
        <ChartLegend
          content={() => {
            const longConfig = getProtocolConfig(longProtocol);
            const shortConfig = getProtocolConfig(shortProtocol);

            return (
              <div className="flex items-center justify-start gap-6 pt-3 px-4">
                {longConfig && (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-6"
                      style={{ backgroundColor: `var(${longConfig.colorVar})` }}
                    />
                    <span className="text-xs text-text-muted-60">{longProtocolName}</span>
                  </div>
                )}
                {shortConfig && (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-6"
                      style={{ backgroundColor: `var(${shortConfig.colorVar})` }}
                    />
                    <span className="text-xs text-text-muted-60">{shortProtocolName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div
                    className="h-0.5 w-6 border-t-2 border-dashed"
                    style={{ borderColor: '#ffffff' }}
                  />
                  <span className="text-xs text-text-muted-60">PROJECTED</span>
                </div>
              </div>
            );
          }}
        />
      </LineChart>
    </ChartContainer>
  );
}
