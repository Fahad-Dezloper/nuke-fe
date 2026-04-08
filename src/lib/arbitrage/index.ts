/**
 * Arbitrage Module
 *
 * Provides unified interfaces and orchestrator for executing
 * arbitrage positions across multiple DEX protocols.
 *
 * This module does not modify existing protocol services.
 * Instead, it provides adapters that wrap existing services
 * and an orchestrator that coordinates multi-protocol operations.
 */

// Export types
export type {
  UnifiedDirection,
  WalletType,
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
  ArbitragePair,
  ArbitrageExecutionResult,
} from './types';

// Export adapter interface and implementations
export type { ProtocolAdapter } from './adapters/protocol-adapter.interface';
export { HyperLiquidAdapter, PacificaAdapter, BackpackAdapter } from './adapters';

// Export pair registry and configuration
export { ArbitragePairRegistry, ARBITRAGE_PAIRS, getPairsForAsset, getPairById } from './pairs';

// Export protocol registry
export { ProtocolRegistry } from './protocol-registry';

// Export orchestrator
export { ArbitrageOrchestrator } from './orchestrator';
export type { ExecuteArbitragePairParams } from './orchestrator';

// Export high-level service
export { ArbitrageService, arbitrageService } from './arbitrage.service';
