/**
 * Protocol Adapter Interface
 * 
 * All protocol adapters must implement this interface to provide
 * a unified way to interact with different DEX protocols.
 * 
 * This allows the orchestrator to work with any protocol without
 * knowing protocol-specific details.
 */

import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
} from '../types';

/**
 * Protocol Adapter Interface
 * 
 * Each protocol (HyperLiquid, Pacifica, etc.) must have an adapter
 * that implements this interface. The adapter wraps the protocol-specific
 * service and converts between unified types and protocol-specific types.
 */
export interface ProtocolAdapter {
  /**
   * Opens a position on the protocol
   * 
   * @param params - Unified position parameters
   * @returns Unified position result
   */
  openPosition(
    params: UnifiedPositionParams
  ): Promise<UnifiedPositionResult>;

  /**
   * Closes an existing position
   * 
   * @param positionId - Protocol-specific position ID
   * @param walletAddress - Wallet address used for the position
   * @param organizationId - Turnkey organization ID
   * @returns Unified position result
   */
  closePosition(
    positionId: string,
    walletAddress: string,
    organizationId: string
  ): Promise<UnifiedPositionResult>;

  /**
   * Gets information about an existing position
   * 
   * @param positionId - Protocol-specific position ID
   * @param walletAddress - Wallet address used for the position
   * @returns Unified position information
   */
  getPosition(
    positionId: string,
    walletAddress: string
  ): Promise<UnifiedPosition>;

  /**
   * Gets protocol metadata (capabilities, limits, etc.)
   * 
   * @returns Protocol metadata
   */
  getMetadata(): ProtocolMetadata;

  /**
   * Gets the required wallet type for this protocol
   * 
   * @returns Wallet type ('ethereum' or 'solana')
   */
  getRequiredWalletType(): 'ethereum' | 'solana';

  /**
   * Gets list of supported assets for this protocol
   * 
   * @returns Array of asset symbols
   */
  getSupportedAssets(): string[];

  /**
   * Normalizes an asset name to protocol-specific format
   * 
   * For example:
   * - HyperLiquid might use "BTC"
   * - Pacifica might use "BTC" or "BTC-PERP"
   * 
   * @param asset - Standard asset symbol (e.g., "BTC")
   * @returns Protocol-specific asset identifier
   */
  normalizeAssetName(asset: string): string;

  /**
   * Calculates position size from margin and leverage
   * 
   * Different protocols may calculate size differently.
   * This method provides a unified way to convert margin to size.
   * 
   * @param margin - Margin amount in USD (as string)
   * @param leverage - Leverage multiplier
   * @param price - Current asset price (optional, for some protocols)
   * @returns Position size (protocol-specific format as string)
   */
  calculatePositionSize(
    margin: string,
    leverage: number,
    price?: string
  ): string;
}
