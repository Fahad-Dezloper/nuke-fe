/**
 * Backpack Protocol Adapter
 *
 * Wraps BackpackService to provide a unified interface for the arbitrage orchestrator.
 */

import { BackpackService } from '@/lib/services/backpack/backpack.service';
import type { ProtocolAdapter } from './protocol-adapter.interface';
import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
} from '../types';

function assetToBackpackPerpSymbol(asset: string): string {
  // Current app trades USDC-margined perps.
  return `${asset.toUpperCase()}_USDC_PERP`;
}

export class BackpackAdapter implements ProtocolAdapter {
  private readonly protocolName = 'backpack';
  private organizationId: string | null = null;

  constructor(private readonly service: BackpackService = new BackpackService()) {}

  async openPosition(params: UnifiedPositionParams): Promise<UnifiedPositionResult> {
    try {
      this.organizationId = params.organizationId;
      const symbol = assetToBackpackPerpSymbol(params.asset);

      if (!params.price || parseFloat(params.price) <= 0) {
        return {
          success: false,
          positionId: '',
          protocol: this.protocolName,
          asset: params.asset,
          direction: params.direction,
          size: '0',
          entryPrice: '0',
          margin: params.margin,
          leverage: params.leverage,
          error: 'Price is required to calculate Backpack order quantity',
          message: 'Missing price for Backpack sizing',
        };
      }

      // Backpack expects base-asset quantity for non-reverse market orders.
      const usdNotional = parseFloat(params.margin) * params.leverage;
      const qty = (usdNotional / parseFloat(params.price)).toString();

      const side = params.direction === 'long' ? 'Bid' : 'Ask';

      const result = await this.service.executePerpOrder({
        order: {
          symbol,
          side,
          orderType: 'Market',
          quantity: qty,
          reduceOnly: false,
        },
        solanaAddress: params.walletAddress,
        organizationId: params.organizationId,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          positionId: '',
          protocol: this.protocolName,
          asset: params.asset,
          direction: params.direction,
          size: '0',
          entryPrice: params.price,
          margin: params.margin,
          leverage: params.leverage,
          error: result.error || 'Backpack order failed',
          message: 'Failed to open position',
        };
      }

      return {
        success: true,
        positionId: result.data.id || '',
        protocol: this.protocolName,
        asset: params.asset,
        direction: params.direction,
        size: qty,
        entryPrice: params.price,
        margin: params.margin,
        leverage: params.leverage,
        message: 'Position opened successfully',
        rawData: result.data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        positionId: '',
        protocol: this.protocolName,
        asset: params.asset,
        direction: params.direction,
        size: '0',
        entryPrice: params.price || '0',
        margin: params.margin,
        leverage: params.leverage,
        error: errorMessage,
        message: `Failed to open position: ${errorMessage}`,
      };
    }
  }

  async closePosition(
    positionId: string,
    walletAddress: string,
    organizationId: string
  ): Promise<UnifiedPositionResult> {
    try {
      this.organizationId = organizationId;
      const asset = positionId.toUpperCase();
      const symbol = assetToBackpackPerpSymbol(asset);

      const pos = await this.getPosition(asset, walletAddress);
      const closeSide = pos.direction === 'long' ? 'Ask' : 'Bid';

      const result = await this.service.executePerpOrder({
        order: {
          symbol,
          side: closeSide,
          orderType: 'Market',
          quantity: pos.size,
          reduceOnly: true,
        },
        solanaAddress: walletAddress,
        organizationId,
      });

      return {
        success: result.success,
        positionId,
        protocol: this.protocolName,
        asset,
        direction: pos.direction,
        size: pos.size,
        entryPrice: pos.entryPrice,
        margin: pos.margin,
        leverage: pos.leverage,
        error: result.success ? undefined : result.error || 'Failed to close position',
        message: result.success ? 'Position closed' : 'Failed to close position',
        rawData: result.success ? result.data : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        positionId,
        protocol: this.protocolName,
        asset: positionId,
        direction: 'long',
        size: '0',
        entryPrice: '0',
        margin: '0',
        leverage: 1,
        error: errorMessage,
        message: `Failed to close position: ${errorMessage}`,
      };
    }
  }

  async getPosition(positionId: string, walletAddress: string): Promise<UnifiedPosition> {
    const asset = positionId.toUpperCase();
    const symbol = assetToBackpackPerpSymbol(asset);

    if (!this.organizationId) {
      throw new Error(
        'BackpackAdapter.getPosition called before adapter was given organizationId. ' +
          'Call openPosition/closePosition first, or construct adapter with an organizationId-aware wrapper.'
      );
    }

    const positions = await this.service.getOpenPositions({
      solanaAddress: walletAddress,
      organizationId: this.organizationId,
      symbol,
      marketType: 'PERP',
    });

    if (!positions.success || !positions.data) {
      throw new Error(positions.error || `Failed to query Backpack positions for ${symbol}`);
    }

    const p = positions.data[0];
    if (!p) {
      throw new Error(`No open Backpack position found for ${symbol}`);
    }

    const netQty = parseFloat(p.netQuantity);
    if (!netQty || netQty === 0) {
      throw new Error(`Backpack position for ${symbol} has zero size`);
    }

    return {
      positionId: asset,
      protocol: this.protocolName,
      asset,
      direction: netQty > 0 ? 'long' : 'short',
      size: Math.abs(netQty).toString(),
      entryPrice: p.entryPrice,
      markPrice: p.markPrice,
      margin: '0',
      leverage: p.accountLeverage ? parseFloat(p.accountLeverage) || 1 : 1,
      unrealizedPnl: p.pnlUnrealized,
    };
  }

  getMetadata(): ProtocolMetadata {
    return {
      name: this.protocolName,
      displayName: 'Backpack',
      walletType: 'solana',
      maxLeverage: 50,
      minMargin: '1',
      supportedAssets: ['BTC', 'ETH', 'SOL'],
      supportsMarketOrders: true,
      supportsLimitOrders: true,
      defaultSlippagePercent: '0.5',
    };
  }

  getRequiredWalletType(): 'ethereum' | 'solana' {
    return 'solana';
  }

  getSupportedAssets(): string[] {
    return this.getMetadata().supportedAssets;
  }

  normalizeAssetName(asset: string): string {
    return asset.toUpperCase();
  }

  calculatePositionSize(margin: string, leverage: number, price?: string): string {
    if (!price || parseFloat(price) <= 0) {
      throw new Error('Price is required to calculate Backpack position size');
    }
    const usdSize = parseFloat(margin) * leverage;
    return (usdSize / parseFloat(price)).toString();
  }
}

