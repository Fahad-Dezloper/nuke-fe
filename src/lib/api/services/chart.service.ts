/**
 * Chart Service
 * Handles fetching chart data from the API
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';

/**
 * API Response Types
 */
export interface ChartDataPoint {
  id: string;
  platform: 'hyperliquid' | 'pacifica';
  symbol: string;
  rate: number; // Hourly funding rate
  mark_px: number;
  timestamp: string;
}

export interface ChartApiResponse {
  hyperliquid: ChartDataPoint[];
  pacifica: ChartDataPoint[];
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
export const chartService = {
  /**
   * Fetch chart data for a specific asset
   */
  async getChartData(assetName: string): Promise<ChartApiResponse> {
    try {
      const response = await apiClient.get<ChartApiResponse>(
        API_ENDPOINTS.market.chart(assetName)
      );
      return response;
    } catch (error) {
      console.error(`Error fetching chart data for ${assetName}:`, error);
      throw error;
    }
  },
};
