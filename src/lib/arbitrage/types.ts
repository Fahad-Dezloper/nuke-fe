/**
 * Unified types for arbitrage operations across multiple protocols
 * These types provide a common interface for all protocol adapters
 */

/**
 * Unified position direction - normalized across all protocols
 */
export type UnifiedDirection = 'long' | 'short';

/**
 * Supported wallet types for protocols
 */
export type WalletType = 'ethereum' | 'solana';

/**
 * Unified parameters for opening a position on any protocol
 * This is the normalized input that all adapters will receive
 */
export interface UnifiedPositionParams {
  /** Asset symbol (e.g., "BTC", "ETH") - will be normalized by adapter */
  asset: string;

  /** Position direction */
  direction: UnifiedDirection;

  /** Margin amount in USD (as string to avoid precision issues) */
  margin: string;

  /** Leverage multiplier (e.g., 3 for 3x) */
  leverage: number;

  /** Wallet address for the protocol (must match protocol's wallet type) */
  walletAddress: string;

  /** Turnkey organization ID */
  organizationId: string;

  /** Optional: Market price for limit orders (if not provided, uses market order) */
  price?: string;

  /** Optional: Whether to use market order (default: true) */
  isMarket?: boolean;

  /** Optional: Slippage tolerance as percentage string (e.g., "0.5" for 0.5%) */
  slippagePercent?: string;

  /**
   * Optional: Pre-computed position size in base asset units (e.g. BTC).
   * Used by hedge open so HL (USD) and Phoenix (base lots) stay the same size.
   */
  baseSize?: string;

  /**
   * When true (default for hedges), venues use isolated margin so leg margin matches panel input.
   */
  useIsolatedMargin?: boolean;
  /**
   * Mirrored hedge TP/SL — attached on open where the venue supports it
   * (Hyperliquid `normalTpsl` batch, Pacifica `create_market_order` fields).
   */
  hedgeTpsl?: {
    takeProfitPrice: string;
    stopLossPrice: string;
    takeProfitLimitPrice?: string;
    stopLossLimitPrice?: string;
    upperStop: string;
    lowerStop: string;
  };
}

/**
 * Unified position result from any protocol
 * This is the normalized output that all adapters will return
 */
export interface UnifiedPositionResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Protocol-specific position ID (can be order_id, position_id, etc.) */
  positionId: string;

  /** Protocol name (e.g., "hyperliquid", "pacifica") */
  protocol: string;

  /** Asset symbol */
  asset: string;

  /** Position direction */
  direction: UnifiedDirection;

  /** Position size (normalized - actual size opened) */
  size: string;

  /** Entry price */
  entryPrice: string;

  /** Margin used */
  margin: string;

  /** Leverage used */
  leverage: number;

  /** Error message if success is false */
  error?: string;

  /** Human-readable message */
  message?: string;

  /** Raw protocol-specific response data (for debugging) */
  rawData?: unknown;
}

/**
 * Unified position information (for querying existing positions)
 */
export interface UnifiedPosition {
  /** Protocol-specific position ID */
  positionId: string;

  /** Protocol name */
  protocol: string;

  /** Asset symbol */
  asset: string;

  /** Position direction */
  direction: UnifiedDirection;

  /** Current position size */
  size: string;

  /** Entry price */
  entryPrice: string;

  /** Current mark price */
  markPrice?: string;

  /** Margin used */
  margin: string;

  /** Leverage */
  leverage: number;

  /** Unrealized PnL */
  unrealizedPnl?: string;

  /** Funding rate (if available) */
  fundingRate?: string;
}

/**
 * Protocol metadata - information about protocol capabilities
 */
export interface ProtocolMetadata {
  /** Protocol name (e.g., "hyperliquid", "pacifica") */
  name: string;

  /** Display name */
  displayName: string;

  /** Required wallet type */
  walletType: WalletType;

  /** Maximum leverage supported */
  maxLeverage: number;

  /** Minimum margin required (in USD) */
  minMargin: string;

  /** Supported assets */
  supportedAssets: string[];

  /** Whether market orders are supported */
  supportsMarketOrders: boolean;

  /** Whether limit orders are supported */
  supportsLimitOrders: boolean;

  /** Default slippage tolerance (as percentage string) */
  defaultSlippagePercent?: string;
}

/**
 * Arbitrage pair configuration
 * Defines a specific LONG/SHORT combination across two protocols
 */
export interface ArbitragePair {
  /** Unique pair ID (e.g., "btc-hl-pacifica") */
  id: string;

  /** Asset symbol */
  asset: string;

  /** Display name for the pair */
  name: string;

  /** Protocol name for LONG position */
  longProtocol: string;

  /** Protocol name for SHORT position */
  shortProtocol: string;

  /** Whether this pair is currently active/available */
  isActive: boolean;

  /** Optional: Estimated funding rate difference (APR) */
  estimatedFundingRate?: number;

  /** Optional: Description */
  description?: string;
}

/**
 * Result of executing an arbitrage pair
 */
export interface ArbitrageExecutionResult {
  /** Whether the entire arbitrage was successful */
  success: boolean;

  /** Pair ID that was executed */
  pairId: string;

  /** Asset symbol */
  asset: string;

  /** LONG position result */
  longPosition: UnifiedPositionResult;

  /** SHORT position result */
  shortPosition: UnifiedPositionResult;

  /** Total margin used (sum of both positions) */
  totalMargin: string;

  /** Leverage used */
  leverage: number;

  /** Error message if success is false */
  error?: string;

  /** Human-readable message */
  message?: string;

  /** Whether a rollback was performed (if one position failed) */
  rollbackPerformed?: boolean;
}
