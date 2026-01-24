/**
 * Pre-configured Arbitrage Pairs
 * 
 * Defines all available arbitrage pairs for different assets.
 * These pairs can be registered with the ArbitragePairRegistry.
 */

import type { ArbitragePair } from '../types';

/**
 * Pre-defined arbitrage pairs
 * 
 * Each pair represents a specific LONG/SHORT combination
 * across two protocols for a given asset.
 */
export const ARBITRAGE_PAIRS: ArbitragePair[] = [
  // BTC Pairs
  {
    id: 'btc-hl-pacifica',
    asset: 'BTC',
    name: 'HL Long / Pacifica Short',
    longProtocol: 'hyperliquid',
    shortProtocol: 'pacifica',
    isActive: true,
    description: 'Long position on HyperLiquid, Short position on Pacifica',
  },
  // Add more BTC pairs as protocols are added
  // {
  //   id: 'btc-hl-drift',
  //   asset: 'BTC',
  //   name: 'HL Long / Drift Short',
  //   longProtocol: 'hyperliquid',
  //   shortProtocol: 'drift',
  //   isActive: true,
  // },
  // {
  //   id: 'btc-drift-pacifica',
  //   asset: 'BTC',
  //   name: 'Drift Long / Pacifica Short',
  //   longProtocol: 'drift',
  //   shortProtocol: 'pacifica',
  //   isActive: true,
  // },

  // ETH Pairs
  {
    id: 'eth-hl-pacifica',
    asset: 'ETH',
    name: 'HL Long / Pacifica Short',
    longProtocol: 'hyperliquid',
    shortProtocol: 'pacifica',
    isActive: true,
    description: 'Long position on HyperLiquid, Short position on Pacifica',
  },

  // SOL Pairs
  {
    id: 'sol-hl-pacifica',
    asset: 'SOL',
    name: 'HL Long / Pacifica Short',
    longProtocol: 'hyperliquid',
    shortProtocol: 'pacifica',
    isActive: true,
    description: 'Long position on HyperLiquid, Short position on Pacifica',
  },

  // Add more pairs as needed
];

/**
 * Helper function to get pairs for a specific asset
 * 
 * @param asset - Asset symbol
 * @returns Array of pairs for the asset
 */
export function getPairsForAsset(asset: string): ArbitragePair[] {
  return ARBITRAGE_PAIRS.filter(
    (pair) => pair.asset === asset && pair.isActive
  );
}

/**
 * Helper function to get a pair by ID
 * 
 * @param pairId - Pair ID
 * @returns The pair or undefined
 */
export function getPairById(pairId: string): ArbitragePair | undefined {
  return ARBITRAGE_PAIRS.find((pair) => pair.id === pairId);
}
