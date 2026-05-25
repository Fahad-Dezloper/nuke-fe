/**
 * Chart Service
 * Handles fetching chart data from the API
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';

/**
 * API Response Types
 */
export type ChartVenueKey = 'hyperliquid' | 'pacifica' | 'phoenix' | 'backpack' | 'lighter';

export interface ChartDataPoint {
  id: string;
  platform: ChartVenueKey;
  symbol: string;
  rate: number; // Hourly funding rate
  mark_px: number;
  timestamp: string;
}

export interface ChartApiResponse {
  hyperliquid: ChartDataPoint[];
  pacifica: ChartDataPoint[];
  phoenix?: ChartDataPoint[];
  backpack: ChartDataPoint[];
  lighter?: ChartDataPoint[];
}

/**
 * Convert hourly funding rate to yearly percentage
 */
function hourlyToYearlyPercentage(hourlyRate: number): number {
  // funding * 24 hours * 365 days * 100 (to convert to percentage)
  return hourlyRate * 24 * 365 * 100;
}

/**
 * Chart Service
 */
export type ChartTimeframe = '30m' | '1h' | '24h';

export const chartService = {
  /**
   * Fetch chart data for a specific asset and timeframe
   */
  async getChartData(
    assetName: string,
    timeframe: ChartTimeframe = '30m'
  ): Promise<ChartApiResponse> {
    try {
      const response = await apiClient.get<ChartApiResponse>(
        API_ENDPOINTS.market.chart(assetName, timeframe)
      );
      return {
        hyperliquid: response.hyperliquid ?? [],
        pacifica: response.pacifica ?? [],
        phoenix: response.phoenix ?? [],
        backpack: response.backpack ?? [],
        lighter: response.lighter ?? [],
      };
    } catch (error) {
      console.error(`Error fetching chart data for ${assetName} (${timeframe}):`, error);
      throw error;
    }
  },
};
