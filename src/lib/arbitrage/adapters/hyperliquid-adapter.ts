/**
 * HyperLiquid Protocol Adapter
 *
 * Wraps the HyperLiquidService to provide a unified interface
 * for the arbitrage orchestrator.
 *
 * This adapter converts between unified types and HyperLiquid-specific types
 * without modifying the existing HyperLiquidService.
 */

import { HyperLiquidService } from '@/lib/services/hyperliquid';
import type { CreatePositionRequest, ClosePositionRequest } from '@/lib/services/hyperliquid/types';
import { perpTickerToIndex } from '@/dex/hyperliquid/utils/asset-index-converter';
import { MarketPriceHelper } from '@/dex/hyperliquid/utils/market-price';
import { HYPERLIQUID_API } from '@/dex/hyperliquid/constants';
import type { ProtocolAdapter } from './protocol-adapter.interface';
import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
} from '../types';

// ─── HL Clearinghouse State Types ─────────────────────────────────────────

interface HLPositionData {
  coin: string;
  szi: string; // Signed size: positive = long, negative = short
  leverage: { type: string; value: number };
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  liquidationPx: string;
  marginUsed: string;
}

interface HLAssetPosition {
  type: string;
  position: HLPositionData;
}

interface HLClearinghouseState {
  assetPositions: HLAssetPosition[];
}

/**
 * HyperLiquid Protocol Adapter
 *
 * Implements the ProtocolAdapter interface for HyperLiquid protocol.
 * Wraps HyperLiquidService and converts between unified and protocol-specific types.
 */
export class HyperLiquidAdapter implements ProtocolAdapter {
  private service: HyperLiquidService;
  private readonly protocolName = 'hyperliquid';

  constructor(service?: HyperLiquidService) {
    this.service = service || new HyperLiquidService();
  }

  /**
   * Opens a position on HyperLiquid
   */
  async openPosition(params: UnifiedPositionParams): Promise<UnifiedPositionResult> {
    try {
      // Convert asset name to asset index
      const assetIndex = await perpTickerToIndex(params.asset.toUpperCase());
      if (assetIndex < 0) {
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
          error: `Asset ${params.asset} not found on HyperLiquid`,
          message: `Failed to find asset ${params.asset}`,
        };
      }

      // Get current market price for entry price and size calculation
      // Note: Price fetching via websocket not yet implemented
      // For now, we'll try to fetch price, but fall back to provided price or USD size
      const marketPriceHelper = new MarketPriceHelper();
      let entryPrice = '0';
      let sizeInAsset = 0;

      // Try to get price
      try {
        const marketPrice = await marketPriceHelper.getMarketPriceForTrading(
          params.asset.toUpperCase(),
          'perps',
          params.direction === 'long' ? 'buy' : 'sell'
        );
        entryPrice = marketPrice.price.toString();
      } catch (error) {
        // If price fetch fails, use provided price if available
        if (params.price && parseFloat(params.price) > 0) {
          entryPrice = params.price;
        }
        // If no price available, we'll use USD size (HyperLiquid accepts USD)
        // Entry price will be set after order execution
      }

      // Calculate position size
      const usdSize = parseFloat(params.margin) * params.leverage;
      const positionSizeUSD = usdSize.toString();

      // If we have a valid price, calculate asset amount for tracking
      if (entryPrice && parseFloat(entryPrice) > 0) {
        sizeInAsset = usdSize / parseFloat(entryPrice);
      } else {
        // Without price, we can't calculate exact asset amount
        // HyperLiquid will determine the actual amount when executing
        // We'll use USD size as placeholder
        sizeInAsset = 0; // Will be updated after order execution
      }

      // Convert unified params to HyperLiquid request
      // For market orders, price can be 0 as HyperLiquid will fetch market price
      const hyperLiquidRequest: CreatePositionRequest = {
        assetIndex,
        assetName: params.asset.toUpperCase(),
        price: parseFloat(entryPrice) > 0 ? parseFloat(entryPrice) : 0, // 0 is okay for market orders
        size: positionSizeUSD, // Size in USD
        leverage: params.leverage,
        isLong: params.direction === 'long',
        isMarket: params.isMarket ?? true,
      };

      // Call HyperLiquid service
      const response = await this.service.createPosition(
        hyperLiquidRequest,
        params.walletAddress,
        params.organizationId
      );

      // Convert response to unified format
      if (response.success) {
        // Extract position ID from response data if available
        // HyperLiquid response structure may vary, so we try to extract it
        let positionId = '';
        if (response.data) {
          // Try to extract order ID or position ID from response
          if (typeof response.data === 'object' && response.data !== null) {
            const data = response.data as Record<string, unknown>;
            positionId =
              (data.orderId as string) || (data.positionId as string) || (data.id as string) || '';
          }
        }

        // If no position ID found, generate a temporary one based on timestamp
        // In production, you might want to query the position after creation
        if (!positionId) {
          positionId = `hl-${Date.now()}-${params.asset}-${params.direction}`;
        }

        // If we didn't have price initially, try to extract it from response
        let finalEntryPrice = entryPrice;
        let finalSizeInAsset = sizeInAsset;

        // If price was 0, we might get it from the response
        if (parseFloat(entryPrice) === 0 && response.data) {
          // Try to extract price from response if available
          // This is protocol-specific and may need adjustment
        }

        return {
          success: true,
          positionId,
          protocol: this.protocolName,
          asset: params.asset,
          direction: params.direction,
          size: finalSizeInAsset > 0 ? finalSizeInAsset.toString() : positionSizeUSD, // Fallback to USD if asset amount not calculated
          entryPrice: finalEntryPrice,
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
   * Closes an existing position on HyperLiquid.
   *
   * Flow:
   *  1. Query HL clearinghouse state for the user's positions
   *  2. Find the position matching the asset (positionId = asset name)
   *  3. Submit a reduce-only market order to close it
   *
   * @param positionId - Asset name (e.g. "ETH", "BTC")
   * @param walletAddress - User's EVM wallet address
   * @param organizationId - Turnkey organization ID
   */
  async closePosition(
    positionId: string,
    walletAddress: string,
    organizationId: string
  ): Promise<UnifiedPositionResult> {
    try {
      const asset = positionId.toUpperCase();

      // Step 1: Get current position details from HL
      const position = await this.getPosition(positionId, walletAddress);

      // Step 2: Resolve asset index
      const assetIndex = await perpTickerToIndex(asset);
      if (assetIndex < 0) {
        return {
          success: false,
          positionId,
          protocol: this.protocolName,
          asset,
          direction: position.direction,
          size: '0',
          entryPrice: '0',
          margin: '0',
          leverage: 1,
          error: `Unknown asset index for ${asset}`,
          message: `Failed to find asset ${asset} on HyperLiquid`,
        };
      }

      // Step 3: Close using the service (market order, reduce-only)
      const closeRequest: ClosePositionRequest = {
        assetIndex,
        assetName: asset,
        price: 0, // Market order — price determined by exchange
        size: position.size,
        isLong: position.direction === 'long',
        isMarket: true,
        userAddress: walletAddress,
      };

      const result = await this.service.closePosition(
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
   * Gets information about an existing position on HyperLiquid.
   *
   * Queries the HL clearinghouse state API to retrieve
   * the user's open positions and finds the one matching the asset.
   *
   * @param positionId - Asset name (e.g. "ETH", "BTC")
   * @param walletAddress - User's EVM wallet address
   */
  async getPosition(positionId: string, walletAddress: string): Promise<UnifiedPosition> {
    const asset = positionId.toUpperCase();

    // Query HL clearinghouse state
    const state = await this.fetchClearinghouseState(walletAddress);

    // Find the position matching the asset
    const assetPosition = state.assetPositions.find(
      (p) => p.position.coin.toUpperCase() === asset
    );

    if (!assetPosition) {
      throw new Error(`No open position found for ${asset} on HyperLiquid`);
    }

    const szi = parseFloat(assetPosition.position.szi);
    if (szi === 0) {
      throw new Error(`Position for ${asset} on HyperLiquid has zero size`);
    }

    return {
      positionId: asset,
      protocol: this.protocolName,
      asset,
      direction: szi > 0 ? 'long' : 'short',
      size: Math.abs(szi).toString(),
      entryPrice: assetPosition.position.entryPx,
      margin: assetPosition.position.marginUsed,
      leverage: assetPosition.position.leverage?.value || 1,
      unrealizedPnl: assetPosition.position.unrealizedPnl,
    };
  }

  /**
   * Fetches the user's clearinghouse state from HyperLiquid's info API.
   * Returns all open positions for the user.
   */
  private async fetchClearinghouseState(walletAddress: string): Promise<HLClearinghouseState> {
    const response = await fetch(`${HYPERLIQUID_API}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: walletAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch HL clearinghouse state: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as HLClearinghouseState;
  }

  /**
   * Gets protocol metadata
   */
  getMetadata(): ProtocolMetadata {
    return {
      name: this.protocolName,
      displayName: 'HyperLiquid',
      walletType: 'ethereum',
      maxLeverage: 50, // HyperLiquid supports up to 50x
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
    return 'ethereum';
  }

  /**
   * Gets supported assets
   */
  getSupportedAssets(): string[] {
    return this.getMetadata().supportedAssets;
  }

  /**
   * Normalizes asset name to HyperLiquid format
   * HyperLiquid uses uppercase asset names (e.g., "BTC", "ETH")
   */
  normalizeAssetName(asset: string): string {
    return asset.toUpperCase();
  }

  /**
   * Calculates position size from margin and leverage
   *
   * Returns size in asset units (e.g., 0.001 BTC)
   * Formula: (margin * leverage) / price = size in asset units
   */
  calculatePositionSize(margin: string, leverage: number, price?: string): string {
    if (!price || parseFloat(price) <= 0) {
      throw new Error('Price is required to calculate position size in asset units');
    }

    const marginNum = parseFloat(margin);
    const usdSize = marginNum * leverage;
    const priceNum = parseFloat(price);
    const sizeInAsset = usdSize / priceNum;

    return sizeInAsset.toString();
  }
}
