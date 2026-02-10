/**
 * Mock Position Data
 * Centralized mock data for positions and trading
 */

import type { ArbitragePosition, PositionDetailsCard, TradeDetails } from '@/types/positions';

/**
 * Mock arbitrage positions data
 */
export const mockArbitragePositions: ArbitragePosition[] = [
  {
    asset: 'HYPE',
    leverage: '5x',
    assetLogo: '/tokens/hype.png',
    long: {
      platform: 'Hyperliquid',
    },
    short: {
      platform: 'Pacifica',
    },
    size: '893.23',
    apr: '21.9%',
    pricePnl: '$0.00',
    fundingPnl: {
      current: '-$0.00',
      estimated: '~+$0.0025 2m',
    },
    totalPnl: '-$0.00',
  },
  {
    asset: 'ETH',
    leverage: '10x',
    assetLogo: '/tokens/eth.png',
    long: {
      platform: 'Pacifica',
    },
    short: {
      platform: 'Hyperliquid',
    },
    size: '100.00',
    apr: '21.9%',
    pricePnl: '+$120.00',
    fundingPnl: {
      current: '-$0.00',
      estimated: '~+$0.0025 2m',
    },
    totalPnl: '+$120.00',
  },
];

/**
 * Mock position details cards
 */
export const mockPositionDetailsCards: PositionDetailsCard[] = [
  {
    label: 'LONG',
    platform: 'HYPERLIQUID',
    gradientColor: 'hyperliquid',
    margin: '$0.00',
    size: '-',
  },
  {
    label: 'SHORT',
    platform: 'PACIFICA',
    gradientColor: 'pacifica',
    margin: '$0.00',
    size: '-',
  },
];

/**
 * Mock trade details data
 */
export const mockTradeDetails: TradeDetails = {
  positionSize: '$10,000.00',
  margin: '$3,333.33',
  estimatedFees: '$2.50',
  liquidationPrice: {
    long: '$85,234.56',
    short: '$95,678.90',
  },
  entryPrice: {
    long: '$90,612.30',
    short: '$90,612.30',
  },
  fundingRate: {
    long: '+0.1095%',
    short: '+0.1139%',
  },
  estimatedAPR: '+257.1%',
  maxDrawdown: '-5.2%',
};
