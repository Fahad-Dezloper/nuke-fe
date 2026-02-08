/**
 * Hook for fetching and transforming funding rate chart data
 */

import { useEffect, useState, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import {
  chartService,
  type ChartApiResponse,
  type ChartTimeframe,
} from '@/lib/api/services/chart.service';

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
    // Show HH:MM format for 30m and 1h timeframes
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } else if (timeframe === '24h') {
    // Show MM/DD format for 24h (daily) timeframe
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  }

  // Default to HH:MM
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
    // Round to nearest 30 minutes
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 30) * 30;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0, 0);
  } else if (timeframe === '1h') {
    // Round to nearest hour
    date.setMinutes(0);
    date.setSeconds(0, 0);
  } else if (timeframe === '24h') {
    // Round to nearest day (use the date, zero out time)
    date.setHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

export interface ChartDataPoint {
  dataIndex: number; // Unique sequential index for x-axis positioning
  time: string;
  fullTimestamp: string;
  hyperliquid: number | null; // Yearly percentage (null if data missing)
  pacifica: number | null; // Yearly percentage (null if data missing)
  hyperliquidRaw: number; // Raw hourly rate
  pacificaRaw: number; // Raw hourly rate
  projectedHyperliquid: number | null;
  projectedPacifica: number | null;
  // Additional data for tooltip
  longProtocol: 'hyperliquid' | 'pacifica';
  shortProtocol: 'hyperliquid' | 'pacifica';
  longRate: number;
  shortRate: number;
  netRate: number;
}

interface UseFundingRateChartOptions {
  timeframe?: ChartTimeframe;
  /** @deprecated Use timeframe instead */
  duration?: string;
}

export function useFundingRateChart(options: UseFundingRateChartOptions = {}) {
  const { timeframe = '30m' } = options;
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const [chartData, setChartData] = useState<ChartApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch chart data when asset or timeframe changes
  useEffect(() => {
    if (!selectedAsset?.asset) {
      setChartData(null);
      return;
    }

    let cancelled = false;

    async function fetchChartData() {
      setLoading(true);
      setError(null);
      try {
        const data = await chartService.getChartData(selectedAsset?.asset || '', timeframe);
        if (!cancelled) {
          setChartData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch chart data'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchChartData();

    return () => {
      cancelled = true;
    };
  }, [selectedAsset?.asset, timeframe]);

  // Transform chart data to match chart component format
  const transformedData = useMemo<ChartDataPoint[]>(() => {
    if (!chartData) return [];

    const { hyperliquid, pacifica } = chartData;

    // Create maps with normalized timestamps
    const hyperliquidMap = new Map<string, (typeof hyperliquid)[0]>();
    hyperliquid.forEach((item) => {
      const normalized = normalizeTimestamp(item.timestamp, timeframe);
      // Keep the most recent data point if multiple map to same bucket
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

    // Get all unique normalized timestamps and sort
    const allNormalizedTimestamps = new Set<string>();
    hyperliquidMap.forEach((_, key) => allNormalizedTimestamps.add(key));
    pacificaMap.forEach((_, key) => allNormalizedTimestamps.add(key));

    const sortedTimestamps = Array.from(allNormalizedTimestamps).sort();

    // Determine projection threshold (last 5% of data)
    const projectionThreshold = sortedTimestamps.length * 0.95;

    return sortedTimestamps.map((normalizedTimestamp, index) => {
      const hlData = hyperliquidMap.get(normalizedTimestamp);
      const pacData = pacificaMap.get(normalizedTimestamp);

      // Use the actual timestamp from the data (or normalized if not available)
      const displayTimestamp = hlData?.timestamp || pacData?.timestamp || normalizedTimestamp;

      // Convert hourly rates to yearly percentages
      const hlYearly = hlData ? hourlyToYearlyPercentage(hlData.rate) : null;
      const pacYearly = pacData ? hourlyToYearlyPercentage(pacData.rate) : null;

      // Determine LONG and SHORT based on funding rates
      let longProtocol: 'hyperliquid' | 'pacifica' = 'hyperliquid';
      let shortProtocol: 'hyperliquid' | 'pacifica' = 'pacifica';
      let longRate = 0;
      let shortRate = 0;
      let netRate = 0;

      if (hlYearly !== null && pacYearly !== null) {
        const isHyperliquidLower = hlYearly < pacYearly;
        longProtocol = isHyperliquidLower ? 'hyperliquid' : 'pacifica';
        shortProtocol = isHyperliquidLower ? 'pacifica' : 'hyperliquid';
        longRate = isHyperliquidLower ? hlYearly : pacYearly;
        shortRate = isHyperliquidLower ? pacYearly : hlYearly;
        netRate = shortRate - longRate;
      } else {
        longProtocol = 'hyperliquid';
        shortProtocol = 'pacifica';
        longRate = hlYearly ?? 0;
        shortRate = pacYearly ?? 0;
        netRate = Math.abs((hlYearly ?? 0) - (pacYearly ?? 0));
      }

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
        longProtocol,
        shortProtocol,
        longRate,
        shortRate,
        netRate,
      };
    });
  }, [chartData, timeframe]);

  return {
    data: transformedData,
    loading,
    error,
    asset: selectedAsset?.asset || null,
  };
}
