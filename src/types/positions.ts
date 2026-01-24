/**
 * Position Types
 * Shared type definitions for positions and trading data
 */

/**
 * Platform information for long/short positions
 */
export interface PlatformInfo {
  platform: string;
}

/**
 * Funding PnL information
 */
export interface FundingPnL {
  current: string;
  estimated: string;
}

/**
 * Arbitrage Position Data
 * Used in positions table and related components
 */
export interface ArbitragePosition {
  asset: string;
  leverage: string;
  assetLogo: string;
  long: PlatformInfo;
  short: PlatformInfo;
  size: string;
  apr: string;
  pricePnl: string;
  fundingPnl: FundingPnL;
  totalPnl: string;
}

/**
 * Position Details Card Data
 * Used in position details section
 */
export interface PositionDetailsCard {
  label: string;
  platform: string;
  gradientColor: 'hyperliquid' | 'pacifica';
  margin: string;
  size: string;
}

/**
 * Trade Details Data
 * Used in trade details section
 */
export interface TradeDetails {
  positionSize: string;
  margin: string;
  estimatedFees: string;
  liquidationPrice: {
    long: string;
    short: string;
  };
  entryPrice: {
    long: string;
    short: string;
  };
  fundingRate: {
    long: string;
    short: string;
  };
  estimatedAPR: string;
  maxDrawdown: string;
}

/**
 * Asset Price Data
 */
export interface AssetPrice {
  asset: string;
  assetLogo: string;
  currentPrice: number;
  priceChange: number;
}

/**
 * Market Overview Data
 */
export interface MarketOverviewData {
  asset: string;
  currentPrice: number;
  longFundingRate: number;
  shortFundingRate: number;
  estimatedAPY: number;
}

/**
 * Asset Dropdown Data
 * Complete asset information for dropdown selection
 */
export interface AssetDropdownItem {
  asset: string;
  assetLogo: string;
  maxLeverage: number;
  hyperliquidFundingRate: number;
  pacificaFundingRate: number; // Changed from lighterFundingRate
  netAPY: number;
  apy30D: number;
}

