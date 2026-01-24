/**
 * Arbitrage Pair Registry
 * 
 * Manages and stores arbitrage pair configurations.
 * Provides methods to query pairs by asset, ID, or protocol.
 */

import type { ArbitragePair } from '../types';

/**
 * Arbitrage Pair Registry
 * 
 * Stores and manages all available arbitrage pairs.
 * Pairs are grouped by asset for easy querying.
 */
export class ArbitragePairRegistry {
  private pairs: Map<string, ArbitragePair[]> = new Map();
  private pairsById: Map<string, ArbitragePair> = new Map();

  /**
   * Registers a new arbitrage pair
   * 
   * @param pair - The arbitrage pair to register
   */
  registerPair(pair: ArbitragePair): void {
    // Validate pair
    if (!pair.id || !pair.asset || !pair.longProtocol || !pair.shortProtocol) {
      throw new Error('Invalid arbitrage pair: missing required fields');
    }

    // Check for duplicate IDs
    if (this.pairsById.has(pair.id)) {
      throw new Error(`Arbitrage pair with ID "${pair.id}" already exists`);
    }

    // Add to asset group
    const assetPairs = this.pairs.get(pair.asset) || [];
    assetPairs.push(pair);
    this.pairs.set(pair.asset, assetPairs);

    // Add to ID map for quick lookup
    this.pairsById.set(pair.id, pair);
  }

  /**
   * Registers multiple arbitrage pairs at once
   * 
   * @param pairs - Array of arbitrage pairs to register
   */
  registerPairs(pairs: ArbitragePair[]): void {
    for (const pair of pairs) {
      this.registerPair(pair);
    }
  }

  /**
   * Gets all pairs for a specific asset
   * 
   * @param asset - Asset symbol (e.g., "BTC", "ETH")
   * @returns Array of arbitrage pairs for the asset
   */
  getPairsForAsset(asset: string): ArbitragePair[] {
    const pairs = this.pairs.get(asset) || [];
    // Return only active pairs
    return pairs.filter((pair) => pair.isActive);
  }

  /**
   * Gets a specific pair by ID
   * 
   * @param pairId - The pair ID
   * @returns The arbitrage pair or null if not found
   */
  getPair(pairId: string): ArbitragePair | null {
    const pair = this.pairsById.get(pairId);
    return pair && pair.isActive ? pair : null;
  }

  /**
   * Gets all available assets that have pairs
   * 
   * @returns Array of asset symbols
   */
  getAvailableAssets(): string[] {
    return Array.from(this.pairs.keys());
  }

  /**
   * Gets all registered pairs (including inactive)
   * 
   * @returns Array of all arbitrage pairs
   */
  getAllPairs(): ArbitragePair[] {
    return Array.from(this.pairsById.values());
  }

  /**
   * Gets all active pairs
   * 
   * @returns Array of active arbitrage pairs
   */
  getActivePairs(): ArbitragePair[] {
    return this.getAllPairs().filter((pair) => pair.isActive);
  }

  /**
   * Gets pairs that use a specific protocol (either long or short)
   * 
   * @param protocolName - Protocol name (e.g., "hyperliquid", "pacifica")
   * @returns Array of pairs that use the protocol
   */
  getPairsByProtocol(protocolName: string): ArbitragePair[] {
    return this.getAllPairs().filter(
      (pair) =>
        pair.isActive &&
        (pair.longProtocol === protocolName ||
          pair.shortProtocol === protocolName)
    );
  }

  /**
   * Enables or disables a pair
   * 
   * @param pairId - The pair ID
   * @param isActive - Whether the pair should be active
   */
  setPairActive(pairId: string, isActive: boolean): void {
    const pair = this.pairsById.get(pairId);
    if (pair) {
      pair.isActive = isActive;
    } else {
      throw new Error(`Pair with ID "${pairId}" not found`);
    }
  }

  /**
   * Removes a pair from the registry
   * 
   * @param pairId - The pair ID to remove
   */
  removePair(pairId: string): void {
    const pair = this.pairsById.get(pairId);
    if (!pair) {
      return;
    }

    // Remove from asset group
    const assetPairs = this.pairs.get(pair.asset);
    if (assetPairs) {
      const filtered = assetPairs.filter((p) => p.id !== pairId);
      if (filtered.length === 0) {
        this.pairs.delete(pair.asset);
      } else {
        this.pairs.set(pair.asset, filtered);
      }
    }

    // Remove from ID map
    this.pairsById.delete(pairId);
  }

  /**
   * Clears all pairs from the registry
   */
  clear(): void {
    this.pairs.clear();
    this.pairsById.clear();
  }

  /**
   * Gets the count of pairs
   * 
   * @returns Object with total and active pair counts
   */
  getPairCount(): { total: number; active: number } {
    const allPairs = this.getAllPairs();
    return {
      total: allPairs.length,
      active: allPairs.filter((p) => p.isActive).length,
    };
  }
}
