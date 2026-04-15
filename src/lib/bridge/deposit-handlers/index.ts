/**
 * Deposit Handlers Module
 *
 * Exports the deposit handler system for protocol-specific fund-leg flows.
 *
 * Pattern: Same adapter/registry approach as `src/lib/arbitrage/adapters`.
 */

// Interface
export type {
  DepositHandler,
  RecipientContext,
  DepositContext,
  BridgeSignResult,
  DepositResult,
} from './deposit-handler.interface';

// Implementations
export { HyperliquidDepositHandler } from './hyperliquid.handler';
export { PacificaDepositHandler } from './pacifica.handler';
export { BackpackDepositHandler } from './backpack.handler';

// Registry
export { DepositHandlerRegistry, createDefaultDepositHandlerRegistry } from './registry';
