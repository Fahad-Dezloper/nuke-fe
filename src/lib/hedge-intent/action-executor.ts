/**
 * Hedge Intent Action Executor
 *
 * Maps each HedgeAction from the backend to existing infrastructure:
 *   - Bridge actions  → DepositHandler.signBridgeTransaction() + bridgeService
 *   - Deposit actions → DepositHandler.executeDeposit()
 *   - Position actions→ ProtocolAdapter.openPosition() / closePosition()
 *
 * This class does NOT decide what to execute — the backend does.
 * It only knows HOW to execute each action type.
 */

import { bridgeService } from '@/lib/bridge/bridge.service';
import { pollBridgeStatus } from '@/lib/bridge/poll-bridge-status';
import { HyperliquidDepositHandler } from '@/lib/bridge/deposit-handlers/hyperliquid.handler';
import { PacificaDepositHandler } from '@/lib/bridge/deposit-handlers/pacifica.handler';
import { HyperLiquidAdapter } from '@/lib/arbitrage/adapters/hyperliquid-adapter';
import { PacificaAdapter } from '@/lib/arbitrage/adapters/pacifica-adapter';
import { HyperLiquidService } from '@/lib/services/hyperliquid/hyperliquid.service';
import { PacificaService } from '@/lib/services/pacifica/pacifica.service';
import { MarketPriceHelper } from '@/dex/hyperliquid/utils/market-price';
import { positionsService } from '@/lib/api/services/positions.service';
import { closeHLPosition, closePacificaPosition } from '@/lib/trading/close-position';
import type { QuoteRequest } from '@/lib/bridge/types';
import type { SpreadAprMap } from '@/lib/api/services/apr.service';
import type {
  NextActionResponse,
  LegResultEntry,
  Exchange,
  BridgeActionParams,
  OpenPositionActionParams,
  ClosePositionActionParams,
} from './types';

// ─── Context ─────────────────────────────────────────────────────────────────

/**
 * Context required by the executor to sign and submit transactions.
 * Provided by the React hook from Turnkey state.
 */
export interface ExecutorContext {
  /** User's EVM wallet address (0x...) */
  evmAddress: string;
  /** User's Solana wallet address (base58) */
  solanaAddress: string;
  /** Turnkey organization ID */
  organizationId: string;
  /** Spread APR data for determining long/short direction */
  spreadAprData: SpreadAprMap;
}

// ─── Result ──────────────────────────────────────────────────────────────────

/**
 * Unified result from executing any action.
 * Mapped to ActionResultRequest before reporting to backend.
 */
export interface ActionResult {
  success: boolean;
  txHash: string | null;
  error: string | null;
  legResults: LegResultEntry[] | null;
}

// ─── LocalStorage Keys for Bridge Resumability ───────────────────────────────

const BRIDGE_REQUEST_PREFIX = 'hedge_bridge_';

function storeBridgeRequestId(legId: string, requestId: string): void {
  try {
    localStorage.setItem(`${BRIDGE_REQUEST_PREFIX}${legId}`, requestId);
  } catch { /* localStorage not available */ }
}

function loadBridgeRequestId(legId: string): string | null {
  try {
    return localStorage.getItem(`${BRIDGE_REQUEST_PREFIX}${legId}`);
  } catch {
    return null;
  }
}

function clearBridgeRequestId(legId: string): void {
  try {
    localStorage.removeItem(`${BRIDGE_REQUEST_PREFIX}${legId}`);
  } catch { /* noop */ }
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Hedge Action Executor
 *
 * Knows HOW to execute each action type by delegating to existing
 * deposit handlers, protocol adapters, and the bridge service.
 */
export class HedgeActionExecutor {
  private hlDepositHandler: HyperliquidDepositHandler;
  private pacificaDepositHandler: PacificaDepositHandler;
  private hlAdapter: HyperLiquidAdapter;
  private pacificaAdapter: PacificaAdapter;
  private hlService: HyperLiquidService;
  private pacificaService: PacificaService;
  private priceHelper: MarketPriceHelper;

  constructor() {
    this.hlDepositHandler = new HyperliquidDepositHandler();
    this.pacificaDepositHandler = new PacificaDepositHandler();
    this.hlService = new HyperLiquidService();
    this.pacificaService = new PacificaService();
    this.hlAdapter = new HyperLiquidAdapter(this.hlService);
    this.pacificaAdapter = new PacificaAdapter(this.pacificaService);
    this.priceHelper = new MarketPriceHelper();
  }

  /**
   * Execute a single action.
   * Dispatches to the correct handler based on action type.
   */
  async execute(
    action: NextActionResponse,
    context: ExecutorContext
  ): Promise<ActionResult> {
    switch (action.action) {
      case 'BRIDGE_BASE_TO_ARB':
        return this.executeBridge(action, context, 'hyperliquid');

      case 'BRIDGE_BASE_TO_SOL':
        return this.executeBridge(action, context, 'pacifica');

      case 'DEPOSIT_TO_HYPERLIQUID':
        return this.executeDeposit(context, 'hyperliquid', action);

      case 'DEPOSIT_TO_PACIFICA':
        return this.executeDeposit(context, 'pacifica', action);

      case 'OPEN_HEDGE_POSITION':
        return this.executeOpenPosition(action, context);

      case 'CLOSE_POSITION':
        return this.executeClosePosition(action, context);

      default:
        return {
          success: false,
          txHash: null,
          error: `Unknown action: ${action.action}`,
          legResults: null,
        };
    }
  }

  // ─── Bridge ──────────────────────────────────────────────────────────────

  /**
   * Execute a bridge action (Base → Arb or Base → Sol).
   *
   * Flow:
   * 1. Check for stored requestId (resumability after refresh)
   * 2. If stored, poll for existing bridge status
   * 3. If not stored: get quote → sign → execute permit → poll status
   * 4. Return result
   *
   * Uses the existing DepositHandler for signing (protocol-specific).
   */
  private async executeBridge(
    action: NextActionResponse,
    context: ExecutorContext,
    exchange: Exchange
  ): Promise<ActionResult> {
    const params = action.params as unknown as BridgeActionParams;
    const legId = params.leg_id;
    const handler = exchange === 'hyperliquid'
      ? this.hlDepositHandler
      : this.pacificaDepositHandler;

    // ── Check for an in-flight bridge from a previous session ──
    const existingRequestId = loadBridgeRequestId(legId);
    if (existingRequestId) {
      try {
        const status = await bridgeService.getStatus(existingRequestId);
        if (status.status === 'success') {
          clearBridgeRequestId(legId);
          return { success: true, txHash: existingRequestId, error: null, legResults: null };
        }
        if (status.status === 'failure' || status.status === 'refunded') {
          clearBridgeRequestId(legId);
          // Fall through to retry bridge from scratch
        } else {
          // Still in progress — wait for it
          await pollBridgeStatus(existingRequestId);
          clearBridgeRequestId(legId);
          return { success: true, txHash: existingRequestId, error: null, legResults: null };
        }
      } catch {
        // Can't check — try from scratch
        clearBridgeRequestId(legId);
      }
    }

    // ── Fresh bridge execution ──

    // Convert USD amount to USDC smallest unit (6 decimals)
    const amountUsd = action.amount_usd!;
    const amountSmallestUnit = Math.floor(amountUsd * 1_000_000).toString();

    // Recipient: EVM address for Arb, Solana address for Sol
    const recipient = params.recipient || (
      exchange === 'hyperliquid' ? context.evmAddress : context.solanaAddress
    );

    // 1. Get bridge quote
    const quoteRequest: QuoteRequest = {
      user: context.evmAddress,
      destinationChainId: params.destination_chain_id,
      amount: amountSmallestUnit,
      tradeType: 'EXACT_INPUT',
      usePermit: true,
      recipient,
    };

    const quoteResponse = await bridgeService.getQuote(quoteRequest);

    // 2. Find signature step
    const signatureStep = quoteResponse.steps.find(
      (step) => step.kind === 'signature'
    );
    if (!signatureStep) {
      throw new Error('No signature step found in bridge quote response');
    }

    const requestId = signatureStep.requestId;

    // Store for resumability
    storeBridgeRequestId(legId, requestId);

    // 3. Sign (protocol-specific via existing DepositHandler)
    const signResult = await handler.signBridgeTransaction(
      signatureStep,
      context.evmAddress,
      context.organizationId
    );

    // 4. Execute permit via Relay
    await bridgeService.executePermit({
      signature: signResult.signature,
      kind: signResult.executeKind,
      requestId,
      api: signResult.executeApi,
    });

    // 5. Poll until bridge completes
    await pollBridgeStatus(requestId);

    clearBridgeRequestId(legId);

    return {
      success: true,
      txHash: requestId,
      error: null,
      legResults: null,
    };
  }

  // ─── Deposit ─────────────────────────────────────────────────────────────

  /**
   * Execute a deposit action (USDC → protocol margin account).
   * Delegates entirely to the existing DepositHandler.
   */
  private async executeDeposit(
    context: ExecutorContext,
    exchange: Exchange,
    action: NextActionResponse
  ): Promise<ActionResult> {
    const handler = exchange === 'hyperliquid'
      ? this.hlDepositHandler
      : this.pacificaDepositHandler;

    const legId = (action.params as Record<string, unknown>)?.leg_id as string || '';

    const depositResult = await handler.executeDeposit({
      walletAddress: context.evmAddress,
      organizationId: context.organizationId,
      bridgeRequestId: legId,
      solanaRecipientAddress: context.solanaAddress,
    });

    return {
      success: true,
      txHash: depositResult.txHash,
      error: null,
      legResults: null,
    };
  }

  // ─── Open Hedge Position ─────────────────────────────────────────────────

  /**
   * Open delta-neutral positions on both exchanges.
   *
   * Flow:
   * 1. Determine long/short direction from spread APR data
   * 2. Update leverage on both exchanges (parallel)
   * 3. Fetch market price
   * 4. Open positions on both exchanges (parallel)
   *
   * Uses effective_margin_usd (min of funded amounts) to ensure
   * both legs are equally sized → delta-neutral.
   *
   * Reports per-leg results so the backend can activate Safety Mode
   * if one leg fails.
   */
  private async executeOpenPosition(
    action: NextActionResponse,
    context: ExecutorContext
  ): Promise<ActionResult> {
    const params = action.params as unknown as OpenPositionActionParams;
    const { asset, leverage, effective_margin_usd, legs } = params;

    // ── Step 1: Determine long/short direction from spread APR data ──
    const spreadData = context.spreadAprData[asset];
    let getDirection: (exchange: Exchange) => 'long' | 'short';

    if (spreadData) {
      getDirection = (exchange: Exchange) =>
        exchange === spreadData.longPlatform ? 'long' : 'short';
    } else {
      // Fallback: hyperliquid long, pacifica short
      console.warn(`[HedgeExecutor] No spread APR data for ${asset}, defaulting HL=long, Pacifica=short`);
      getDirection = (exchange: Exchange) =>
        exchange === 'hyperliquid' ? 'long' : 'short';
    }

    // ── Step 2: Update leverage on both exchanges ──
    console.log(`[HedgeExecutor] Setting leverage to ${leverage}x on both exchanges...`);

    const [hlLeverageResult, pacificaLeverageResult] = await Promise.allSettled([
      this.hlService.updateLeverage(
        { assetTicker: asset.toUpperCase(), leverage },
        context.evmAddress,
        context.organizationId
      ),
      this.pacificaService.updateLeverage(
        asset.toUpperCase(),
        leverage,
        context.solanaAddress,
        context.organizationId
      ),
    ]);

    // Check HL leverage result
    if (hlLeverageResult.status === 'rejected') {
      console.error('[HedgeExecutor] HL leverage update rejected:', hlLeverageResult.reason);
      return {
        success: false,
        txHash: null,
        error: `Failed to set leverage on HyperLiquid: ${hlLeverageResult.reason?.message || 'Unknown error'}`,
        legResults: null,
      };
    }
    if (!hlLeverageResult.value.success) {
      console.error('[HedgeExecutor] HL leverage update failed:', hlLeverageResult.value.error);
      return {
        success: false,
        txHash: null,
        error: `Failed to set leverage on HyperLiquid: ${hlLeverageResult.value.error}`,
        legResults: null,
      };
    }

    // Check Pacifica leverage result
    if (pacificaLeverageResult.status === 'rejected') {
      console.error('[HedgeExecutor] Pacifica leverage update rejected:', pacificaLeverageResult.reason);
      return {
        success: false,
        txHash: null,
        error: `Failed to set leverage on Pacifica: ${pacificaLeverageResult.reason?.message || 'Unknown error'}`,
        legResults: null,
      };
    }
    if (!pacificaLeverageResult.value.success) {
      console.error('[HedgeExecutor] Pacifica leverage update failed:', pacificaLeverageResult.value.error);
      return {
        success: false,
        txHash: null,
        error: `Failed to set leverage on Pacifica: ${pacificaLeverageResult.value.error}`,
        legResults: null,
      };
    }

    console.log(`[HedgeExecutor] Leverage set to ${leverage}x on both exchanges ✓`);

    // ── Step 3: Fetch market price for position sizing (Pacifica requires it) ──
    let marketPrice: string | undefined;
    try {
      const priceData = await this.priceHelper.getMarketPriceForTrading(
        asset.toUpperCase(),
        'perps',
        'buy'
      );
      marketPrice = priceData.price.toString();
    } catch (err) {
      console.warn('Could not fetch market price, adapters will attempt internally:', err);
    }

    // ── Step 4: Open both legs in parallel ──
    const results = await Promise.allSettled(
      legs.map(async (leg) => {
        const direction = getDirection(leg.exchange);

        if (leg.exchange === 'hyperliquid') {
          const result = await this.hlAdapter.openPosition({
            asset,
            direction,
            margin: effective_margin_usd.toString(),
            leverage,
            walletAddress: context.evmAddress,
            organizationId: context.organizationId,
            isMarket: true,
            price: marketPrice,
          });
          return { exchange: leg.exchange, result };
        } else {
          const result = await this.pacificaAdapter.openPosition({
            asset,
            direction,
            margin: effective_margin_usd.toString(),
            leverage,
            walletAddress: context.solanaAddress,
            organizationId: context.organizationId,
            isMarket: true,
            price: marketPrice,
          });
          return { exchange: leg.exchange, result };
        }
      })
    );

    // Build per-leg results
    const legResults: LegResultEntry[] = results.map((settled, idx) => {
      const exchange = legs[idx].exchange;
      if (settled.status === 'fulfilled') {
        const { result } = settled.value;
        return {
          exchange,
          success: result.success,
          tx_hash: result.positionId || null,
          error: result.error || null,
        };
      }
      return {
        exchange,
        success: false,
        tx_hash: null,
        error: settled.reason?.message || 'Unknown error',
      };
    });

    const allSucceeded = legResults.every((lr) => lr.success);

    return {
      success: allSucceeded,
      txHash: null,
      error: allSucceeded ? null : 'One or more legs failed to open',
      legResults,
    };
  }

  // ─── Close Position (Safety Mode) ────────────────────────────────────────

  /**
   * Close a position on a single exchange (safety mode).
   * Triggered by the backend when one leg has an active position
   * but the other failed.
   *
   * Flow (mirrors use-close-position.ts):
   *  1. Fetch open positions from the aggregate API
   *  2. Find the position for the target asset
   *  3. Close the specific exchange's leg using the service directly
   */
  private async executeClosePosition(
    action: NextActionResponse,
    context: ExecutorContext
  ): Promise<ActionResult> {
    const params = action.params as unknown as ClosePositionActionParams;
    const { exchange, asset } = params;

    try {
      // Step 1: Fetch open positions from the aggregate API
      console.log(`[HedgeExecutor] Fetching open positions to close ${asset} on ${exchange}...`);
      const rawPositions = await positionsService.getOpenPositionsRaw(
        context.evmAddress,
        context.solanaAddress
      );

      // Step 2: Find the position for this asset
      const position = rawPositions.find(
        (p) => p.symbol.toUpperCase() === asset.toUpperCase()
      );

      if (!position) {
        return {
          success: false,
          txHash: null,
          error: `No open position found for ${asset}`,
          legResults: null,
        };
      }

      // Step 3: Close the specific exchange's leg
      if (exchange === 'hyperliquid') {
        return this.closeHLPositionAction(position.hyperliquid, asset, context);
      } else {
        return this.closePacificaPositionAction(position.pacifica, asset, context);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[HedgeExecutor] Close position failed for ${asset} on ${exchange}:`, error);
      return {
        success: false,
        txHash: null,
        error: `Close position failed: ${errorMessage}`,
        legResults: null,
      };
    }
  }

  /**
   * Close a HyperLiquid position using the shared utility.
   */
  private async closeHLPositionAction(
    hlPosition: { symbol: string; size: string; side: 'Long' | 'Short' } | null,
    asset: string,
    context: ExecutorContext
  ): Promise<ActionResult> {
    if (!hlPosition) {
      return {
        success: false,
        txHash: null,
        error: `No HyperLiquid position found for ${asset}`,
        legResults: null,
      };
    }

    console.log(
      `[HedgeExecutor] Closing HL position: ${hlPosition.symbol} ${hlPosition.side} size=${hlPosition.size}`
    );

    const result = await closeHLPosition(hlPosition, context.evmAddress, context.organizationId);

    return {
      success: result.success,
      txHash: null,
      error: result.success ? null : (result.error || 'Failed to close HL position'),
      legResults: null,
    };
  }

  /**
   * Close a Pacifica position using the shared utility.
   */
  private async closePacificaPositionAction(
    pacPosition: { symbol: string; size: string; side: 'Long' | 'Short' } | null,
    asset: string,
    context: ExecutorContext
  ): Promise<ActionResult> {
    if (!pacPosition) {
      return {
        success: false,
        txHash: null,
        error: `No Pacifica position found for ${asset}`,
        legResults: null,
      };
    }

    console.log(
      `[HedgeExecutor] Closing Pacifica position: ${pacPosition.symbol} ${pacPosition.side} size=${pacPosition.size}`
    );

    const result = await closePacificaPosition(pacPosition, context.solanaAddress, context.organizationId);

    return {
      success: result.success,
      txHash: null,
      error: result.success ? null : (result.error || 'Failed to close Pacifica position'),
      legResults: null,
    };
  }

  // Bridge status polling is now handled by the shared pollBridgeStatus utility
}
