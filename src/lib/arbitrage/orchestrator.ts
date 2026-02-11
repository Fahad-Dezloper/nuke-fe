/**
 * Arbitrage Orchestrator
 *
 * Coordinates the execution of arbitrage positions across multiple protocols.
 * Handles opening LONG and SHORT positions, managing failures, and rollbacks.
 */

import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';
import type { ProtocolAdapter } from './adapters/protocol-adapter.interface';
import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  ArbitragePair,
  ArbitrageExecutionResult,
} from './types';
import { ArbitragePairRegistry } from './pairs/pair-registry';
import { ProtocolRegistry } from './protocol-registry';

/**
 * Parameters for executing an arbitrage pair
 */
export interface ExecuteArbitragePairParams {
  /** Pair ID to execute */
  pairId: string;

  /** Total margin to use (will be split in half) */
  margin: string;

  /** Leverage to use for both positions */
  leverage: number;

  /** Wallet address for LONG protocol */
  longWalletAddress: string;

  /** Wallet address for SHORT protocol */
  shortWalletAddress: string;

  /** Turnkey organization ID */
  organizationId: string;

  /** Optional: Market price for limit orders */
  price?: string;

  /** Optional: Whether to use market orders (default: true) */
  isMarket?: boolean;

  /** Optional: Slippage tolerance */
  slippagePercent?: string;
}

/**
 * Arbitrage Orchestrator
 *
 * Coordinates the execution of arbitrage positions across protocols.
 */
export class ArbitrageOrchestrator {
  constructor(
    private pairRegistry: ArbitragePairRegistry,
    private protocolRegistry: ProtocolRegistry
  ) {}

  /**
   * Executes an arbitrage pair by opening LONG and SHORT positions
   *
   * @param params - Execution parameters
   * @returns Arbitrage execution result
   */
  async executeArbitragePair(
    params: ExecuteArbitragePairParams
  ): Promise<ArbitrageExecutionResult> {
    try {
      // 1. Get the pair configuration
      const pair = this.pairRegistry.getPair(params.pairId);
      if (!pair) {
        throw createError(ErrorCode.VALID_INVALID_INPUT, {
          reason: `Arbitrage pair "${params.pairId}" not found or inactive`,
        });
      }

      // 2. Get protocol adapters
      const longAdapter = this.protocolRegistry.get(pair.longProtocol);
      const shortAdapter = this.protocolRegistry.get(pair.shortProtocol);

      // 3. Validate wallets match protocol requirements
      this.validateWallets(
        longAdapter,
        shortAdapter,
        params.longWalletAddress,
        params.shortWalletAddress
      );

      // 4. Split margin in half
      const halfMargin = (parseFloat(params.margin) / 2).toString();

      // 5. Prepare position parameters
      const longParams: UnifiedPositionParams = {
        asset: pair.asset,
        direction: 'long',
        margin: halfMargin,
        leverage: params.leverage,
        walletAddress: params.longWalletAddress,
        organizationId: params.organizationId,
        price: params.price,
        isMarket: params.isMarket ?? true,
        slippagePercent: params.slippagePercent,
      };

      const shortParams: UnifiedPositionParams = {
        asset: pair.asset,
        direction: 'short',
        margin: halfMargin,
        leverage: params.leverage,
        walletAddress: params.shortWalletAddress,
        organizationId: params.organizationId,
        price: params.price,
        isMarket: params.isMarket ?? true,
        slippagePercent: params.slippagePercent,
      };

      // 6. Execute both positions in parallel (allSettled ensures we always get both results)
      const [longSettled, shortSettled] = await Promise.allSettled([
        longAdapter.openPosition(longParams),
        shortAdapter.openPosition(shortParams),
      ]);

      // Extract results — convert rejected promises to failed position results
      const longResult: UnifiedPositionResult =
        longSettled.status === 'fulfilled'
          ? longSettled.value
          : {
              success: false,
              positionId: '',
              protocol: pair.longProtocol,
              asset: pair.asset,
              direction: 'long' as const,
              size: '0',
              entryPrice: '0',
              margin: halfMargin,
              leverage: params.leverage,
              error: longSettled.reason?.message || 'Unknown error opening LONG position',
            };

      const shortResult: UnifiedPositionResult =
        shortSettled.status === 'fulfilled'
          ? shortSettled.value
          : {
              success: false,
              positionId: '',
              protocol: pair.shortProtocol,
              asset: pair.asset,
              direction: 'short' as const,
              size: '0',
              entryPrice: '0',
              margin: halfMargin,
              leverage: params.leverage,
              error: shortSettled.reason?.message || 'Unknown error opening SHORT position',
            };

      // 7. Handle results
      if (longResult.success && shortResult.success) {
        // Both succeeded - return success
        return {
          success: true,
          pairId: pair.id,
          asset: pair.asset,
          longPosition: longResult,
          shortPosition: shortResult,
          totalMargin: params.margin,
          leverage: params.leverage,
          message: `Arbitrage position opened successfully: ${pair.name}`,
        };
      } else {
        // One or both failed - handle rollback
        return await this.handlePartialFailure(longResult, shortResult, pair, params);
      }
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CREATE_FAILED);
      console.error('Error executing arbitrage pair:', appError);

      return {
        success: false,
        pairId: params.pairId,
        asset: '',
        longPosition: {
          success: false,
          positionId: '',
          protocol: '',
          asset: '',
          direction: 'long',
          size: '0',
          entryPrice: '0',
          margin: '0',
          leverage: params.leverage,
          error: getUserMessage(appError),
        },
        shortPosition: {
          success: false,
          positionId: '',
          protocol: '',
          asset: '',
          direction: 'short',
          size: '0',
          entryPrice: '0',
          margin: '0',
          leverage: params.leverage,
          error: getUserMessage(appError),
        },
        totalMargin: params.margin,
        leverage: params.leverage,
        error: getUserMessage(appError),
        message: `Failed to execute arbitrage pair: ${getUserMessage(appError)}`,
      };
    }
  }

  /**
   * Validates that wallets match protocol requirements
   *
   * @param longAdapter - LONG protocol adapter
   * @param shortAdapter - SHORT protocol adapter
   * @param longWallet - LONG wallet address
   * @param shortWallet - SHORT wallet address
   */
  private validateWallets(
    longAdapter: ProtocolAdapter,
    shortAdapter: ProtocolAdapter,
    longWallet: string,
    shortWallet: string
  ): void {
    const longWalletType = longAdapter.getRequiredWalletType();
    const shortWalletType = shortAdapter.getRequiredWalletType();

    // Note: In a real implementation, you'd validate the actual wallet type
    // For now, we just check that wallets are provided
    if (!longWallet) {
      throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED, {
        protocol: longAdapter.getMetadata().name,
        walletType: longWalletType,
      });
    }

    if (!shortWallet) {
      throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED, {
        protocol: shortAdapter.getMetadata().name,
        walletType: shortWalletType,
      });
    }

    // Additional validation could check wallet format matches expected type
    // (e.g., Ethereum addresses start with 0x, Solana addresses are base58)
  }

  /**
   * Handles partial failure - when one position succeeds and one fails
   *
   * @param longResult - LONG position result
   * @param shortResult - SHORT position result
   * @param pair - The arbitrage pair
   * @param params - Original execution parameters
   * @returns Execution result with rollback information
   */
  private async handlePartialFailure(
    longResult: UnifiedPositionResult,
    shortResult: UnifiedPositionResult,
    pair: ArbitragePair,
    params: ExecuteArbitragePairParams
  ): Promise<ArbitrageExecutionResult> {
    let rollbackPerformed = false;
    let rollbackError: string | undefined;

    // If LONG succeeded but SHORT failed, close LONG position
    if (longResult.success && !shortResult.success) {
      try {
        const longAdapter = this.protocolRegistry.get(pair.longProtocol);
        await longAdapter.closePosition(
          longResult.positionId,
          params.longWalletAddress,
          params.organizationId
        );
        rollbackPerformed = true;
      } catch (error) {
        rollbackError = error instanceof Error ? error.message : 'Failed to rollback LONG position';
        console.error('Rollback failed for LONG position:', error);
      }
    }

    // If SHORT succeeded but LONG failed, close SHORT position
    if (shortResult.success && !longResult.success) {
      try {
        const shortAdapter = this.protocolRegistry.get(pair.shortProtocol);
        await shortAdapter.closePosition(
          shortResult.positionId,
          params.shortWalletAddress,
          params.organizationId
        );
        rollbackPerformed = true;
      } catch (error) {
        rollbackError =
          error instanceof Error ? error.message : 'Failed to rollback SHORT position';
        console.error('Rollback failed for SHORT position:', error);
      }
    }

    // Build error message
    const errors: string[] = [];
    if (!longResult.success) {
      errors.push(`LONG (${pair.longProtocol}): ${longResult.error || 'Unknown error'}`);
    }
    if (!shortResult.success) {
      errors.push(`SHORT (${pair.shortProtocol}): ${shortResult.error || 'Unknown error'}`);
    }

    return {
      success: false,
      pairId: pair.id,
      asset: pair.asset,
      longPosition: longResult,
      shortPosition: shortResult,
      totalMargin: params.margin,
      leverage: params.leverage,
      error: errors.join('; '),
      message: `Arbitrage execution failed: ${errors.join('; ')}`,
      rollbackPerformed,
      ...(rollbackError && { rollbackError }),
    };
  }
}
