/**
 * Pacifica Protocol Adapter
 * 
 * Wraps the PacificaService to provide a unified interface
 * for the arbitrage orchestrator.
 * 
 * This adapter converts between unified types and Pacifica-specific types
 * without modifying the existing PacificaService.
 */

import { PacificaService } from '@/lib/services/pacifica';
import type { CreateMarketOrderRequest } from '@/lib/services/pacifica/types';
import type {
  ProtocolAdapter,
} from './protocol-adapter.interface';
import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
} from '../types';

/**
 * Pacifica Protocol Adapter
 * 
 * Implements the ProtocolAdapter interface for Pacifica protocol.
 * Wraps PacificaService and converts between unified and protocol-specific types.
 */
export class PacificaAdapter implements ProtocolAdapter {
  private service: PacificaService;
  private readonly protocolName = 'pacifica';

  constructor(service?: PacificaService) {
    this.service = service || new PacificaService();
  }

  /**
   * Opens a position on Pacifica
   */
  async openPosition(
    params: UnifiedPositionParams
  ): Promise<UnifiedPositionResult> {
    try {
      // Convert direction to Pacifica side format
      // 'long' -> 'bid', 'short' -> 'ask'
      const side = params.direction === 'long' ? 'bid' : 'ask';

      // Get entry price for calculating asset amount
      // Note: Price fetching via websocket not yet implemented
      // For now, price must be provided in params
      const entryPrice = params.price || '0';

      // Pacifica requires amount in asset units, so we need price to calculate it
      // If no price provided, we cannot proceed
      // TODO: Once websocket price fetching is implemented, fetch price here
      if (!entryPrice || parseFloat(entryPrice) <= 0) {
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
          error: 'Price is required to calculate position amount',
          message:
            'Price must be provided. Real-time price fetching will be available once websocket integration is complete.',
        };
      }

      // Calculate position amount in asset units
      // Formula: (margin * leverage) / price = amount in asset units
      // Example: ($500 * 3) / $45000 = 0.0333 BTC
      const usdSize = parseFloat(params.margin) * params.leverage;
      const amountInAsset = usdSize / parseFloat(entryPrice);
      const amount = amountInAsset.toString();

      // Get slippage percent (use provided or default)
      const slippagePercent = params.slippagePercent || '0.5';

      // Convert unified params to Pacifica request
      const pacificaRequest: CreateMarketOrderRequest = {
        symbol: this.normalizeAssetName(params.asset),
        amount: amount,
        side: side,
        slippage_percent: slippagePercent,
        reduce_only: false,
      };

      // Call Pacifica service
      const response = await this.service.createMarketOrder(
        pacificaRequest,
        params.walletAddress,
        params.organizationId
      );

      // Convert response to unified format
      if (response.success) {
        const positionId = response.order_id || '';

        return {
          success: true,
          positionId,
          protocol: this.protocolName,
          asset: params.asset,
          direction: params.direction,
          size: amount, // Size in asset units (e.g., 0.001 BTC)
          entryPrice: entryPrice,
          margin: params.margin,
          leverage: params.leverage,
          message: response.message || 'Position opened successfully',
          rawData: response.data,
        };
      } else {
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
          error: response.error || 'Unknown error',
          message: response.message || 'Failed to open position',
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
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
        error: errorMessage,
        message: `Failed to open position: ${errorMessage}`,
      };
    }
  }

  /**
   * Closes an existing position on Pacifica
   * 
   * Note: This requires position details to create a reduce-only order
   */
  async closePosition(
    positionId: string,
    _walletAddress: string,
    _organizationId: string
  ): Promise<UnifiedPositionResult> {
    // Note: Pacifica closePosition requires position details (size, side, etc.)
    // This is a simplified implementation - in production, you'd need to
    // first query the position to get its details
    return {
      success: false,
      positionId,
      protocol: this.protocolName,
      asset: '',
      direction: 'long',
      size: '0',
      entryPrice: '0',
      margin: '0',
      leverage: 1,
      error: 'closePosition requires position details - use getPosition first',
      message: 'Position details required for closing',
    };
  }

  /**
   * Gets information about an existing position
   * 
   * Note: This is a placeholder - Pacifica position querying
   * would need to be implemented based on their API
   */
  async getPosition(
    _positionId: string,
    _walletAddress: string
  ): Promise<UnifiedPosition> {
    // Placeholder implementation
    // In production, this would query Pacifica API for position details
    throw new Error('getPosition not yet implemented for Pacifica');
  }

  /**
   * Gets protocol metadata
   */
  getMetadata(): ProtocolMetadata {
    return {
      name: this.protocolName,
      displayName: 'Pacifica',
      walletType: 'solana',
      maxLeverage: 20, // Adjust based on Pacifica's actual max leverage
      minMargin: '1', // Minimum margin in USD
      supportedAssets: [
        'BTC',
        'ETH',
        'SOL',
        // Add more as needed
      ],
      supportsMarketOrders: true,
      supportsLimitOrders: true,
      defaultSlippagePercent: '0.5', // 0.5% default slippage
    };
  }

  /**
   * Gets required wallet type
   */
  getRequiredWalletType(): 'ethereum' | 'solana' {
    return 'solana';
  }

  /**
   * Gets supported assets
   */
  getSupportedAssets(): string[] {
    return this.getMetadata().supportedAssets;
  }

  /**
   * Normalizes asset name to Pacifica format
   * Pacifica uses standard asset symbols (e.g., "BTC", "ETH")
   */
  normalizeAssetName(asset: string): string {
    // Pacifica uses standard uppercase asset names
    return asset.toUpperCase();
  }

  /**
   * Calculates position size from margin and leverage
   * 
   * Returns size in asset units (e.g., 0.001 BTC)
   * Formula: (margin * leverage) / price = amount in asset units
   */
  calculatePositionSize(
    margin: string,
    leverage: number,
    price?: string
  ): string {
    if (!price || parseFloat(price) <= 0) {
      throw new Error('Price is required to calculate position size in asset units');
    }

    const marginNum = parseFloat(margin);
    const usdSize = marginNum * leverage;
    const priceNum = parseFloat(price);
    const amountInAsset = usdSize / priceNum;

    return amountInAsset.toString();
  }
}
