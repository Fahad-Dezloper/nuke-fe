/**
 * APR Service
 * Fetches average APR data (7-day spread) from the backend CRON endpoint
 * This data updates once daily, so it only needs to be fetched once per session
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';

/**
 * Spread APR entry for a single asset
 */
export interface SpreadAprEntry {
  long_platform: 'hyperliquid' | 'pacifica';
  short_platform: 'hyperliquid' | 'pacifica';
  total_spread: number;
}

/**
 * Seven-day average APR per protocol for a single asset
 */
export type SevenDayAvgAprEntry = Partial<Record<'hyperliquid' | 'pacifica', number>>;

/**
 * Full API response from /aggregated/average/apr
 */
export interface AverageAprApiResponse {
  seven_day_avg_apr: Record<string, SevenDayAvgAprEntry>;
  seven_day_spread_apr: Record<string, SpreadAprEntry[]>;
}

/**
 * Processed spread APR data for a single asset (used in UI)
 */
export interface AssetSpreadApr {
  longPlatform: 'hyperliquid' | 'pacifica';
  shortPlatform: 'hyperliquid' | 'pacifica';
  totalSpread: number; // Weekly spread
  sevenDayApr: number; // Annualized: totalSpread * 52
}

/**
 * Map of asset symbol -> processed spread APR data
 */
export type SpreadAprMap = Record<string, AssetSpreadApr>;

/**
 * Transform raw API response into a convenient lookup map
 */
function transformSpreadAprData(response: AverageAprApiResponse): SpreadAprMap {
  const result: SpreadAprMap = {};

  for (const [asset, entries] of Object.entries(response.seven_day_spread_apr)) {
    if (entries.length > 0) {
      const entry = entries[0];
      result[asset] = {
        longPlatform: entry.long_platform,
        shortPlatform: entry.short_platform,
        totalSpread: entry.total_spread,
        sevenDayApr: entry.total_spread * 52, // Annualized from weekly
      };
    }
  }

  return result;
}

/**
 * APR Service
 */
export const aprService = {
  /**
   * Fetch average APR data from API
   * Called once per session (CRON updates daily)
   */
  async getAverageApr(): Promise<SpreadAprMap> {
    try {
      const response = await apiClient.get<AverageAprApiResponse>(
        API_ENDPOINTS.market.averageApr
      );
      return transformSpreadAprData(response);
    } catch (error) {
      console.error('Error fetching average APR:', error);
      throw error;
    }
  },
};
