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
import { positionsService } from '@/lib/api/services/positions.service';
import type { CreateMarketOrderRequest } from '@/lib/services/pacifica/types';
import type { ProtocolAdapter } from './protocol-adapter.interface';
import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
} from '../types';
import { BUILDER_CODE } from '@/constants';

/**
 * Pacifica Protocol Adapter
 *
 * Implements the ProtocolAdapter interface for Pacifica protocol.
 * Wraps PacificaService and converts between unified and protocol-specific types.
 *
 * Note: getPosition and closePosition require an EVM address (in addition
 * to the Solana address) to query the aggregate positions API.
 * Pass the EVM address via the constructor config.
 */
export class PacificaAdapter implements ProtocolAdapter {
  private service: PacificaService;
  private readonly protocolName = 'pacifica';
  private evmAddress: string | undefined;

  /**
   * @param service - Optional PacificaService instance
   * @param config - Optional config with evmAddress for positions queries
   */
  constructor(service?: PacificaService, config?: { evmAddress?: string }) {
    this.service = service || new PacificaService();
    this.evmAddress = config?.evmAddress;
  }

  /**
   * Sets the EVM address for aggregate position queries.
   * Call this before using getPosition or closePosition.
   */
  setEvmAddress(evmAddress: string): void {
    this.evmAddress = evmAddress;
  }

  /**
   * Opens a position on Pacifica
   */
  async openPosition(params: UnifiedPositionParams): Promise<UnifiedPositionResult> {
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
        builder_code: BUILDER_CODE,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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
   * Closes an existing position on Pacifica.
   *
   * Flow:
   *  1. Query aggregate positions API for the user's Pacifica position
   *  2. Submit a reduce-only market order on the opposite side
   *
   * Requires evmAddress to be set via constructor config or setEvmAddress().
   *
   * @param positionId - Asset name (e.g. "ETH", "BTC")
   * @param walletAddress - User's Solana wallet address
   * @param organizationId - Turnkey organization ID
   */
  async closePosition(
    positionId: string,
    walletAddress: string,
    organizationId: string
  ): Promise<UnifiedPositionResult> {
    try {
      const asset = positionId.toUpperCase();

      // Step 1: Get current position details
      const position = await this.getPosition(positionId, walletAddress);

      // Step 2: Determine the close side (opposite of current position)
      const closeSide: 'bid' | 'ask' = position.direction === 'long' ? 'ask' : 'bid';

      // Step 3: Submit reduce-only market order to close
      const closeRequest: CreateMarketOrderRequest = {
        symbol: asset,
        amount: position.size,
        side: closeSide,
        slippage_percent: '3', // 3% slippage tolerance
        reduce_only: true,
        builder_code: BUILDER_CODE,
      };

      const result = await this.service.createMarketOrder(
        closeRequest,
        walletAddress,
        organizationId
      );

      return {
        success: result.success,
        positionId,
        protocol: this.protocolName,
        asset,
        direction: position.direction,
        size: position.size,
        entryPrice: position.entryPrice,
        margin: position.margin,
        leverage: position.leverage,
        error: result.success ? undefined : (result.error || 'Failed to close position'),
        message: result.message,
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

  /**
   * Gets information about an existing Pacifica position.
   *
   * Uses the aggregate positions API to query the user's positions.
   * Requires evmAddress to be set via constructor config or setEvmAddress().
   *
   * @param positionId - Asset name (e.g. "ETH", "BTC")
   * @param walletAddress - User's Solana wallet address
   */
  async getPosition(positionId: string, walletAddress: string): Promise<UnifiedPosition> {
    const asset = positionId.toUpperCase();

    if (!this.evmAddress) {
      throw new Error(
        'Pacifica adapter requires evmAddress for position queries. ' +
        'Set it via constructor config or setEvmAddress().'
      );
    }

    // Fetch positions from the aggregate API
    const rawPositions = await positionsService.getOpenPositionsRaw(
      this.evmAddress,
      walletAddress
    );

    // Find the position for this asset
    const positionData = rawPositions.find(
      (p) => p.symbol.toUpperCase() === asset
    );

    if (!positionData?.pacifica) {
      throw new Error(`No open Pacifica position found for ${asset}`);
    }

    const pac = positionData.pacifica;
    const size = parseFloat(pac.size);
    if (size === 0) {
      throw new Error(`Pacifica position for ${asset} has zero size`);
    }

    return {
      positionId: asset,
      protocol: this.protocolName,
      asset,
      direction: pac.side === 'Long' ? 'long' : 'short',
      size: pac.size,
      entryPrice: '0', // Not available in aggregate API response
      margin: pac.margin,
      leverage: pac.leverage,
      unrealizedPnl: pac.pnl,
    };
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
  calculatePositionSize(margin: string, leverage: number, price?: string): string {
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
