/**
 * Mock Trading Data
 * Centralized mock data for trading operations and market data
 */

import type { AssetPrice, MarketOverviewData } from '@/types/positions';

/**
 * Mock asset price data
 */
export const mockAssetPrice: AssetPrice = {
  asset: 'HYPE-PERP',
  assetLogo: '/tokens/hype.png',
  currentPrice: 45.3,
  priceChange: -0.02,
};

/**
 * Mock market overview data
 */
export const mockMarketOverview: MarketOverviewData = {
  asset: 'HYPE-PERP',
  currentPrice: 45.3,
  longFundingRate: 10.95,
  shortFundingRate: 11.39,
  estimatedAPY: 0.44,
};

/**
 * Mock effective APR
 */
export const mockEffectiveAPR = 257.1;

/**
 * Mock currency conversion rate (example: USD to LINEA/HYPE)
 */
export const mockConversionRate = 0.05; // 1 USD = 0.05 LINEA/HYPE

/**
 * Mock step size for position
 */
export const mockStepSize = 100; // HYPE

