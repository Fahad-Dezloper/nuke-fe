/**
 * Mock Asset Data
 * Centralized mock data for asset dropdown and selection
 */

import type { AssetDropdownItem } from '@/types/positions';

/**
 * Mock assets for dropdown
 * Based on the funding rate arbitrage table data
 */
export const mockAssets: AssetDropdownItem[] = [
  {
    asset: 'BTC-PERP',
    assetLogo: '/tokens/eth.png', // Using ETH as placeholder, update with actual BTC logo
    maxLeverage: 25,
    hyperliquidFundingRate: 10.92,
    lighterFundingRate: 11.39,
    netAPY: 0.47,
    apy30D: 0.47,
  },
  {
    asset: 'GOAT',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: -203.7,
    lighterFundingRate: 11.4,
    netAPY: 215.1,
    apy30D: 10.4,
  },
  {
    asset: 'IP',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: -448.2,
    lighterFundingRate: -269.8,
    netAPY: 178.4,
    apy30D: 29.7,
  },
  {
    asset: 'LIT',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: 109.2,
    lighterFundingRate: 11.4,
    netAPY: 97.8,
    apy30D: 42.9,
  },
  {
    asset: 'STRK',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 15.3,
    lighterFundingRate: 12.8,
    netAPY: 2.5,
    apy30D: 8.2,
  },
  {
    asset: 'TRX',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 20,
    hyperliquidFundingRate: 8.5,
    lighterFundingRate: 9.2,
    netAPY: 0.7,
    apy30D: 5.1,
  },
  {
    asset: 'ENA',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 12.4,
    lighterFundingRate: 11.9,
    netAPY: 0.5,
    apy30D: 6.3,
  },
  {
    asset: 'TIA',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 14.2,
    lighterFundingRate: 13.5,
    netAPY: 0.7,
    apy30D: 7.8,
  },
  {
    asset: 'ZEC',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 9.8,
    lighterFundingRate: 10.1,
    netAPY: 0.3,
    apy30D: 4.2,
  },
  {
    asset: 'TRUMP',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: 18.5,
    lighterFundingRate: 17.2,
    netAPY: 1.3,
    apy30D: 12.4,
  },
  {
    asset: 'GRASS',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: 11.2,
    lighterFundingRate: 10.8,
    netAPY: 0.4,
    apy30D: 5.6,
  },
  {
    asset: 'BNB',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 25,
    hyperliquidFundingRate: 7.5,
    lighterFundingRate: 8.1,
    netAPY: 0.6,
    apy30D: 3.9,
  },
  {
    asset: 'HYPE-PERP',
    assetLogo: '/tokens/hype.png',
    maxLeverage: 5,
    hyperliquidFundingRate: 10.95,
    lighterFundingRate: 11.39,
    netAPY: 0.44,
    apy30D: 8.5,
  },
  {
    asset: 'ETH',
    assetLogo: '/tokens/eth.png',
    maxLeverage: 20,
    hyperliquidFundingRate: 9.2,
    lighterFundingRate: 9.8,
    netAPY: 0.6,
    apy30D: 4.5,
  },
];

