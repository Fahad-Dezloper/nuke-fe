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
/** Venue keys returned by `/aggregated/average/apr` (lowercase). */
export type AprVenueKey = 'hyperliquid' | 'pacifica' | 'backpack' | 'lighter';

export interface SpreadAprEntry {
  long_platform: AprVenueKey;
  short_platform: AprVenueKey;
  total_spread: number;
}

/**
 * Seven-day average APR per protocol for a single asset
 */
export type SevenDayAvgAprEntry = Partial<Record<AprVenueKey, number>>;

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
  longPlatform: AprVenueKey;
  shortPlatform: AprVenueKey;
  totalSpread: number; // Weekly spread
  sevenDayApr: number; // Annualized: totalSpread * 52
  /**
   * All spread pairs for the asset, sorted by total_spread desc (full API list).
   * Used to pick best pair when only a subset of exchanges is selected.
   */
  sortedSpreadPairs: SpreadAprEntry[];
  /**
   * Top 3 by total_spread (unfiltered). Prefer building from `sortedSpreadPairs` + selection in UI.
   */
  topPairs?: SpreadAprEntry[];
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
      // Pick the best pair (max total_spread) rather than assuming ordering.
      const sorted = [...entries].sort((a, b) => b.total_spread - a.total_spread);
      const entry = sorted[0]!;
      result[asset] = {
        longPlatform: entry.long_platform,
        shortPlatform: entry.short_platform,
        totalSpread: entry.total_spread,
        sevenDayApr: entry.total_spread * 52, // Annualized from weekly
        sortedSpreadPairs: sorted,
        topPairs: sorted.slice(0, 3),
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
