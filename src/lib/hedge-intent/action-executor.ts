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
import {
  trackBridgeStarted,
  trackBridgeCompleted,
  trackBridgeFailed,
  trackDepositStarted,
  trackDepositCompleted,
  trackDepositFailed,
  trackPositionOpened,
  trackPositionOpenFailed,
  trackPositionClosed,
  trackPositionCloseFailed,
  trackReferralCodeClaimed,
  trackBuilderCodeApproved,
} from '@/lib/analytics';
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

// ─── LocalStorage Keys for Pacifica Access ───────────────────────────────────

const PACIFICA_REFERRAL_PREFIX = 'pacifica_referral_claimed_';
const PACIFICA_BUILDER_PREFIX = 'pacifica_builder_approved_';

function isPacificaReferralCached(account: string): boolean {
  try {
    return localStorage.getItem(`${PACIFICA_REFERRAL_PREFIX}${account}`) === '1';
  } catch {
    return false;
  }
}

function cachePacificaReferral(account: string): void {
  try {
    localStorage.setItem(`${PACIFICA_REFERRAL_PREFIX}${account}`, '1');
  } catch {
    /* localStorage not available */
  }
}

function isPacificaBuilderCached(account: string): boolean {
  try {
    return localStorage.getItem(`${PACIFICA_BUILDER_PREFIX}${account}`) === '1';
  } catch {
    return false;
  }
}

function cachePacificaBuilder(account: string): void {
  try {
    localStorage.setItem(`${PACIFICA_BUILDER_PREFIX}${account}`, '1');
  } catch {
    /* localStorage not available */
  }
}

function storeBridgeRequestId(legId: string, requestId: string): void {
  try {
    localStorage.setItem(`${BRIDGE_REQUEST_PREFIX}${legId}`, requestId);
  } catch {
    /* localStorage not available */
  }
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
  } catch {
    /* noop */
  }
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
  async execute(action: NextActionResponse, context: ExecutorContext): Promise<ActionResult> {
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
    const handler =
      exchange === 'hyperliquid' ? this.hlDepositHandler : this.pacificaDepositHandler;
    const chainLabel = exchange === 'hyperliquid' ? 'Arbitrum' : 'Solana';

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
          try {
            await pollBridgeStatus(existingRequestId);
            clearBridgeRequestId(legId);
            return { success: true, txHash: existingRequestId, error: null, legResults: null };
          } catch (pollErr) {
            clearBridgeRequestId(legId);
            const errMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
            return {
              success: false,
              txHash: existingRequestId,
              error: `Bridge to ${chainLabel} failed while waiting for confirmation: ${errMsg}`,
              legResults: null,
            };
          }
        }
      } catch {
        // Can't check — try from scratch
        clearBridgeRequestId(legId);
      }
    }

    // ── Fresh bridge execution ──
    trackBridgeStarted(exchange, String(action.amount_usd));
    try {
      // Convert USD amount to USDC smallest unit (6 decimals)
      const amountUsd = action.amount_usd!;
      const amountSmallestUnit = Math.floor(amountUsd * 1_000_000).toString();

      // Recipient: EVM address for Arb, Solana address for Sol
      const recipient =
        params.recipient || (exchange === 'hyperliquid' ? context.evmAddress : context.solanaAddress);

      // 1. Get bridge quote
      const quoteRequest: QuoteRequest = {
        user: context.evmAddress,
        destinationChainId: params.destination_chain_id,
        amount: amountSmallestUnit,
        tradeType: 'EXACT_INPUT',
        usePermit: true,
        recipient,
      };

      let quoteResponse;
      try {
        quoteResponse = await bridgeService.getQuote(quoteRequest);
      } catch (quoteErr) {
        const errMsg = quoteErr instanceof Error ? quoteErr.message : String(quoteErr);
        return {
          success: false,
          txHash: null,
          error: `Failed to get bridge quote for ${chainLabel}: ${errMsg}`,
          legResults: null,
        };
      }

      // 2. Find signature step
      const signatureStep = quoteResponse.steps.find((step) => step.kind === 'signature');
      if (!signatureStep) {
        return {
          success: false,
          txHash: null,
          error: `Bridge to ${chainLabel}: no signature step found in quote response`,
          legResults: null,
        };
      }

      const requestId = signatureStep.requestId;

      // Store for resumability
      storeBridgeRequestId(legId, requestId);

      // 3. Sign (protocol-specific via existing DepositHandler)
      let signResult;
      try {
        signResult = await handler.signBridgeTransaction(
          signatureStep,
          context.evmAddress,
          context.organizationId
        );
      } catch (signErr) {
        clearBridgeRequestId(legId);
        const errMsg = signErr instanceof Error ? signErr.message : String(signErr);
        return {
          success: false,
          txHash: null,
          error: `Failed to sign bridge transaction for ${chainLabel}: ${errMsg}`,
          legResults: null,
        };
      }

      // 4. Execute permit via Relay
      try {
        await bridgeService.executePermit({
          signature: signResult.signature,
          kind: signResult.executeKind,
          requestId,
          api: signResult.executeApi,
        });
      } catch (permitErr) {
        clearBridgeRequestId(legId);
        const errMsg = permitErr instanceof Error ? permitErr.message : String(permitErr);
        return {
          success: false,
          txHash: requestId,
          error: `Bridge to ${chainLabel} permit execution failed: ${errMsg}`,
          legResults: null,
        };
      }

      // 5. Poll until bridge completes
      try {
        await pollBridgeStatus(requestId);
      } catch (pollErr) {
        clearBridgeRequestId(legId);
        const errMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
        return {
          success: false,
          txHash: requestId,
          error: `Bridge to ${chainLabel} failed during confirmation: ${errMsg}`,
          legResults: null,
        };
      }

      clearBridgeRequestId(legId);

      trackBridgeCompleted(exchange, requestId);
      return {
        success: true,
        txHash: requestId,
        error: null,
        legResults: null,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      trackBridgeFailed(exchange, errMsg);
      return {
        success: false,
        txHash: null,
        error: `Bridge to ${chainLabel} failed: ${errMsg}`,
        legResults: null,
      };
    }
  }

  // ─── Deposit ─────────────────────────────────────────────────────────────

  /**
   * Execute a deposit action (USDC → protocol margin account).
   * Delegates entirely to the existing DepositHandler.
   *
   * Deposits are NOT retried on failure — each attempt costs a signature,
   * and the user should be shown the error immediately.
   */
  private async executeDeposit(
    context: ExecutorContext,
    exchange: Exchange,
    action: NextActionResponse
  ): Promise<ActionResult> {
    const handler =
      exchange === 'hyperliquid' ? this.hlDepositHandler : this.pacificaDepositHandler;
    const exchangeLabel = exchange === 'hyperliquid' ? 'Hyperliquid' : 'Pacifica';

    const legId = ((action.params as Record<string, unknown>)?.leg_id as string) || '';

    // Ensure referral code claimed + builder code approved before depositing to Pacifica
    if (exchange === 'pacifica') {
      const accessError = await this.ensurePacificaAccess(context);
      if (accessError) return accessError;
    }

    trackDepositStarted(exchange);
    try {
      const depositResult = await handler.executeDeposit({
        walletAddress: context.evmAddress,
        organizationId: context.organizationId,
        bridgeRequestId: legId,
        solanaRecipientAddress: context.solanaAddress,
      });

      if (!depositResult || !depositResult.txHash) {
        trackDepositFailed(exchange, 'No transaction hash returned');
        return {
          success: false,
          txHash: null,
          error: `Deposit to ${exchangeLabel} returned no transaction hash — deposit may not have completed`,
          legResults: null,
        };
      }

      trackDepositCompleted(exchange, depositResult.txHash);
      return {
        success: true,
        txHash: depositResult.txHash,
        error: null,
        legResults: null,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[HedgeExecutor] Deposit to ${exchangeLabel} failed:`, err);
      trackDepositFailed(exchange, errMsg);
      return {
        success: false,
        txHash: null,
        error: `Deposit to ${exchangeLabel} failed: ${errMsg}`,
        legResults: null,
      };
    }
  }

  // ─── Pacifica Access Setup ──────────────────────────────────────────────

  /**
   * Ensure the user has full Pacifica access:
   *  1. Referral code claimed (grants beta/whitelist access)
   *  2. Builder code approved (allows builder_code in orders)
   *
   * Results are cached in localStorage per account — subsequent deposits
   * skip the API check entirely. Only signs if needed on first encounter.
   */
  private async ensurePacificaAccess(
    context: ExecutorContext
  ): Promise<ActionResult | null> {
    const account = context.solanaAddress;

    // ── 1. Referral code claim (beta access) ──
    if (isPacificaReferralCached(account)) {
      console.log('[HedgeExecutor] Pacifica beta access already confirmed (cached) ✓');
    } else {
      try {
        console.log('[HedgeExecutor] Checking Pacifica beta access (referral code)...');
        const userId = context.organizationId;
        const hasBetaAccess = await this.pacificaService.checkReferralCodeClaimed(userId);

        if (!hasBetaAccess) {
          console.log('[HedgeExecutor] No beta access — claiming referral code NUKETRADE...');
          const claimResult = await this.pacificaService.claimReferralCode(
            account,
            context.organizationId,
            userId
          );

          if (!claimResult.success) {
            return {
              success: false,
              txHash: null,
              error: claimResult.error || 'Pacifica referral code claim failed.',
              legResults: null,
            };
          }
          console.log('[HedgeExecutor] Referral code NUKETRADE claimed ✓');
          trackReferralCodeClaimed();
        } else {
          console.log('[HedgeExecutor] Pacifica beta access already active ✓');
        }

        cachePacificaReferral(account);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[HedgeExecutor] Referral code claim failed:', err);
        return {
          success: false,
          txHash: null,
          error: `Pacifica referral code claim failed: ${errMsg}`,
          legResults: null,
        };
      }
    }

    // ── 2. Builder code approval (fee sharing on orders) ──
    if (isPacificaBuilderCached(account)) {
      console.log('[HedgeExecutor] Builder code NUKETRADE already approved (cached) ✓');
    } else {
      try {
        console.log('[HedgeExecutor] Checking builder code approval on Pacifica...');
        const isApproved = await this.pacificaService.checkBuilderCodeApproval(account);

        if (!isApproved) {
          console.log('[HedgeExecutor] Builder code not yet approved — submitting approval...');
          const approvalResult = await this.pacificaService.approveBuilderCode(
            account,
            context.organizationId
          );

          if (!approvalResult.success) {
            return {
              success: false,
              txHash: null,
              error: approvalResult.error || 'Pacifica builder code approval failed.',
              legResults: null,
            };
          }
          console.log('[HedgeExecutor] Builder code NUKETRADE approved ✓');
          trackBuilderCodeApproved();
        } else {
          console.log('[HedgeExecutor] Builder code NUKETRADE already approved ✓');
        }

        cachePacificaBuilder(account);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[HedgeExecutor] Builder code approval failed:', err);
        return {
          success: false,
          txHash: null,
          error: `Pacifica builder code approval failed: ${errMsg}`,
          legResults: null,
        };
      }
    }

    return null; // success — no error
  }

  // ─── Open Hedge Position ─────────────────────────────────────────────────

  /**
   * Open delta-neutral positions on both exchanges.
   *
   * Flow:
   * 1. Determine long/short direction from spread APR data
   * 2. Fetch current leverage on both exchanges — only update if different
   * 3. Fetch market price
   * 4. Cap margin to actual Pacifica balance (both legs equally, stays delta-neutral)
   * 5. Open positions on both exchanges (parallel)
   *
   * Uses effective_margin_usd (min of funded amounts) to ensure
   * both legs are equally sized → delta-neutral.
   *
   * Reports per-leg results so the backend can activate Safety Mode
   * if one leg fails.
   *
   * Every sub-step has explicit error handling — a failure at any point
   * returns immediately with a descriptive error. No further steps run.
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
      console.warn(
        `[HedgeExecutor] No spread APR data for ${asset}, defaulting HL=long, Pacifica=short`
      );
      getDirection = (exchange: Exchange) => (exchange === 'hyperliquid' ? 'long' : 'short');
    }

    // ── Step 2: Check current leverage and update only if different ──
    console.log(`[HedgeExecutor] Checking leverage for ${asset} on both exchanges...`);

    // Fetch current leverage from both exchanges in parallel
    const [hlCurrentLeverage, pacCurrentLeverage] = await Promise.allSettled([
      this.hlService.fetchUserLeverage(context.evmAddress, asset.toUpperCase()),
      this.pacificaService.fetchLeverage(context.solanaAddress, asset.toUpperCase()),
    ]);

    // Determine if HL leverage needs updating
    let hlNeedsUpdate = true;
    if (hlCurrentLeverage.status === 'fulfilled' && hlCurrentLeverage.value.success) {
      const currentHlLev = hlCurrentLeverage.value.leverage;
      if (currentHlLev !== undefined && currentHlLev !== null && currentHlLev === leverage) {
        console.log(`[HedgeExecutor] HL leverage already ${leverage}x — skipping update`);
        hlNeedsUpdate = false;
      }
    }
    // If fetch failed, we still try to update (better to attempt than skip)

    // Determine if Pacifica leverage needs updating
    let pacNeedsUpdate = true;
    if (pacCurrentLeverage.status === 'fulfilled' && pacCurrentLeverage.value.success) {
      const currentPacLev = pacCurrentLeverage.value.leverage;
      // null means default (max leverage) — always update in that case
      if (currentPacLev !== null && currentPacLev === leverage) {
        console.log(`[HedgeExecutor] Pacifica leverage already ${leverage}x — skipping update`);
        pacNeedsUpdate = false;
      }
    }

    // Update leverage where needed
    if (hlNeedsUpdate || pacNeedsUpdate) {
      console.log(
        `[HedgeExecutor] Updating leverage to ${leverage}x —`,
        `HL: ${hlNeedsUpdate ? 'yes' : 'skip'}, Pacifica: ${pacNeedsUpdate ? 'yes' : 'skip'}`
      );

      const leveragePromises: Promise<{ exchange: string; result: { success: boolean; error?: string } }>[] = [];

      if (hlNeedsUpdate) {
        leveragePromises.push(
          this.hlService
            .updateLeverage(
              { assetTicker: asset.toUpperCase(), leverage },
              context.evmAddress,
              context.organizationId
            )
            .then((result) => ({ exchange: 'HyperLiquid', result }))
            .catch((err) => ({
              exchange: 'HyperLiquid',
              result: { success: false, error: err instanceof Error ? err.message : String(err) },
            }))
        );
      }

      if (pacNeedsUpdate) {
        leveragePromises.push(
          this.pacificaService
            .updateLeverage(
              asset.toUpperCase(),
              leverage,
              context.solanaAddress,
              context.organizationId
            )
            .then((result) => ({ exchange: 'Pacifica', result }))
            .catch((err) => ({
              exchange: 'Pacifica',
              result: { success: false, error: err instanceof Error ? err.message : String(err) },
            }))
        );
      }

      const leverageResults = await Promise.all(leveragePromises);

      // Check all leverage results — any failure is fatal
      for (const { exchange, result } of leverageResults) {
        if (!result.success) {
          console.error(`[HedgeExecutor] ${exchange} leverage update failed:`, result.error);
          return {
            success: false,
            txHash: null,
            error: `Failed to set leverage on ${exchange}: ${result.error || 'Unknown error'}`,
            legResults: null,
          };
        }
      }

      console.log(`[HedgeExecutor] Leverage set to ${leverage}x on both exchanges ✓`);
    } else {
      console.log(`[HedgeExecutor] Leverage already ${leverage}x on both exchanges — no update needed ✓`);
    }

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
      console.warn('[HedgeExecutor] Could not fetch market price, adapters will attempt internally:', err);
    }

    // ── Step 4: Cap margin to actual Pacifica balance so both legs stay equal ──
    let marginForLegs = effective_margin_usd;
    try {
      const balanceResult = await this.pacificaService.fetchAccountBalance(context.solanaAddress);
      if (balanceResult.success && balanceResult.availableToSpend > 0) {
        const available = balanceResult.availableToSpend * 0.995;
        if (available < marginForLegs) {
          console.log(
            `[HedgeExecutor] Pacifica available ($${available.toFixed(2)}) < effective_margin ($${marginForLegs.toFixed(2)}) — capping both legs`
          );
          marginForLegs = available;
        }
      }
    } catch (err) {
      console.warn('[HedgeExecutor] Could not fetch Pacifica balance, using effective_margin_usd:', err);
    }

    // ── Step 5: Open both legs in parallel ──
    const results = await Promise.allSettled(
      legs.map(async (leg) => {
        const direction = getDirection(leg.exchange);

        if (leg.exchange === 'hyperliquid') {
          const result = await this.hlAdapter.openPosition({
            asset,
            direction,
            margin: marginForLegs.toString(),
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
            margin: marginForLegs.toString(),
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
    const failedLegs = legResults.filter((lr) => !lr.success);

    // Build a descriptive error message listing which leg(s) failed
    let errorMsg: string | null = null;
    if (!allSucceeded) {
      const failedNames = failedLegs
        .map((lr) => `${lr.exchange === 'hyperliquid' ? 'HyperLiquid' : 'Pacifica'}: ${lr.error || 'unknown'}`)
        .join('; ');
      errorMsg = `Position opening failed — ${failedNames}`;
      trackPositionOpenFailed(asset, errorMsg);
    } else {
      trackPositionOpened(asset, leverage, marginForLegs.toString());
    }

    return {
      success: allSucceeded,
      txHash: null,
      error: errorMsg,
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
      const position = rawPositions.find((p) => p.symbol.toUpperCase() === asset.toUpperCase());

      if (!position) {
        return {
          success: false,
          txHash: null,
          error: `No open position found for ${asset}`,
          legResults: null,
        };
      }

      // Step 3: Close the specific exchange's leg
      const closeResult = exchange === 'hyperliquid'
        ? await this.closeHLPositionAction(position.hyperliquid, asset, context)
        : await this.closePacificaPositionAction(position.pacifica, asset, context);

      if (closeResult.success) {
        trackPositionClosed(asset);
      } else {
        trackPositionCloseFailed(asset, closeResult.error || 'Unknown error');
      }
      return closeResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[HedgeExecutor] Close position failed for ${asset} on ${exchange}:`, error);
      trackPositionCloseFailed(asset, errorMessage);
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
      error: result.success ? null : result.error || 'Failed to close HL position',
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

    const result = await closePacificaPosition(
      pacPosition,
      context.solanaAddress,
      context.organizationId
    );

    return {
      success: result.success,
      txHash: null,
      error: result.success ? null : result.error || 'Failed to close Pacifica position',
      legResults: null,
    };
  }

  // Bridge status polling is now handled by the shared pollBridgeStatus utility
}
