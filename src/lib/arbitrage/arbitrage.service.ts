/**
 * Arbitrage Service
 *
 * High-level service that provides easy access to arbitrage functionality.
 * Initializes and manages the orchestrator, registries, and adapters.
 */

import { ArbitrageOrchestrator } from './orchestrator';
import { ArbitragePairRegistry } from './pairs/pair-registry';
import { ProtocolRegistry } from './protocol-registry';
import { ARBITRAGE_PAIRS } from './pairs/pair-config';
import { HyperLiquidAdapter } from './adapters/hyperliquid-adapter';
import { PacificaAdapter } from './adapters/pacifica-adapter';
import type { ExecuteArbitragePairParams } from './orchestrator';
import type { ArbitrageExecutionResult } from './types';
import type { ArbitragePair } from './types';

/**
 * Arbitrage Service
 *
 * Provides a simple interface for executing arbitrage pairs.
 * Handles initialization of all components.
 */
export class ArbitrageService {
  private orchestrator: ArbitrageOrchestrator;
  private pairRegistry: ArbitragePairRegistry;
  private protocolRegistry: ProtocolRegistry;
  private initialized = false;

  constructor() {
    this.pairRegistry = new ArbitragePairRegistry();
    this.protocolRegistry = new ProtocolRegistry();
    this.orchestrator = new ArbitrageOrchestrator(this.pairRegistry, this.protocolRegistry);
  }

  /**
   * Initializes the arbitrage service
   * Registers all adapters and pairs
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register protocol adapters
    this.protocolRegistry.register('hyperliquid', new HyperLiquidAdapter());
    this.protocolRegistry.register('pacifica', new PacificaAdapter());

    // Register arbitrage pairs
    this.pairRegistry.registerPairs(ARBITRAGE_PAIRS);

    this.initialized = true;
  }

  /**
   * Executes an arbitrage pair
   *
   * @param params - Execution parameters
   * @returns Execution result
   */
  async executePair(params: ExecuteArbitragePairParams): Promise<ArbitrageExecutionResult> {
    if (!this.initialized) {
      this.initialize();
    }

    return this.orchestrator.executeArbitragePair(params);
  }

  /**
   * Gets all available pairs for an asset
   *
   * @param asset - Asset symbol
   * @returns Array of arbitrage pairs
   */
  getPairsForAsset(asset: string): ArbitragePair[] {
    if (!this.initialized) {
      this.initialize();
    }

    return this.pairRegistry.getPairsForAsset(asset);
  }

  /**
   * Gets a specific pair by ID
   *
   * @param pairId - Pair ID
   * @returns The pair or null
   */
  getPair(pairId: string): ArbitragePair | null {
    if (!this.initialized) {
      this.initialize();
    }

    return this.pairRegistry.getPair(pairId);
  }

  /**
   * Gets all available assets
   *
   * @returns Array of asset symbols
   */
  getAvailableAssets(): string[] {
    if (!this.initialized) {
      this.initialize();
    }

    return this.pairRegistry.getAvailableAssets();
  }

  /**
   * Gets the orchestrator (for advanced usage)
   *
   * @returns The orchestrator instance
   */
  getOrchestrator(): ArbitrageOrchestrator {
    if (!this.initialized) {
      this.initialize();
    }

    return this.orchestrator;
  }

  /**
   * Gets the pair registry (for advanced usage)
   *
   * @returns The pair registry instance
   */
  getPairRegistry(): ArbitragePairRegistry {
    if (!this.initialized) {
      this.initialize();
    }

    return this.pairRegistry;
  }

  /**
   * Gets the protocol registry (for advanced usage)
   *
   * @returns The protocol registry instance
   */
  getProtocolRegistry(): ProtocolRegistry {
    if (!this.initialized) {
      this.initialize();
    }

    return this.protocolRegistry;
  }
}

/**
 * Singleton instance of the arbitrage service
 * Use this for easy access throughout the application
 */
export const arbitrageService = new ArbitrageService();
