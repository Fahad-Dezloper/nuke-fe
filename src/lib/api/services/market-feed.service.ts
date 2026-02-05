/**
 * Market Feed Service
 * Handles fetching and transforming market feed data from the API
 */

import { apiClient } from '../client';
import type { AssetDropdownItem } from '@/types/positions';

/**
 * API Response Types
 */
export interface MarketFeedApiResponse {
  symbol: string;
  hyperliquid: {
    mark_px: number;
    funding: number; // Hourly funding rate
    max_leverage: number;
  } | null;
  pacifica: {
    mark_px: number;
    funding: number; // Hourly funding rate
    max_leverage: number;
  } | null;
}

/**
 * Helper function to get asset logo path
 */
function getAssetLogo(symbol: string): string {
  const logoMap: Record<string, string> = {
    BTC: '/tokens/eth.png', // Placeholder - update with actual BTC logo
    ETH: '/tokens/eth.png',
    SOL: '/tokens/hype.png', // Placeholder
    HYPE: '/tokens/hype.png',
    GOAT: '/tokens/hype.png',
    IP: '/tokens/hype.png',
    LIT: '/tokens/hype.png',
    STRK: '/tokens/hype.png',
    TRX: '/tokens/hype.png',
    ENA: '/tokens/hype.png',
    TIA: '/tokens/hype.png',
    ZEC: '/tokens/hype.png',
    TRUMP: '/tokens/hype.png',
    GRASS: '/tokens/hype.png',
    BNB: '/tokens/hype.png',
    JUP: '/tokens/hype.png',
  };
  return logoMap[symbol] || '/tokens/hype.png';
}

/**
 * Convert hourly funding rate to yearly percentage
 */
function hourlyToYearlyPercentage(hourlyRate: number): number {
  // funding * 24 hours * 365 days * 100 (to convert to percentage)
  return hourlyRate * 24 * 365 * 100;
}

/**
 * Convert hourly funding rate to 30-day APR percentage
 */
function hourlyTo30DayAPR(hourlyRate: number): number {
  // funding * 24 hours * 30 days * 100 (to convert to percentage)
  return hourlyRate * 24 * 30 * 100;
}

/**
 * Transform API response to AssetDropdownItem format
 * Creates modular protocol structure for easy extension
 */
function transformMarketFeedData(apiData: MarketFeedApiResponse[]): AssetDropdownItem[] {
  return apiData
    .filter((item) => item.hyperliquid && item.pacifica) // Filter out items with null protocols
    .map((item) => {
      // TypeScript now knows these are not null after filter
      const hyperliquid = item.hyperliquid!;
      const pacifica = item.pacifica!;

      const hyperliquidYearly = hourlyToYearlyPercentage(hyperliquid.funding);
      const pacificaYearly = hourlyToYearlyPercentage(pacifica.funding);
      const hyperliquid30D = hourlyTo30DayAPR(hyperliquid.funding);
      const pacifica30D = hourlyTo30DayAPR(pacifica.funding);

      // Best pair logic: Long on lower funding rate, Short on higher funding rate
      // Net APR = (Short rate) - (Long rate) = (Higher rate) - (Lower rate)
      // This is always positive when there's an arbitrage opportunity
      const lowerRate = Math.min(hyperliquidYearly, pacificaYearly);
      const higherRate = Math.max(hyperliquidYearly, pacificaYearly);
      const netAPR = higherRate - lowerRate; // Always positive

      const lowerRate30D = Math.min(hyperliquid30D, pacifica30D);
      const higherRate30D = Math.max(hyperliquid30D, pacifica30D);
      const apr30D = higherRate30D - lowerRate30D; // Always positive

      // Use the minimum of the two max leverages
      const maxLeverage = Math.min(hyperliquid.max_leverage, pacifica.max_leverage);

      // Create modular protocol structure
      const protocols: Record<string, import('@/types/positions').ProtocolData> = {
        hyperliquid: {
          protocol: 'hyperliquid',
          markPx: hyperliquid.mark_px,
          fundingRate: hyperliquid.funding,
          fundingRateYearly: hyperliquidYearly,
          fundingRate30D: hyperliquid30D,
          maxLeverage: hyperliquid.max_leverage,
        },
        pacifica: {
          protocol: 'pacifica',
          markPx: pacifica.mark_px,
          fundingRate: pacifica.funding,
          fundingRateYearly: pacificaYearly,
          fundingRate30D: pacifica30D,
          maxLeverage: pacifica.max_leverage,
        },
      };

      return {
        asset: item.symbol,
        assetLogo: getAssetLogo(item.symbol),
        maxLeverage,
        protocols,
        // Legacy fields for backward compatibility
        hyperliquidFundingRate: hyperliquidYearly,
        pacificaFundingRate: pacificaYearly,
        netAPR,
        apr30D,
        markPx: hyperliquid.mark_px, // Use Hyperliquid mark price for sorting
        hyperliquidMarkPx: hyperliquid.mark_px,
        pacificaMarkPx: pacifica.mark_px,
      };
    });
}

/**
 * Market Feed Service
 */
export const marketFeedService = {
  /**
   * Fetch market feed data from API
   */
  async getMarketFeed(): Promise<AssetDropdownItem[]> {
    try {
      const response = await apiClient.get<MarketFeedApiResponse[]>('/aggregated/live/market-feed');

      return transformMarketFeedData(response);
    } catch (error) {
      console.error('Error fetching market feed:', error);
      throw error;
    }
  },
};
