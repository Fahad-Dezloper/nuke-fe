/**
 * Phoenix adapter — Solana + Turnkey via Rise (`PhoenixService`).
 */

import { positionsService } from '@/lib/api/services/positions.service';
import { phoenixService } from '@/lib/services/phoenix';
import type { ProtocolAdapter } from './protocol-adapter.interface';
import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
} from '../types';

export class PhoenixAdapter implements ProtocolAdapter {
  private readonly protocolName = 'phoenix';
  private evmAddress: string | undefined;

  constructor(config?: { evmAddress?: string }) {
    this.evmAddress = config?.evmAddress;
  }

  setEvmAddress(evmAddress: string): void {
    this.evmAddress = evmAddress;
  }

  async openPosition(params: UnifiedPositionParams): Promise<UnifiedPositionResult> {
    if (!phoenixService.isTradingEnabled()) {
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
        error: 'Phoenix trading disabled',
        message: 'Set NEXT_PUBLIC_PHOENIX_TRADING_ENABLED=true to trade on Phoenix.',
      };
    }

    const entryPrice = params.price || '0';
    if (!entryPrice || Number.parseFloat(entryPrice) <= 0) {
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
        error: 'Price is required to size the Phoenix order',
        message: 'Provide mark price for Phoenix sizing.',
      };
    }

    try {
      const size = this.calculatePositionSize(params.margin, params.leverage, entryPrice);
      const res = await phoenixService.placeMarketOrder({
        symbol: this.normalizeAssetName(params.asset),
        direction: params.direction,
        baseUnits: size,
        solanaAuthority: params.walletAddress,
        organizationId: params.organizationId,
        reduceOnly: false,
      });

      if (!res.success) {
        return {
          success: false,
          positionId: '',
          protocol: this.protocolName,
          asset: params.asset,
          direction: params.direction,
          size: '0',
          entryPrice,
          margin: params.margin,
          leverage: params.leverage,
          error: res.error,
          message: res.error,
        };
      }

      return {
        success: true,
        positionId: res.txSignature,
        protocol: this.protocolName,
        asset: params.asset,
        direction: params.direction,
        size,
        entryPrice,
        margin: params.margin,
        leverage: params.leverage,
        message: 'Phoenix market order submitted',
        rawData: { txSignature: res.txSignature },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        positionId: '',
        protocol: this.protocolName,
        asset: params.asset,
        direction: params.direction,
        size: '0',
        entryPrice: params.price ?? '0',
        margin: params.margin,
        leverage: params.leverage,
        error: msg,
        message: msg,
      };
    }
  }

  async closePosition(
    positionId: string,
    walletAddress: string,
    organizationId: string
  ): Promise<UnifiedPositionResult> {
    const asset = positionId.toUpperCase();

    try {
      const position = await this.getPosition(positionId, walletAddress);
      const closeDirection: 'long' | 'short' = position.direction === 'long' ? 'short' : 'long';

      const res = await phoenixService.placeMarketOrder({
        symbol: asset,
        direction: closeDirection,
        baseUnits: position.size,
        solanaAuthority: walletAddress,
        organizationId,
        reduceOnly: true,
      });

      if (!res.success) {
        return {
          success: false,
          positionId: asset,
          protocol: this.protocolName,
          asset,
          direction: position.direction,
          size: position.size,
          entryPrice: position.entryPrice,
          margin: position.margin,
          leverage: position.leverage,
          error: res.error,
          message: res.error,
        };
      }

      return {
        success: true,
        positionId: res.txSignature,
        protocol: this.protocolName,
        asset,
        direction: position.direction,
        size: position.size,
        entryPrice: position.entryPrice,
        margin: position.margin,
        leverage: position.leverage,
        message: 'Phoenix position closed',
        rawData: { txSignature: res.txSignature },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        positionId: asset,
        protocol: this.protocolName,
        asset,
        direction: 'long',
        size: '0',
        entryPrice: '0',
        margin: '0',
        leverage: 1,
        error: msg,
        message: msg,
      };
    }
  }

  async getPosition(positionId: string, walletAddress: string): Promise<UnifiedPosition> {
    const asset = positionId.toUpperCase();

    if (!this.evmAddress) {
      throw new Error(
        'Phoenix adapter requires evmAddress for aggregate position queries. Set via constructor or setEvmAddress().'
      );
    }

    const rawPositions = await positionsService.getOpenPositionsRaw(this.evmAddress, walletAddress);
    const row = rawPositions.find((p) => p.symbol.toUpperCase() === asset);

    if (!row?.phoenix) {
      throw new Error(`No open Phoenix position found for ${asset}`);
    }

    const phx = row.phoenix;
    const size = Number.parseFloat(phx.size);
    if (!Number.isFinite(size) || size === 0) {
      throw new Error(`Phoenix position for ${asset} has invalid size`);
    }

    return {
      positionId: asset,
      protocol: this.protocolName,
      asset,
      direction: phx.side === 'Long' ? 'long' : 'short',
      size: phx.size,
      entryPrice: '0',
      margin: phx.margin,
      leverage: phx.leverage,
      unrealizedPnl: phx.pnl,
    };
  }

  getMetadata(): ProtocolMetadata {
    return {
      name: this.protocolName,
      displayName: 'Phoenix',
      walletType: 'solana',
      maxLeverage: 50,
      minMargin: '1',
      supportedAssets: ['BTC', 'ETH', 'SOL'],
      supportsMarketOrders: true,
      supportsLimitOrders: false,
      defaultSlippagePercent: '0.5',
    };
  }

  getRequiredWalletType(): 'ethereum' | 'solana' {
    return 'solana';
  }

  getSupportedAssets(): string[] {
    return this.getMetadata().supportedAssets ?? [];
  }

  normalizeAssetName(asset: string): string {
    return asset.trim().toUpperCase().replace(/-PERP$/i, '');
  }

  calculatePositionSize(margin: string, leverage: number, price?: string): string {
    if (!price || Number.parseFloat(price) <= 0) {
      throw new Error('Price is required to calculate Phoenix base size');
    }
    const marginNum = Number.parseFloat(margin);
    const usdSize = marginNum * leverage;
    const amountInAsset = usdSize / Number.parseFloat(price);
    return amountInAsset.toString();
  }
}
