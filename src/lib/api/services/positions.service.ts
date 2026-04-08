/**
 * Positions Service
 * Handles fetching and transforming positions data from the API
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import type { ArbitragePosition, ProtocolPositionData, ProtocolDataMap } from '@/types/positions';

/**
 * API Response Types
 */
export interface PositionApiResponse {
  symbol: string;
  hyperliquid: {
    symbol: string;
    size: string;
    side: 'Long' | 'Short';
    pnl: string;
    funding: string;
    margin: string;
    leverage: number;
    liquidationPrice: string;
  } | null;
  pacifica: {
    symbol: string;
    size: string;
    side: 'Long' | 'Short';
    pnl: string;
    funding: string;
    margin: string;
    leverage: number;
    liquidationPrice: string;
  } | null;
  backpack: {
    symbol: string;
    size: string;
    side: 'Long' | 'Short';
    pnl: string;
    funding: string;
    margin: string;
    leverage: number;
    liquidationPrice: string;
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
 * Format number as currency
 */
function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';

  const sign = num >= 0 ? '+' : '';
  return `${sign}$${num.toFixed(2)}`;
}

/**
 * Format number as percentage
 */
function formatPercentage(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${num.toFixed(1)}%`;
}

/**
 * Transform API response to ArbitragePosition format
 * Exported for use in hooks and testing
 */
export function transformPositionData(apiData: PositionApiResponse): ArbitragePosition {
  const { symbol, hyperliquid, pacifica, backpack } = apiData;

  // Determine which protocol has long and short positions
  // Normalize protocol names to lowercase IDs for consistency
  const longProtocolId =
    hyperliquid?.side === 'Long'
      ? 'hyperliquid'
      : pacifica?.side === 'Long'
        ? 'pacifica'
        : backpack?.side === 'Long'
          ? 'backpack'
          : 'hyperliquid';

  const shortProtocolId =
    hyperliquid?.side === 'Short'
      ? 'hyperliquid'
      : pacifica?.side === 'Short'
        ? 'pacifica'
        : backpack?.side === 'Short'
          ? 'backpack'
          : 'pacifica';

  // Get display names (will be resolved in components using protocol config)
  const longProtocol = longProtocolId;
  const shortProtocol = shortProtocolId;

  // Calculate total size (sum of both positions)
  const hyperliquidSize = hyperliquid ? parseFloat(hyperliquid.size) : 0;
  const pacificaSize = pacifica ? parseFloat(pacifica.size) : 0;
  const backpackSize = backpack ? parseFloat(backpack.size) : 0;
  const totalSize = hyperliquidSize + pacificaSize + backpackSize;

  // Calculate total PNL (sum of both positions)
  const hyperliquidPnl = hyperliquid ? parseFloat(hyperliquid.pnl) : 0;
  const pacificaPnl = pacifica ? parseFloat(pacifica.pnl) : 0;
  const backpackPnl = backpack ? parseFloat(backpack.pnl) : 0;
  const totalPricePnl = hyperliquidPnl + pacificaPnl + backpackPnl;

  // Calculate total funding PNL (sum of both positions)
  const hyperliquidFunding = hyperliquid ? parseFloat(hyperliquid.funding) : 0;
  const pacificaFunding = pacifica ? parseFloat(pacifica.funding) : 0;
  const backpackFunding = backpack ? parseFloat(backpack.funding) : 0;
  const totalFundingPnl = hyperliquidFunding + pacificaFunding + backpackFunding;

  // Calculate total PNL
  const totalPnl = totalPricePnl + totalFundingPnl;

  // Calculate average leverage (weighted by size)
  let avgLeverage = 0;
  if (totalSize > 0) {
    const hlLeverage = hyperliquid ? hyperliquid.leverage : 0;
    const pacLeverage = pacifica ? pacifica.leverage : 0;
    const bpLeverage = backpack ? backpack.leverage : 0;
    avgLeverage = Math.round(
      (hyperliquidSize * hlLeverage + pacificaSize * pacLeverage + backpackSize * bpLeverage) /
        totalSize
    );
  } else if (hyperliquid) {
    avgLeverage = hyperliquid.leverage;
  } else if (pacifica) {
    avgLeverage = pacifica.leverage;
  } else if (backpack) {
    avgLeverage = backpack.leverage;
  }

  // Calculate total margin
  const hyperliquidMargin = hyperliquid ? parseFloat(hyperliquid.margin) : 0;
  const pacificaMargin = pacifica ? parseFloat(pacifica.margin) : 0;
  const backpackMargin = backpack ? parseFloat(backpack.margin) : 0;
  const totalMargin = hyperliquidMargin + pacificaMargin + backpackMargin;

  return {
    asset: symbol,
    leverage: `${avgLeverage}x`,
    assetLogo: getAssetLogo(symbol),
    long: {
      platform: longProtocol,
    },
    short: {
      platform: shortProtocol,
    },
    size: totalSize.toFixed(4),
    margin: `$${totalMargin.toFixed(2)}`,
    pricePnl: formatCurrency(totalPricePnl),
    fundingPnl: {
      current: formatCurrency(totalFundingPnl),
      estimated: '',
    },
    totalPnl: formatCurrency(totalPnl),
    // Store protocol-specific data for tooltips and inline display
    protocolData: {
      hyperliquid: hyperliquid
        ? ({
            size: hyperliquid.size,
            pnl: formatCurrency(hyperliquidPnl),
            funding: formatCurrency(hyperliquidFunding),
            margin: `$${hyperliquidMargin.toFixed(2)}`,
            liquidationPrice: hyperliquid.liquidationPrice
              ? `$${parseFloat(hyperliquid.liquidationPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : '',
          } as ProtocolPositionData)
        : null,
      pacifica: pacifica
        ? ({
            size: pacifica.size,
            pnl: formatCurrency(pacificaPnl),
            funding: formatCurrency(pacificaFunding),
            margin: `$${pacificaMargin.toFixed(2)}`,
            liquidationPrice: pacifica.liquidationPrice
              ? `$${parseFloat(pacifica.liquidationPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : '',
          } as ProtocolPositionData)
        : null,
      backpack: backpack
        ? ({
            size: backpack.size,
            pnl: formatCurrency(backpackPnl),
            funding: formatCurrency(backpackFunding),
            margin: `$${backpackMargin.toFixed(2)}`,
            liquidationPrice: backpack.liquidationPrice
              ? `$${parseFloat(backpack.liquidationPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : '',
          } as ProtocolPositionData)
        : null,
    } as Record<string, ProtocolPositionData | null>,
  };
}

/**
 * Positions Service
 */
export const positionsService = {
  /**
   * Get open positions for a user (transformed for UI)
   */
  async getOpenPositions(evmAddress: string, solanaAddress: string): Promise<ArbitragePosition[]> {
    const endpoint = API_ENDPOINTS.arbitrage.openPositions(evmAddress, solanaAddress);
    const response = await apiClient.get<PositionApiResponse[]>(endpoint);

    return response.map(transformPositionData);
  },

  /**
   * Get raw open positions from API (needed for close operations)
   */
  async getOpenPositionsRaw(evmAddress: string, solanaAddress: string): Promise<PositionApiResponse[]> {
    const endpoint = API_ENDPOINTS.arbitrage.openPositions(evmAddress, solanaAddress);
    return apiClient.get<PositionApiResponse[]>(endpoint);
  },
};
