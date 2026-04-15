/**
 * Deposit Handler Interface
 *
 * Each protocol that requires a "Fund Leg" flow must implement this interface.
 * It encapsulates:
 *   1. Bridge configuration (destination chain, recipient resolution)
 *   2. Bridge signing logic (EIP-2612, EIP-3009, etc.)
 *   3. Post-bridge deposit logic (protocol-specific deposit after funds arrive)
 *
 * Pattern: Same adapter/registry approach as `src/lib/arbitrage/adapters`.
 *
 * Adding a new protocol requires:
 *   1. Create a new handler implementing this interface
 *   2. Register it in the DepositHandlerRegistry
 *   3. No changes to use-bridge.ts
 */

import type { BridgeStep } from '../types';

// ─── Context Types ────────────────────────────────────────────────────────────

/**
 * Context passed to resolveRecipient
 * Contains all available wallet addresses the handler can choose from
 */
export interface RecipientContext {
  /** User's EVM wallet address (0x...) */
  walletAddress: string;
  /** User's Solana wallet address (base58), if available */
  solanaRecipientAddress?: string;
}

/**
 * Context passed to executeDeposit after bridge completes
 */
export interface DepositContext {
  /** User's EVM wallet address (0x...) */
  walletAddress: string;
  /** Turnkey organization ID */
  organizationId: string;
  /** Request ID from the bridge execution (for tracking) */
  bridgeRequestId: string;
  /** User's Solana wallet address, if available */
  solanaRecipientAddress?: string;
  /**
   * Exact USDC amount (6 decimals) to move on Solana. Used by Backpack.
   * Other handlers ignore this and use chain balance / backend-built txs.
   */
  depositAmountMicros?: bigint;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

/**
 * Result from signing the bridge transaction
 */
export interface BridgeSignResult {
  /** Hex-encoded signature */
  signature: string;
  /** Execute kind (e.g., 'PERMIT', 'eip3009') */
  executeKind: string;
  /** Execute API (e.g., 'relay', 'swap') */
  executeApi: string;
}

/**
 * Result from the deposit execution
 */
export interface DepositResult {
  /** Transaction hash from the deposit */
  txHash: string;
  /** Protocol name */
  protocol: string;
  /** Bridge request ID for tracing */
  bridgeRequestId: string;
}

// ─── Handler Interface ────────────────────────────────────────────────────────

/**
 * Deposit Handler Interface
 *
 * Each supported protocol implements this to define its complete
 * "Fund Leg" strategy: bridge configuration, signing, and deposit.
 *
 * @example
 * ```typescript
 * class DriftDepositHandler implements DepositHandler {
 *   readonly protocol = 'drift';
 *   readonly destinationChainId = CHAIN_IDS.SOLANA;
 *   // ... implement all methods
 * }
 * ```
 */
export interface DepositHandler {
  /** Protocol identifier (e.g., 'hyperliquid', 'pacifica') */
  readonly protocol: string;

  /** Destination chain ID for the bridge (e.g., CHAIN_IDS.ARBITRUM, CHAIN_IDS.SOLANA) */
  readonly destinationChainId: number;

  /**
   * Resolves the recipient address for the bridge transaction.
   *
   * Different protocols bridge to different chains, so the recipient
   * address format and source differ:
   * - EVM protocols: return the user's EVM address
   * - Solana protocols: return the user's Solana address
   *
   * @param context - Available wallet addresses
   * @returns The recipient address for the bridge
   * @throws Error if the required wallet address is not available
   */
  resolveRecipient(context: RecipientContext): string;

  /**
   * Signs the bridge transaction using the protocol-specific method.
   *
   * Extracts signing data from the quote response's signature step,
   * signs it, and returns the signature with execute parameters.
   *
   * - EVM → Arbitrum: EIP-2612 Permit
   * - EVM → Solana: EIP-3009 TransferWithAuthorization
   *
   * @param signatureStep - The signature step from the bridge quote response
   * @param walletAddress - User's EVM wallet address (signer)
   * @param organizationId - Turnkey organization ID
   * @returns Signature and execute parameters
   */
  signBridgeTransaction(
    signatureStep: BridgeStep,
    walletAddress: string,
    organizationId: string
  ): Promise<BridgeSignResult>;

  /**
   * Executes the protocol-specific deposit after the bridge completes.
   *
   * This is called after USDC has arrived on the destination chain.
   * Each protocol has its own deposit mechanism:
   * - Hyperliquid: permit + deposit via API
   * - Pacifica: partially-signed Solana tx + submit
   *
   * @param context - Deposit context with wallet info and bridge request ID
   * @returns Deposit result with transaction hash
   */
  executeDeposit(context: DepositContext): Promise<DepositResult>;
}
