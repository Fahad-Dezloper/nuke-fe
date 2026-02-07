/**
 * Bridge Module
 * Exports all bridge-related functionality
 */

export * from './types';
export * from './bridge.service';
export * from './deposit.service';
export * from './signing';
export * from './solana-signing';
export * from './balance';
export * from './usdc-permit';
export * from './use-bridge';

// Deposit handler system (for protocol-specific fund-leg flows)
export * from './deposit-handlers';
