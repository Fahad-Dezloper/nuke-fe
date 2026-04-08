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
  backpack: {
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
    .filter((item) => {
      const protocols = [item.hyperliquid, item.pacifica, item.backpack].filter(Boolean);
      return protocols.length >= 2; // Need at least 2 venues to form a hedge
    })
    .map((item) => {
      const protocols: Record<string, import('@/types/positions').ProtocolData> = {};

      if (item.hyperliquid) {
        const yearly = hourlyToYearlyPercentage(item.hyperliquid.funding);
        const apr30d = hourlyTo30DayAPR(item.hyperliquid.funding);
        protocols.hyperliquid = {
          protocol: 'hyperliquid',
          markPx: item.hyperliquid.mark_px,
          fundingRate: item.hyperliquid.funding,
          fundingRateYearly: yearly,
          fundingRate30D: apr30d,
          maxLeverage: item.hyperliquid.max_leverage,
        };
      }
      if (item.pacifica) {
        const yearly = hourlyToYearlyPercentage(item.pacifica.funding);
        const apr30d = hourlyTo30DayAPR(item.pacifica.funding);
        protocols.pacifica = {
          protocol: 'pacifica',
          markPx: item.pacifica.mark_px,
          fundingRate: item.pacifica.funding,
          fundingRateYearly: yearly,
          fundingRate30D: apr30d,
          maxLeverage: item.pacifica.max_leverage,
        };
      }
      if (item.backpack) {
        const yearly = hourlyToYearlyPercentage(item.backpack.funding);
        const apr30d = hourlyTo30DayAPR(item.backpack.funding);
        protocols.backpack = {
          protocol: 'backpack',
          markPx: item.backpack.mark_px,
          fundingRate: item.backpack.funding,
          fundingRateYearly: yearly,
          fundingRate30D: apr30d,
          maxLeverage: item.backpack.max_leverage,
        };
      }

      const ratesYearly = Object.values(protocols).map((p) => p.fundingRateYearly);
      const rates30d = Object.values(protocols).map((p) => p.fundingRate30D);

      const lowerRate = Math.min(...ratesYearly);
      const higherRate = Math.max(...ratesYearly);
      const netAPR = higherRate - lowerRate;

      const lowerRate30D = Math.min(...rates30d);
      const higherRate30D = Math.max(...rates30d);
      const apr30D = higherRate30D - lowerRate30D;

      const maxLeverage = Math.min(...Object.values(protocols).map((p) => p.maxLeverage));

      return {
        asset: item.symbol,
        assetLogo: getAssetLogo(item.symbol),
        maxLeverage,
        protocols,
        // Legacy fields for backward compatibility
        hyperliquidFundingRate: protocols.hyperliquid?.fundingRateYearly ?? 0,
        pacificaFundingRate: protocols.pacifica?.fundingRateYearly ?? 0,
        netAPR,
        apr30D,
        markPx:
          protocols.hyperliquid?.markPx ??
          protocols.pacifica?.markPx ??
          protocols.backpack?.markPx ??
          0,
        hyperliquidMarkPx: protocols.hyperliquid?.markPx,
        pacificaMarkPx: protocols.pacifica?.markPx,
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
