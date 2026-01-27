/**
 * Position Types
 * Shared type definitions for positions and trading data
 */

/**
 * Platform information for long/short positions
 * Uses protocol ID (lowercase) for consistency
 */
export interface PlatformInfo {
  platform: string; // Protocol ID (e.g., 'hyperliquid', 'pacifica', 'drift')
}

/**
 * Funding PnL information
 */
export interface FundingPnL {
  current: string;
  estimated: string;
}

/**
 * Protocol-specific position data for tooltips
 * Uses protocol ID as key for modularity
 */
export interface ProtocolPositionData {
  size: string;
  pnl: string;
  funding: string;
}

/**
 * Protocol data map for positions
 * Key is protocol ID (lowercase), value is position data
 */
export type ProtocolDataMap = Record<string, ProtocolPositionData | null>;

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
  // Protocol-specific data for tooltips
  // Uses protocol ID as key for modularity (e.g., 'hyperliquid', 'pacifica', 'drift')
  protocolData?: ProtocolDataMap;
}

/**
 * Position Details Card Data
 * Used in position details section
 */
export interface PositionDetailsCard {
  label: string;
  platform: string;
  gradientColor: 'long' | 'short';
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
 * Protocol-specific data for an asset
 * Modular structure to support multiple protocols
 */
export interface ProtocolData {
  protocol: string; // 'hyperliquid' | 'pacifica' | etc.
  markPx: number; // Mark price
  fundingRate: number; // Hourly funding rate
  fundingRateYearly: number; // Yearly funding rate (percentage)
  fundingRate30D: number; // 30-day APR (percentage)
  maxLeverage: number;
}

/**
 * Asset Dropdown Data
 * Complete asset information for dropdown selection
 * Modular structure supporting multiple protocols
 */
export interface AssetDropdownItem {
  asset: string;
  assetLogo: string;
  maxLeverage: number; // Minimum across all protocols
  protocols: Record<string, ProtocolData>; // Protocol name -> ProtocolData
  // Legacy fields for backward compatibility (derived from protocols)
  hyperliquidFundingRate: number;
  pacificaFundingRate: number;
  netAPR: number;
  apr30D: number;
  markPx?: number; // Primary mark price (from first protocol)
  hyperliquidMarkPx?: number;
  pacificaMarkPx?: number;
}

