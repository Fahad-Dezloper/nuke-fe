/**
 * Mock Asset Data
 * Centralized mock data for asset dropdown and selection
 */

import type { AssetDropdownItem } from '@/types/positions';

/**
 * Mock assets for dropdown
 * Based on the funding rate arbitrage table data
 * Updated to use Pacifica instead of Lighter
 */
export const mockAssets: Partial<AssetDropdownItem>[] = [
  {
    asset: 'BTC',
    assetLogo: '/tokens/eth.png', // Using ETH as placeholder, update with actual BTC logo
    maxLeverage: 25,
    hyperliquidFundingRate: 10.92,
    pacificaFundingRate: 11.39,
    netAPR: 0.47,
    apr30D: 0.47,
  },
  {
    asset: 'ETH',
    assetLogo: '/tokens/eth.png',
    maxLeverage: 20,
    hyperliquidFundingRate: 9.2,
    pacificaFundingRate: 9.8,
    netAPR: 0.6,
    apr30D: 4.5,
  },
  {
    asset: 'SOL',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 20,
    hyperliquidFundingRate: 8.5,
    pacificaFundingRate: 9.2,
    netAPR: 0.7,
    apr30D: 5.1,
  },
  {
    asset: 'GOAT',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: -203.7,
    pacificaFundingRate: 11.4,
    netAPR: 215.1,
    apr30D: 10.4,
  },
  {
    asset: 'IP',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: -448.2,
    pacificaFundingRate: -269.8,
    netAPR: 178.4,
    apr30D: 29.7,
  },
  {
    asset: 'LIT',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: 109.2,
    pacificaFundingRate: 11.4,
    netAPR: 97.8,
    apr30D: 42.9,
  },
  {
    asset: 'STRK',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 15.3,
    pacificaFundingRate: 12.8,
    netAPR: 2.5,
    apr30D: 8.2,
  },
  {
    asset: 'TRX',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 20,
    hyperliquidFundingRate: 8.5,
    pacificaFundingRate: 9.2,
    netAPR: 0.7,
    apr30D: 5.1,
  },
  {
    asset: 'ENA',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 12.4,
    pacificaFundingRate: 11.9,
    netAPR: 0.5,
    apr30D: 6.3,
  },
  {
    asset: 'TIA',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 14.2,
    pacificaFundingRate: 13.5,
    netAPR: 0.7,
    apr30D: 7.8,
  },
  {
    asset: 'ZEC',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 10,
    hyperliquidFundingRate: 9.8,
    pacificaFundingRate: 10.1,
    netAPR: 0.3,
    apr30D: 4.2,
  },
  {
    asset: 'TRUMP',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: 18.5,
    pacificaFundingRate: 17.2,
    netAPR: 1.3,
    apr30D: 12.4,
  },
  {
    asset: 'GRASS',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 5,
    hyperliquidFundingRate: 11.2,
    pacificaFundingRate: 10.8,
    netAPR: 0.4,
    apr30D: 5.6,
  },
  {
    asset: 'BNB',
    assetLogo: '/tokens/hype.png', // Placeholder
    maxLeverage: 25,
    hyperliquidFundingRate: 7.5,
    pacificaFundingRate: 8.1,
    netAPR: 0.6,
    apr30D: 3.9,
  },
  {
    asset: 'HYPE-PERP',
    assetLogo: '/tokens/hype.png',
    maxLeverage: 5,
    hyperliquidFundingRate: 10.95,
    pacificaFundingRate: 11.39,
    netAPR: 0.44,
    apr30D: 8.5,
  },
];
