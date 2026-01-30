/**
 * Hook for fetching and transforming funding rate chart data
 */

import { useEffect, useState, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { chartService, type ChartApiResponse } from '@/lib/api/services/chart.service';

/**
 * Convert hourly funding rate to yearly percentage
 */
function hourlyToYearlyPercentage(hourlyRate: number): number {
  return hourlyRate * 24 * 365 * 100;
}

/**
 * Format timestamp to chart time label based on duration
 */
function formatTimeLabel(timestamp: string, duration: string): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Format time based on duration
  if (duration === '1 Hour') {
    // Show HH:MM format
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } else if (duration === '1 Day') {
    // Show MM/DD HH:MM format
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } else if (duration === '1 Week') {
    // Show MM/DD format
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

export interface ChartDataPoint {
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
  duration?: string;
}

export function useFundingRateChart(options: UseFundingRateChartOptions = {}) {
  const { duration = '1 Week' } = options;
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const [chartData, setChartData] = useState<ChartApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch chart data when asset changes
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
        const data = await chartService.getChartData(selectedAsset?.asset || '');
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
  }, [selectedAsset?.asset]);

  // Transform chart data to match chart component format
  const transformedData = useMemo<ChartDataPoint[]>(() => {
    if (!chartData) return [];

    const { hyperliquid, pacifica } = chartData;

    // Filter data based on duration
    const durationMap: Record<string, number> = {
      '1 Hour': 1 / 24, // 1 hour in days
      '1 Day': 1,
      '1 Week': 7,
    };

    const daysToShow = durationMap[duration] || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToShow);

    // Filter data points within the duration
    const filteredHyperliquid = hyperliquid.filter((item) => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= cutoffDate;
    });

    const filteredPacifica = pacifica.filter((item) => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= cutoffDate;
    });

    // Group timestamps by time buckets based on duration
    // This helps match timestamps that are close but not identical
    const normalizeTimestamp = (timestamp: string): string => {
      const date = new Date(timestamp);

      if (duration === '1 Hour') {
        // Round to nearest minute for 1 hour view
        date.setSeconds(0, 0);
      } else if (duration === '1 Day') {
        // Round to nearest 5 minutes for 1 day view
        const minutes = date.getMinutes();
        const roundedMinutes = Math.floor(minutes / 5) * 5;
        date.setMinutes(roundedMinutes);
        date.setSeconds(0, 0);
      } else {
        // Round to nearest hour for 1 week view
        date.setMinutes(0);
        date.setSeconds(0, 0);
      }

      return date.toISOString();
    };

    // Create maps with normalized timestamps
    const hyperliquidMap = new Map<string, typeof filteredHyperliquid[0]>();
    filteredHyperliquid.forEach((item) => {
      const normalized = normalizeTimestamp(item.timestamp);
      // Keep the most recent data point if multiple map to same bucket
      const existing = hyperliquidMap.get(normalized);
      if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
        hyperliquidMap.set(normalized, item);
      }
    });

    const pacificaMap = new Map<string, typeof filteredPacifica[0]>();
    filteredPacifica.forEach((item) => {
      const normalized = normalizeTimestamp(item.timestamp);
      // Keep the most recent data point if multiple map to same bucket
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
      // Only convert if data exists, otherwise use null (chart will handle gaps)
      const hlYearly = hlData ? hourlyToYearlyPercentage(hlData.rate) : null;
      const pacYearly = pacData ? hourlyToYearlyPercentage(pacData.rate) : null;

      // Determine LONG and SHORT based on funding rates (lower = LONG, higher = SHORT)
      // Only calculate if both rates exist
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
        netRate = shortRate - longRate; // Always positive
      } else {
        // If only one platform has data, we can't determine LONG/SHORT properly
        // Use default values but the tooltip will handle this
        longProtocol = 'hyperliquid';
        shortProtocol = 'pacifica';
        longRate = hlYearly ?? 0;
        shortRate = pacYearly ?? 0;
        netRate = Math.abs((hlYearly ?? 0) - (pacYearly ?? 0));
      }

      const isProjected = index >= projectionThreshold;

      return {
        time: formatTimeLabel(displayTimestamp, duration),
        fullTimestamp: formatFullTimestamp(displayTimestamp),
        hyperliquid: hlYearly ?? null, // Keep null for missing data
        pacifica: pacYearly ?? null, // Keep null for missing data
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
  }, [chartData, duration]);

  return {
    data: transformedData,
    loading,
    error,
    asset: selectedAsset?.asset || null,
  };
}
