/**
 * Hook for fetching and transforming funding rate chart data.
 *
 * Uses React Query for data fetching (automatic cancellation, caching).
 * Heavy transformation is kept in useMemo for render efficiency.
 */

'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import { getBestPair } from '@/hooks/use-best-pair';
import {
  chartService,
  type ChartApiResponse,
  type ChartTimeframe,
} from '@/lib/api/services/chart.service';
import { queryKeys } from '@/lib/query-keys';

/**
 * Convert hourly funding rate to yearly percentage
 */
function hourlyToYearlyPercentage(hourlyRate: number): number {
  return hourlyRate * 24 * 365 * 100;
}

/**
 * Format timestamp to chart time label based on timeframe
 */
function formatTimeLabel(timestamp: string, timeframe: ChartTimeframe): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const day = date.getDate();
  const month = date.getMonth() + 1;

  if (timeframe === '30m' || timeframe === '1h') {
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } else if (timeframe === '24h') {
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  }

  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Format full timestamp for tooltip
 */
function formatFullTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

/**
 * Normalize timestamps for bucketing based on timeframe
 */
function normalizeTimestamp(timestamp: string, timeframe: ChartTimeframe): string {
  const date = new Date(timestamp);

  if (timeframe === '30m') {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 30) * 30;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0, 0);
  } else if (timeframe === '1h') {
    date.setMinutes(0);
    date.setSeconds(0, 0);
  } else if (timeframe === '24h') {
    date.setHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

export interface ChartDataPoint {
  dataIndex: number;
  time: string;
  fullTimestamp: string;
  hyperliquid: number | null;
  pacifica: number | null;
  hyperliquidRaw: number;
  pacificaRaw: number;
  projectedHyperliquid: number | null;
  projectedPacifica: number | null;
  longProtocol: 'hyperliquid' | 'pacifica';
  shortProtocol: 'hyperliquid' | 'pacifica';
  longRate: number;
  shortRate: number;
  netRate: number;
}

interface UseFundingRateChartOptions {
  timeframe?: ChartTimeframe;
}

/**
 * Transform raw chart API response into renderable data points.
 * Extracted as a pure function for testability.
 */
function transformChartData(
  chartData: ChartApiResponse,
  timeframe: ChartTimeframe,
  consistentLong: 'hyperliquid' | 'pacifica',
  consistentShort: 'hyperliquid' | 'pacifica'
): ChartDataPoint[] {
  const { hyperliquid, pacifica } = chartData;

  const hyperliquidMap = new Map<string, (typeof hyperliquid)[0]>();
  hyperliquid.forEach((item) => {
    const normalized = normalizeTimestamp(item.timestamp, timeframe);
    const existing = hyperliquidMap.get(normalized);
    if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
      hyperliquidMap.set(normalized, item);
    }
  });

  const pacificaMap = new Map<string, (typeof pacifica)[0]>();
  pacifica.forEach((item) => {
    const normalized = normalizeTimestamp(item.timestamp, timeframe);
    const existing = pacificaMap.get(normalized);
    if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
      pacificaMap.set(normalized, item);
    }
  });

  const allNormalizedTimestamps = new Set<string>();
  hyperliquidMap.forEach((_, key) => allNormalizedTimestamps.add(key));
  pacificaMap.forEach((_, key) => allNormalizedTimestamps.add(key));

  const sortedTimestamps = Array.from(allNormalizedTimestamps).sort();
  const projectionThreshold = sortedTimestamps.length * 0.95;

  return sortedTimestamps.map((normalizedTimestamp, index) => {
    const hlData = hyperliquidMap.get(normalizedTimestamp);
    const pacData = pacificaMap.get(normalizedTimestamp);
    const displayTimestamp = hlData?.timestamp || pacData?.timestamp || normalizedTimestamp;

    const hlYearly = hlData ? hourlyToYearlyPercentage(hlData.rate) : null;
    const pacYearly = pacData ? hourlyToYearlyPercentage(pacData.rate) : null;

    const longRate = consistentLong === 'hyperliquid' ? (hlYearly ?? 0) : (pacYearly ?? 0);
    const shortRate = consistentShort === 'hyperliquid' ? (hlYearly ?? 0) : (pacYearly ?? 0);
    const netRate = shortRate - longRate;
    const isProjected = index >= projectionThreshold;

    return {
      dataIndex: index,
      time: formatTimeLabel(displayTimestamp, timeframe),
      fullTimestamp: formatFullTimestamp(displayTimestamp),
      hyperliquid: hlYearly ?? null,
      pacifica: pacYearly ?? null,
      hyperliquidRaw: hlData?.rate || 0,
      pacificaRaw: pacData?.rate || 0,
      projectedHyperliquid: isProjected && hlData ? (hlYearly ?? null) : null,
      projectedPacifica: isProjected && pacData ? (pacYearly ?? null) : null,
      longProtocol: consistentLong,
      shortProtocol: consistentShort,
      longRate,
      shortRate,
      netRate,
    };
  });
}

export function useFundingRateChart(options: UseFundingRateChartOptions = {}) {
  const { timeframe = '30m' } = options;
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const spreadAprData = useAtomValue(spreadAprDataAtom);

  const assetName = selectedAsset?.asset ?? '';

  const query = useQuery({
    queryKey: queryKeys.chart.fundingRate(assetName, timeframe),
    queryFn: () => chartService.getChartData(assetName, timeframe),
    enabled: !!assetName,
    staleTime: 30_000, // Chart data refreshes every 30s
  });

  // Transform chart data (memoized — only recomputes when inputs change)
  const transformedData = useMemo<ChartDataPoint[]>(() => {
    if (!query.data) return [];

    const bestPair = getBestPair(selectedAsset, spreadAprData);
    return transformChartData(query.data, timeframe, bestPair.long, bestPair.short);
  }, [query.data, timeframe, selectedAsset, spreadAprData]);

  return {
    data: transformedData,
    loading: query.isLoading,
    error: query.error,
    asset: assetName || null,
  };
}
