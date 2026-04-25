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
  /** Backpack leg is not included by backend yet; treat as optional. */
  backpack?: {
    symbol: string;
    size: string;
    side: 'Long' | 'Short';
    pnl: string;
    funding: string;
    margin: string;
    leverage: number;
    liquidationPrice: string;
  } | null;
  lighter?: {
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
 * Transform API response to ArbitragePosition format
 * Exported for use in hooks and testing
 */
export function transformPositionData(apiData: PositionApiResponse): ArbitragePosition {
  const { symbol, hyperliquid, pacifica } = apiData;
  const backpack = apiData.backpack ?? null;
  const lighter = apiData.lighter ?? null;

  type Leg = NonNullable<PositionApiResponse['hyperliquid']>;
  const legs: { id: string; data: Leg }[] = [];
  if (hyperliquid) legs.push({ id: 'hyperliquid', data: hyperliquid });
  if (pacifica) legs.push({ id: 'pacifica', data: pacifica });
  if (backpack) legs.push({ id: 'backpack', data: backpack });
  if (lighter) legs.push({ id: 'lighter', data: lighter });

  const longLeg = legs.find((l) => l.data.side === 'Long');
  const shortLeg = legs.find((l) => l.data.side === 'Short');
  const longProtocol = longLeg?.id ?? 'hyperliquid';
  const shortProtocol = shortLeg?.id ?? 'pacifica';

  let totalSize = 0;
  let totalPricePnl = 0;
  let totalFundingPnl = 0;
  let totalMargin = 0;
  let levWeighted = 0;

  for (const { data } of legs) {
    const sz = parseFloat(data.size);
    totalSize += sz;
    totalPricePnl += parseFloat(data.pnl);
    totalFundingPnl += parseFloat(data.funding);
    totalMargin += parseFloat(data.margin);
    levWeighted += sz * data.leverage;
  }

  const avgLeverage =
    totalSize > 0 ? Math.round(levWeighted / totalSize) : legs[0]?.data.leverage ?? 0;

  const hyperliquidPnl = hyperliquid ? parseFloat(hyperliquid.pnl) : 0;
  const pacificaPnl = pacifica ? parseFloat(pacifica.pnl) : 0;
  const backpackPnl = backpack ? parseFloat(backpack.pnl) : 0;
  const lighterPnl = lighter ? parseFloat(lighter.pnl) : 0;
  const hyperliquidFunding = hyperliquid ? parseFloat(hyperliquid.funding) : 0;
  const pacificaFunding = pacifica ? parseFloat(pacifica.funding) : 0;
  const backpackFunding = backpack ? parseFloat(backpack.funding) : 0;
  const lighterFunding = lighter ? parseFloat(lighter.funding) : 0;
  const hyperliquidMargin = hyperliquid ? parseFloat(hyperliquid.margin) : 0;
  const pacificaMargin = pacifica ? parseFloat(pacifica.margin) : 0;
  const backpackMargin = backpack ? parseFloat(backpack.margin) : 0;
  const lighterMargin = lighter ? parseFloat(lighter.margin) : 0;

  const toProtocolRow = (
    row: Leg | null,
    pnl: number,
    funding: number,
    margin: number
  ): ProtocolPositionData | null =>
    row
      ? {
          size: row.size,
          pnl: formatCurrency(pnl),
          funding: formatCurrency(funding),
          margin: `$${margin.toFixed(2)}`,
          liquidationPrice: row.liquidationPrice
            ? `$${parseFloat(row.liquidationPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : '',
        }
      : null;

  return {
    asset: symbol,
    leverage: `${avgLeverage}x`,
    assetLogo: getAssetLogo(symbol),
    long: { platform: longProtocol },
    short: { platform: shortProtocol },
    size: totalSize.toFixed(4),
    margin: `$${totalMargin.toFixed(2)}`,
    pricePnl: formatCurrency(totalPricePnl),
    fundingPnl: {
      current: formatCurrency(totalFundingPnl),
      estimated: '',
    },
    totalPnl: formatCurrency(totalPricePnl + totalFundingPnl),
    protocolData: {
      hyperliquid: toProtocolRow(hyperliquid, hyperliquidPnl, hyperliquidFunding, hyperliquidMargin),
      pacifica: toProtocolRow(pacifica, pacificaPnl, pacificaFunding, pacificaMargin),
      backpack: toProtocolRow(backpack, backpackPnl, backpackFunding, backpackMargin),
      lighter: toProtocolRow(lighter, lighterPnl, lighterFunding, lighterMargin),
    },
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
