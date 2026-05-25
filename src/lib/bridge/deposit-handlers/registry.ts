/**
 * Deposit Handler Registry
 *
 * Manages deposit handlers and provides access by protocol name.
 * Same pattern as `src/lib/arbitrage/protocol-registry.ts`.
 *
 * Usage:
 *   const registry = createDefaultDepositHandlerRegistry();
 *   const handler = registry.get('hyperliquid');
 */

import type { DepositHandler } from './deposit-handler.interface';
import { HyperliquidDepositHandler } from './hyperliquid.handler';
import { PacificaDepositHandler } from './pacifica.handler';
import { PhoenixDepositHandler } from './phoenix.handler';
// Backpack deposit handler disabled (display-only demo).
// import { BackpackDepositHandler } from './backpack.handler';

/**
 * Deposit Handler Registry
 *
 * Stores and retrieves deposit handlers by protocol name.
 */
export class DepositHandlerRegistry {
  private handlers: Map<string, DepositHandler> = new Map();

  /**
   * Register a deposit handler for a protocol
   *
   * @param handler - The deposit handler to register
   * @throws Error if protocol is already registered
   */
  register(handler: DepositHandler): void {
    if (!handler.protocol) {
      throw new Error('Deposit handler must have a protocol name');
    }

    if (this.handlers.has(handler.protocol)) {
      throw new Error(`Deposit handler for "${handler.protocol}" is already registered`);
    }

    this.handlers.set(handler.protocol, handler);
  }

  /**
   * Get a deposit handler by protocol name
   *
   * @param protocol - Protocol name (e.g., 'hyperliquid', 'pacifica')
   * @returns The deposit handler, or null if not registered
   */
  get(protocol: string): DepositHandler | null {
    return this.handlers.get(protocol) || null;
  }

  /**
   * Check if a handler is registered for a protocol
   *
   * @param protocol - Protocol name
   * @returns True if a handler is registered
   */
  has(protocol: string): boolean {
    return this.handlers.has(protocol);
  }

  /**
   * Get all registered protocol names
   *
   * @returns Array of registered protocol names
   */
  getRegisteredProtocols(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get all registered handlers
   *
   * @returns Array of all deposit handlers
   */
  getAll(): DepositHandler[] {
    return Array.from(this.handlers.values());
  }
}

/**
 * Creates a deposit handler registry pre-configured with all supported protocols.
 *
 * To add a new protocol:
 *   1. Create a new handler implementing DepositHandler
 *   2. Register it here
 *   3. That's it — use-bridge.ts will automatically pick it up
 *
 * @returns Pre-configured DepositHandlerRegistry
 */
export function createDefaultDepositHandlerRegistry(): DepositHandlerRegistry {
  const registry = new DepositHandlerRegistry();

  registry.register(new HyperliquidDepositHandler());
  registry.register(new PacificaDepositHandler());
  registry.register(new PhoenixDepositHandler());
  // registry.register(new BackpackDepositHandler());

  // Future protocols:
  // registry.register(new DriftDepositHandler());

  return registry;
}
