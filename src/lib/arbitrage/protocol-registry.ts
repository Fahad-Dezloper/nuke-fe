/**
 * Protocol Registry
 * 
 * Manages protocol adapters and provides access to them by name.
 * This allows the orchestrator to retrieve the correct adapter
 * for each protocol in an arbitrage pair.
 */

import type { ProtocolAdapter } from './adapters/protocol-adapter.interface';

/**
 * Protocol Registry
 * 
 * Stores and manages protocol adapters.
 * Provides methods to register and retrieve adapters by protocol name.
 */
export class ProtocolRegistry {
  private adapters: Map<string, ProtocolAdapter> = new Map();

  /**
   * Registers a protocol adapter
   * 
   * @param name - Protocol name (e.g., "hyperliquid", "pacifica")
   * @param adapter - The protocol adapter instance
   */
  register(name: string, adapter: ProtocolAdapter): void {
    if (!name || !adapter) {
      throw new Error('Protocol name and adapter are required');
    }

    if (this.adapters.has(name)) {
      throw new Error(`Protocol "${name}" is already registered`);
    }

    this.adapters.set(name, adapter);
  }

  /**
   * Gets a protocol adapter by name
   * 
   * @param name - Protocol name
   * @returns The protocol adapter
   * @throws Error if protocol is not registered
   */
  get(name: string): ProtocolAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(
        `Protocol "${name}" is not registered. Available protocols: ${Array.from(
          this.adapters.keys()
        ).join(', ')}`
      );
    }
    return adapter;
  }

  /**
   * Gets all registered adapters
   * 
   * @returns Array of all protocol adapters
   */
  getAll(): ProtocolAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Gets all registered protocol names
   * 
   * @returns Array of protocol names
   */
  getProtocolNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Checks if a protocol is registered
   * 
   * @param name - Protocol name
   * @returns True if protocol is registered
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Removes a protocol adapter
   * 
   * @param name - Protocol name to remove
   */
  unregister(name: string): void {
    this.adapters.delete(name);
  }

  /**
   * Clears all registered adapters
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Gets adapters by wallet type
   * 
   * @param walletType - Wallet type ('ethereum' or 'solana')
   * @returns Array of adapters that require the specified wallet type
   */
  getByWalletType(walletType: 'ethereum' | 'solana'): ProtocolAdapter[] {
    return this.getAll().filter(
      (adapter) => adapter.getRequiredWalletType() === walletType
    );
  }
}
