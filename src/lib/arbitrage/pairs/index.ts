/**
 * Arbitrage Pairs Module
 *
 * Exports pair registry and configuration
 * Note: ArbitragePair type is NOT exported here to avoid duplicate exports.
 * Import it from '@/lib/arbitrage' instead.
 */

export { ArbitragePairRegistry } from './pair-registry';
export { ARBITRAGE_PAIRS, getPairsForAsset, getPairById } from './pair-config';
