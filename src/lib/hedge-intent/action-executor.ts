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
import { signAndSubmitRelaySolanaTransaction } from '@/lib/bridge/solana-utils';
import { phoenixCollateralCoversDeposit } from '@/lib/bridge/solana-direct-deposit';
import { HyperliquidDepositHandler } from '@/lib/bridge/deposit-handlers/hyperliquid.handler';
import { PacificaDepositHandler } from '@/lib/bridge/deposit-handlers/pacifica.handler';
import { PhoenixDepositHandler } from '@/lib/bridge/deposit-handlers/phoenix.handler';
import { LighterDepositHandler } from '@/lib/bridge/deposit-handlers/lighter.handler';
// Backpack authenticated actions disabled (display-only demo).
// import { BackpackDepositHandler } from '@/lib/bridge/deposit-handlers/backpack.handler';
import { HyperLiquidAdapter } from '@/lib/arbitrage/adapters/hyperliquid-adapter';
import { PacificaAdapter } from '@/lib/arbitrage/adapters/pacifica-adapter';
import { PhoenixAdapter } from '@/lib/arbitrage/adapters/phoenix-adapter';
import { BackpackAdapter } from '@/lib/arbitrage/adapters/backpack-adapter';
import { HyperLiquidService } from '@/lib/services/hyperliquid/hyperliquid.service';
import { PacificaService } from '@/lib/services/pacifica/pacifica.service';
import { PhoenixService } from '@/lib/services/phoenix/phoenix.service';
import { BackpackService } from '@/lib/services/backpack/backpack.service';
import { MarketPriceHelper } from '@/dex/hyperliquid/utils/market-price';
import { positionsService } from '@/lib/api/services/positions.service';
import {
  closeHLPosition,
  closePacificaPosition,
  closePhoenixPosition,
  closeLighterPosition,
} from '@/lib/trading/close-position';
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
import { recordPositionOpenTime } from '@/lib/positions/position-open-time';
import type { QuoteRequest } from '@/lib/bridge/types';
import type {
  NextActionResponse,
  LegResultEntry,
  Exchange,
  HedgePair,
  BridgeActionParams,
  DepositActionParams,
  OpenPositionActionParams,
  ClosePositionActionParams,
} from './types';
import { fetchLighterAvailableUsd, fetchLighterLeverageForMarket, fetchLighterPerpRow } from '@/lib/services/lighter/lighter-reads';
import { getLighterL2Credentials } from '@/lib/services/lighter/lighter-credentials';
import { finalizeLighterL2KeysAfterDeposit } from '@/lib/services/lighter/lighter-onboarding';
import { getSharedLighterAdapter, getSharedLighterService } from '@/lib/services/lighter/lighter-shared-adapter';
import { LighterMarginMode } from '@/lib/services/lighter/utils/tx-constants';
import { buildMirroredTpSlPlan, buildMirroredTpSlPlanFromStops } from './hedge-tpsl';
import type { HedgeExitRangeStops } from './hedge-exit-range';
import { hedgeUsesIsolatedMargin } from '@/lib/trading/margin-mode';
import { runWithRetries } from '@/lib/trading/close-leg-retries';

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
  /** Turnkey organization ID (signing) */
  organizationId: string;
  /** Nuke backend user UUID for `/user/*` routes */
  userId: string;
  /** Long/short venues from UI best pair (position panel / table) */
  hedgePair: HedgePair;
  /** User-selected mirrored exit stops from position panel (required for open). */
  exitRange?: HedgeExitRangeStops;
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

// ─── LocalStorage Keys for Pacifica builder approval cache ───────────────────

const PACIFICA_BUILDER_PREFIX = 'pacifica_builder_approved_';
const HEDGE_ORDER_BUFFER_PCT = 1.0;

/** Backend may send mixed-case exchange ids; leverage + open branches use strict lowercase. */
function normalizeHedgeExchange(raw: string): Exchange {
  return String(raw).trim().toLowerCase() as Exchange;
}

function hedgeExchangeLabel(exchange: string): string {
  switch (normalizeHedgeExchange(exchange)) {
    case 'hyperliquid':
      return 'HyperLiquid';
    case 'pacifica':
      return 'Pacifica';
    case 'lighter':
      return 'Lighter';
    case 'phoenix':
      return 'Phoenix';
    case 'backpack':
      return 'Backpack';
    default:
      return exchange;
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
  private phoenixDepositHandler: PhoenixDepositHandler;
  private lighterDepositHandler: LighterDepositHandler;
  // private backpackDepositHandler: BackpackDepositHandler;
  private hlAdapter: HyperLiquidAdapter;
  private pacificaAdapter: PacificaAdapter;
  private phoenixAdapter: PhoenixAdapter;
  private backpackAdapter: BackpackAdapter;
  private hlService: HyperLiquidService;
  private pacificaService: PacificaService;
  private phoenixService: PhoenixService;
  private backpackService: BackpackService;
  private priceHelper: MarketPriceHelper;

  constructor() {
    this.hlDepositHandler = new HyperliquidDepositHandler();
    this.pacificaDepositHandler = new PacificaDepositHandler();
    this.phoenixDepositHandler = new PhoenixDepositHandler();
    this.lighterDepositHandler = new LighterDepositHandler();
    // this.backpackDepositHandler = new BackpackDepositHandler();
    this.hlService = new HyperLiquidService();
    this.pacificaService = new PacificaService();
    this.phoenixService = new PhoenixService();
    this.backpackService = new BackpackService();
    this.hlAdapter = new HyperLiquidAdapter(this.hlService);
    this.pacificaAdapter = new PacificaAdapter(this.pacificaService);
    this.phoenixAdapter = new PhoenixAdapter();
    this.backpackAdapter = new BackpackAdapter();
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

      case 'BRIDGE_SOL_TO_ARB':
        return this.executeBridge(action, context, 'hyperliquid');

      case 'BRIDGE_SOL_TO_ETH':
      case 'BRIDGE_BASE_TO_LIGHTER':
        return this.executeBridge(action, context, 'lighter');

      case 'DEPOSIT_TO_HYPERLIQUID':
        return this.executeDeposit(context, 'hyperliquid', action);

      case 'DEPOSIT_TO_PACIFICA':
        return this.executeDeposit(context, 'pacifica', action);

      case 'DEPOSIT_TO_PHOENIX':
        return this.executeDeposit(context, 'phoenix', action);

      case 'DEPOSIT_TO_BACKPACK':
        // Backpack display-only: skip authenticated deposit.
        return {
          success: false,
          txHash: null,
          error: 'Backpack funding is disabled in this demo build.',
          legResults: null,
        };

      case 'DEPOSIT_TO_LIGHTER':
        return this.executeDeposit(context, 'lighter', action);

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
      exchange === 'pacifica'
        ? this.pacificaDepositHandler
        : exchange === 'lighter'
          ? this.lighterDepositHandler
          : this.hlDepositHandler;
    const chainLabel =
      exchange === 'pacifica' ? 'Solana' : exchange === 'lighter' ? 'Ethereum' : 'Arbitrum';

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

    // Recipient: destination chain address family (EVM vs Solana)
      const recipient =
        params.recipient ||
        (exchange === 'pacifica' ? context.solanaAddress : context.evmAddress);

      // 1. Get bridge quote
      const quoteRequest: QuoteRequest = {
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

      // 2. Find executable step (new: Solana tx step, legacy: signature step)
      const txStep = quoteResponse.steps.find((step) => step.kind === 'transaction');
      const signatureStep = quoteResponse.steps.find((step) => step.kind === 'signature');

      const requestId = (txStep ?? signatureStep)?.requestId;
      if (!requestId) {
        return {
          success: false,
          txHash: null,
          error: `Bridge to ${chainLabel}: no executable step found in quote response`,
          legResults: null,
        };
      }

      // Store for resumability
      storeBridgeRequestId(legId, requestId);

      if (txStep) {
        // New Solana-origin quote: sign + send a Solana transaction directly.
        try {
          const data = txStep.items?.[0]?.data as
            | {
                addressLookupTableAddresses?: string[];
                instructions?: Array<{
                  programId: string;
                  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
                  data: string;
                }>;
              }
            | undefined;

          if (!data?.instructions?.length) {
            throw new Error('Bridge quote transaction step missing Solana instructions');
          }

          await signAndSubmitRelaySolanaTransaction(
            { addressLookupTableAddresses: data.addressLookupTableAddresses, instructions: data.instructions },
            context.solanaAddress,
            context.organizationId
          );
        } catch (txErr) {
          clearBridgeRequestId(legId);
          const errMsg = txErr instanceof Error ? txErr.message : String(txErr);
          return {
            success: false,
            txHash: requestId,
            error: `Bridge to ${chainLabel} Solana tx failed: ${errMsg}`,
            legResults: null,
          };
        }
      } else {
        if (!signatureStep) {
          clearBridgeRequestId(legId);
          return {
            success: false,
            txHash: requestId,
            error: `Bridge to ${chainLabel}: no signature step found in quote response`,
            legResults: null,
          };
        }

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
    if (exchange === 'backpack') {
      return {
        success: false,
        txHash: null,
        error: 'Backpack funding is disabled in this demo build.',
        legResults: null,
      };
    }
    const handler =
      exchange === 'hyperliquid'
        ? this.hlDepositHandler
        : exchange === 'pacifica'
          ? this.pacificaDepositHandler
          : exchange === 'phoenix'
            ? this.phoenixDepositHandler
            : exchange === 'lighter'
              ? this.lighterDepositHandler
              : this.hlDepositHandler;
    const exchangeLabel =
      exchange === 'hyperliquid'
        ? 'Hyperliquid'
        : exchange === 'pacifica'
          ? 'Pacifica'
          : exchange === 'phoenix'
            ? 'Phoenix'
            : exchange === 'lighter'
              ? 'Lighter'
              : 'Backpack';

    const depositParams = action.params as unknown as DepositActionParams;
    const legId = depositParams.leg_id || '';
    const amountUsd =
      typeof depositParams.amount_usd === 'number' && Number.isFinite(depositParams.amount_usd)
        ? depositParams.amount_usd
        : 0;
    const depositAmountMicros =
      (exchange === 'pacifica' || exchange === 'phoenix') && amountUsd > 0
        ? BigInt(Math.floor(amountUsd * 1_000_000))
        : undefined;

    // Referral (Nuke) + builder approval (Pacifica) before deposit
    if (exchange === 'pacifica') {
      const accessError = await this.ensurePacificaAccess(context);
      if (accessError) return accessError;
    }

    if (exchange === 'phoenix') {
      const existingMarginUsd =
        typeof depositParams.existing_margin_usd === 'number' &&
        Number.isFinite(depositParams.existing_margin_usd)
          ? depositParams.existing_margin_usd
          : 0;

      const alreadyFunded = await phoenixCollateralCoversDeposit(
        context.solanaAddress,
        existingMarginUsd,
        amountUsd
      );

      if (alreadyFunded) {
        console.log(
          `[HedgeExecutor] Phoenix collateral already covers deposit (live ≥ $${(existingMarginUsd + amountUsd).toFixed(2)}) — skipping DEPOSIT_TO_PHOENIX`
        );
        return {
          success: true,
          txHash: null,
          error: null,
          legResults: null,
        };
      }

      const accessError = await this.ensurePhoenixAccess(context);
      if (accessError) return accessError;
    }

    trackDepositStarted(exchange);
    try {
      const depositResult = await handler.executeDeposit({
        walletAddress: context.evmAddress,
        organizationId: context.organizationId,
        bridgeRequestId: legId,
        solanaRecipientAddress: context.solanaAddress,
        depositAmountMicros,
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

      if (exchange === 'lighter') {
        try {
          await finalizeLighterL2KeysAfterDeposit({
            evmAddress: context.evmAddress,
            organizationId: context.organizationId,
          });
        } catch (finalizeErr) {
          console.error('[HedgeExecutor] Lighter L2 keys after deposit:', finalizeErr);
        }
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
   * Pacifica prerequisites before deposit/open:
   *  1. Referral (best-effort, never blocks): Nuke claim-status → claim only when check succeeds and not claimed
   *  2. Builder (required): Pacifica approvals GET — approve only when NUKETRADE is missing
   */
  private async ensurePacificaAccess(
    context: ExecutorContext
  ): Promise<ActionResult | null> {
    const account = context.solanaAddress;

    await this.ensurePacificaReferralBestEffort(context);

    // Builder: always verify on Pacifica when cache miss; never re-approve if already listed
    if (!isPacificaBuilderCached(account)) {
      try {
        const isApproved = await this.pacificaService.checkBuilderCodeApproval(account);
        if (isApproved) {
          cachePacificaBuilder(account);
        } else {
          console.log(
            '[HedgeExecutor] NUKETRADE not in approvals — user must sign Pacifica builder approval in wallet...'
          );
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
          trackBuilderCodeApproved();
          cachePacificaBuilder(account);
        }
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

    return null;
  }

  /** Referral/points only — failures are logged and never surfaced to the user. */
  private async ensurePacificaReferralBestEffort(context: ExecutorContext): Promise<void> {
    const account = context.solanaAddress;

    try {
      const status = await this.pacificaService.checkReferralClaimedOnBackend(context.userId);

      if (!status.ok) {
        console.warn(
          '[HedgeExecutor] Skipping referral claim — Nuke claim-status unavailable (non-fatal)'
        );
        return;
      }

      if (status.claimed) {
        return;
      }

      const claimResult = await this.pacificaService.claimReferralCode(
        account,
        context.organizationId
      );

      if (claimResult.success) {
        trackReferralCodeClaimed();
      }
    } catch (err) {
      console.warn('[HedgeExecutor] Referral step skipped (non-fatal):', err);
    }
  }

  /**
   * Ensure Phoenix invite + on-chain trader registration before deposit or trade.
   */
  private async ensurePhoenixAccess(context: ExecutorContext): Promise<ActionResult | null> {
    try {
      await this.phoenixService.ensureActivatedAndRegistered(
        context.solanaAddress,
        context.organizationId
      );
      return null;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        txHash: null,
        error: `Phoenix onboarding failed: ${errMsg}`,
        legResults: null,
      };
    }
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
    const { asset, leverage, effective_margin_usd, legs: rawLegs } = params;
    const legs = rawLegs.map((l) => ({
      ...l,
      exchange: normalizeHedgeExchange(l.exchange),
    }));

    // Builder approval (required for builder_code on orders). Deposit path runs
    // this too, but users with existing Pacifica margin skip deposit and go straight to open.
    if (legs.some((l) => l.exchange === 'pacifica')) {
      const accessError = await this.ensurePacificaAccess(context);
      if (accessError) return accessError;
    }

    if (legs.some((l) => l.exchange === 'phoenix')) {
      const accessError = await this.ensurePhoenixAccess(context);
      if (accessError) return accessError;
    }

    this.phoenixAdapter.setEvmAddress(context.evmAddress);

    // ── Step 1: Long/short from UI best pair (same as position panel) ──
    const { long: longExchange, short: shortExchange } = context.hedgePair;
    const getDirection = (exchange: Exchange): 'long' | 'short' => {
      const normalized = normalizeHedgeExchange(exchange);
      if (normalized === longExchange) return 'long';
      if (normalized === shortExchange) return 'short';
      console.warn(
        `[HedgeExecutor] Exchange ${exchange} not in hedge pair (${longExchange} long / ${shortExchange} short); defaulting to short`
      );
      return 'short';
    };

    // ── Step 2: Check current leverage and update only if different ──
    console.log(`[HedgeExecutor] Checking leverage for ${asset} on all legs...`);

    const exchangesInLegs = Array.from(new Set(legs.map((l) => l.exchange)));

    const leverageChecks = await Promise.all(
      exchangesInLegs.map(async (ex) => {
        try {
          if (ex === 'hyperliquid') {
            const res = await this.hlService.fetchUserLeverage(
              context.evmAddress,
              asset.toUpperCase()
            );
            return {
              exchange: ex,
              current: res.success ? res.leverage ?? null : null,
              success: res.success,
              error: res.error,
            };
          }
          if (ex === 'pacifica') {
            const res = await this.pacificaService.fetchLeverage(
              context.solanaAddress,
              asset.toUpperCase()
            );
            return {
              exchange: ex,
              current: res.success ? res.leverage : null,
              success: res.success,
              error: res.error,
            };
          }
          if (ex === 'phoenix') {
            const target = Math.round(Number(leverage));
            return { exchange: ex, current: target, success: true, error: undefined };
          }
          if (ex === 'lighter') {
            const row = await fetchLighterPerpRow(asset.toUpperCase());
            if (!row) {
              return { exchange: ex, current: null, success: false, error: 'Lighter market not found' };
            }
            const current = await fetchLighterLeverageForMarket(context.evmAddress, row.market_id);
            return { exchange: ex, current, success: true, error: undefined };
          }
          // backpack (disabled for display-only demo)
          return { exchange: ex, current: null, success: true, error: undefined };
        } catch (err) {
          console.error('[HedgeExecutor] leverage check failed for', ex, err);
          return {
            exchange: ex,
            current: null,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    const leverageUpdates: Promise<{ exchangeLabel: string; ok: boolean; error?: string }>[] = [];

    for (const check of leverageChecks) {
      const { exchange: ex, current } = check;

      const targetLev = Math.round(Number(leverage));
      const currentNum =
        current == null || !Number.isFinite(Number(current)) ? null : Number(current);
      const matchesTarget =
        currentNum != null && Math.round(currentNum) === targetLev;

      // Pacifica leverage is always set again immediately before create_market (Step 5).
      // Phoenix FE leverage updates are not wired yet; skip the bulk update step.
      const needsUpdate =
        ex === 'pacifica' || ex === 'phoenix' ? false : currentNum == null || !matchesTarget;

      if (!needsUpdate) continue;

      if (ex === 'hyperliquid') {
        leverageUpdates.push(
          this.hlService
            .updateLeverage(
              {
                assetTicker: asset.toUpperCase(),
                leverage,
                isCross: !hedgeUsesIsolatedMargin(),
              },
              context.evmAddress,
              context.organizationId
            )
            .then((r) => ({ exchangeLabel: 'HyperLiquid', ok: r.success, error: r.error }))
            .catch((err) => ({ exchangeLabel: 'HyperLiquid', ok: false, error: err instanceof Error ? err.message : String(err) }))
        );
      } else if (ex === 'pacifica') {
        leverageUpdates.push(
          this.pacificaService
            .updateLeverage(asset.toUpperCase(), leverage, context.solanaAddress, context.organizationId)
            .then((r) => ({ exchangeLabel: 'Pacifica', ok: r.success, error: r.error }))
            .catch((err) => ({ exchangeLabel: 'Pacifica', ok: false, error: err instanceof Error ? err.message : String(err) }))
        );
      } else if (ex === 'lighter') {
        leverageUpdates.push(
          (async () => {
            const row = await fetchLighterPerpRow(asset.toUpperCase());
            if (!row) {
              return { exchangeLabel: 'Lighter', ok: false, error: 'Lighter market not found' };
            }
            const creds = getLighterL2Credentials();
            if (!creds) {
              return { exchangeLabel: 'Lighter', ok: false, error: 'Lighter L2 credentials not configured' };
            }
            try {
              await getSharedLighterService().updateLeverage(
                {
                  marketIndex: row.market_id,
                  leverage,
                  marginMode: LighterMarginMode.CROSS,
                  apiKeyIndex: creds.apiKeyIndex,
                },
                { priceProtection: true }
              );
              return { exchangeLabel: 'Lighter', ok: true, error: undefined };
            } catch (err) {
              return {
                exchangeLabel: 'Lighter',
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              };
            }
          })()
        );
      } else {
        leverageUpdates.push(
          this.backpackService
            .updateLeverageLimit({ leverage, solanaAddress: context.solanaAddress, organizationId: context.organizationId })
            .then((r) => ({ exchangeLabel: 'Backpack', ok: r.success, error: r.error }))
            .catch((err) => ({ exchangeLabel: 'Backpack', ok: false, error: err instanceof Error ? err.message : String(err) }))
        );
      }
    }

    if (leverageUpdates.length > 0) {
      const results = await Promise.all(leverageUpdates);
      for (const r of results) {
        if (!r.ok) {
          return {
            success: false,
            txHash: null,
            error: `Failed to set leverage on ${r.exchangeLabel}: ${r.error || 'Unknown error'}`,
            legResults: null,
          };
        }
      }
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
      const needsPacificaCap = legs.some((l) => l.exchange === 'pacifica');
      if (needsPacificaCap) {
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
      }
    } catch (err) {
      console.warn('[HedgeExecutor] Could not fetch Pacifica balance, using effective_margin_usd:', err);
    }

    try {
      const needsPhoenixCap = legs.some((l) => l.exchange === 'phoenix');
      if (needsPhoenixCap) {
        const balanceResult = await this.phoenixService.fetchFreeCollateralUsd(context.solanaAddress);
        if (balanceResult.success && balanceResult.usd > 0) {
          const available = balanceResult.usd * 0.995;
          if (available < marginForLegs) {
            console.log(
              `[HedgeExecutor] Phoenix available ($${available.toFixed(2)}) < effective_margin ($${marginForLegs.toFixed(2)}) — capping both legs`
            );
            marginForLegs = available;
          }
        }
      }
    } catch (err) {
      console.warn('[HedgeExecutor] Could not fetch Phoenix collateral, using effective_margin_usd:', err);
    }

    try {
      const needsLighterCap = legs.some((l) => l.exchange === 'lighter');
      if (needsLighterCap) {
        const ltAvail = await fetchLighterAvailableUsd(context.evmAddress);
        if (ltAvail > 0) {
          const available = ltAvail * 0.995;
          if (available < marginForLegs) {
            console.log(
              `[HedgeExecutor] Lighter available ($${available.toFixed(2)}) < effective_margin ($${marginForLegs.toFixed(2)}) — capping both legs`
            );
            marginForLegs = available;
          }
        }
      }
    } catch (err) {
      console.warn('[HedgeExecutor] Could not fetch Lighter balance, using effective_margin_usd:', err);
    }

    // Apply a final shared buffer before opening positions so both legs keep the same size
    // while reducing risk of per-exchange insufficient-balance rejections.
    const bufferedMarginForLegs = marginForLegs * (1 - HEDGE_ORDER_BUFFER_PCT / 100);
    if (bufferedMarginForLegs > 0) {
      marginForLegs = bufferedMarginForLegs;
    }

    // Shared base size so HL (USD) and Phoenix (BTC lots) match for delta-neutral hedges.
    let hedgeBaseSize: string | undefined;
    if (marketPrice) {
      const px = Number.parseFloat(marketPrice);
      if (Number.isFinite(px) && px > 0) {
        const notionalUsd = marginForLegs * Number(leverage);
        const rawBase = notionalUsd / px;
        hedgeBaseSize = rawBase.toFixed(6).replace(/\.?0+$/, '') || undefined;
      }
    }

    // ── Step 5: Open both legs in parallel ──
    const userExit = context.exitRange;
    const tpSlPlan = userExit
      ? await buildMirroredTpSlPlanFromStops(asset, leverage, {
          longExchange,
          shortExchange,
          marginUsd: marginForLegs,
          lowerStopPrice: userExit.lowerPrice,
          upperStopPrice: userExit.upperPrice,
        })
      : await buildMirroredTpSlPlan(asset, leverage, {
          longExchange,
          shortExchange,
          marginUsd: marginForLegs,
        });
    if (!tpSlPlan) {
      return {
        success: false,
        txHash: null,
        error: userExit
          ? 'Cannot open hedge: exit range is invalid or could not be applied. Adjust stops in the position panel.'
          : 'Cannot open hedge: mirrored TP/SL band is too wide for estimated liquidation on one or both legs',
        legResults: null,
      };
    }

    if (!marketPrice || parseFloat(marketPrice) <= 0) {
      marketPrice = String(tpSlPlan.markPrice);
    }

    const clampLog = tpSlPlan.liquidationClamp
      ? ` band=${tpSlPlan.thresholdPercent.toFixed(2)}% (max target ${tpSlPlan.thresholdPercentDesired}%) ` +
        `margin=$${tpSlPlan.liquidationClamp.marginUsd.toFixed(2)} ` +
        `longLiq=${tpSlPlan.liquidationClamp.longLiquidationPrice.toFixed(2)} (−${tpSlPlan.liquidationClamp.longAdverseMovePercent.toFixed(2)}%) ` +
        `shortLiq=${tpSlPlan.liquidationClamp.shortLiquidationPrice.toFixed(2)} (+${tpSlPlan.liquidationClamp.shortAdverseMovePercent.toFixed(2)}%)`
      : '';

    console.log(
      `[HedgeExecutor] Mirrored TP/SL plan ${asset}: mark=${tpSlPlan.markPrice} ` +
        `threshold=${tpSlPlan.thresholdPercent}% upper=${tpSlPlan.upperStop} lower=${tpSlPlan.lowerStop}${clampLog}`
    );

    const hedgeTpslForDirection = (dir: 'long' | 'short') =>
      dir === 'long' ? tpSlPlan.long : tpSlPlan.short;

    // ── Step 5: Open both legs in parallel (TP/SL on create where supported) ──
    const useIsolatedMargin = hedgeUsesIsolatedMargin();

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
            baseSize: hedgeBaseSize,
            hedgeTpsl: hedgeTpslForDirection(direction),
            useIsolatedMargin,
          });
          return { exchange: leg.exchange, result };
        } else {
          if (leg.exchange === 'pacifica') {
            const pacificaLev = Math.max(1, Math.min(20, Math.round(Number(leverage))));
            if (useIsolatedMargin) {
              const modeRes = await this.pacificaService.fetchIsolatedMargin(
                context.solanaAddress,
                asset.toUpperCase()
              );
              if (modeRes.success && modeRes.isolated === false) {
                const marginModeRes = await this.pacificaService.updateMarginMode(
                  asset.toUpperCase(),
                  true,
                  context.solanaAddress,
                  context.organizationId
                );
                if (!marginModeRes.success) {
                  return {
                    exchange: leg.exchange,
                    result: {
                      success: false,
                      positionId: '',
                      protocol: 'pacifica',
                      asset,
                      direction,
                      size: '0',
                      entryPrice: marketPrice ?? '0',
                      margin: marginForLegs.toString(),
                      leverage: pacificaLev,
                      error:
                        marginModeRes.error ||
                        'Failed to set isolated margin on Pacifica before open',
                      message: marginModeRes.message,
                    },
                  };
                }
              }
            }
            const levRes = await this.pacificaService.updateLeverage(
              asset.toUpperCase(),
              pacificaLev,
              context.solanaAddress,
              context.organizationId
            );
            if (!levRes.success) {
              return {
                exchange: leg.exchange,
                result: {
                  success: false,
                  positionId: '',
                  protocol: 'pacifica',
                  asset,
                  direction,
                  size: '0',
                  entryPrice: marketPrice ?? '0',
                  margin: marginForLegs.toString(),
                  leverage: pacificaLev,
                  error: levRes.error || 'Failed to set leverage on Pacifica before open',
                  message: levRes.message,
                },
              };
            }
            const result = await this.pacificaAdapter.openPosition({
              asset,
              direction,
              margin: marginForLegs.toString(),
              leverage: pacificaLev,
              walletAddress: context.solanaAddress,
              organizationId: context.organizationId,
              isMarket: true,
              price: marketPrice,
              hedgeTpsl: hedgeTpslForDirection(direction),
              useIsolatedMargin,
            });
            return { exchange: leg.exchange, result };
          }

          if (leg.exchange === 'phoenix') {
            const phoenixLev = Math.max(1, Math.round(Number(leverage)));
            await this.phoenixService.updateLeverage(asset.toUpperCase(), phoenixLev);
            const result = await this.phoenixAdapter.openPosition({
              asset,
              direction,
              margin: marginForLegs.toString(),
              leverage: phoenixLev,
              walletAddress: context.solanaAddress,
              organizationId: context.organizationId,
              isMarket: true,
              price: marketPrice,
              baseSize: hedgeBaseSize,
              useIsolatedMargin,
              hedgeTpsl: hedgeTpslForDirection(direction),
            });
            return { exchange: leg.exchange, result };
          }

          if (leg.exchange === 'lighter') {
            const result = await getSharedLighterAdapter().openPosition({
              asset,
              direction,
              margin: marginForLegs.toString(),
              leverage,
              walletAddress: context.evmAddress,
              organizationId: context.organizationId,
              isMarket: true,
              price: marketPrice,
              slippagePercent: '0.5',
              hedgeTpsl: hedgeTpslForDirection(direction),
            });
            return { exchange: leg.exchange, result };
          }

          // backpack (disabled for display-only demo)
          return {
            exchange: leg.exchange,
            result: {
              success: false,
              positionId: null,
              error: 'Backpack trading is disabled in this demo build.',
            },
          };
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
        .map((lr) => `${hedgeExchangeLabel(lr.exchange)}: ${lr.error || 'unknown'}`)
        .join('; ');
      errorMsg = `Position opening failed — ${failedNames}`;
      trackPositionOpenFailed(asset, errorMsg);
    } else {
      trackPositionOpened(asset, leverage, marginForLegs.toString());
      recordPositionOpenTime(asset, context.hedgePair.long, context.hedgePair.short);
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
      const ex = normalizeHedgeExchange(exchange);
      this.phoenixAdapter.setEvmAddress(context.evmAddress);

      const runClose = async (): Promise<ActionResult> => {
        if (ex === 'hyperliquid') {
          return this.closeHLPositionAction(position.hyperliquid, asset, context);
        }
        if (ex === 'pacifica') {
          return this.closePacificaPositionAction(position.pacifica, asset, context);
        }
        if (ex === 'phoenix') {
          return this.closePhoenixPositionAction(position.phoenix ?? null, asset, context);
        }
        if (ex === 'lighter') {
          return this.closeLighterPositionAction(position.lighter ?? null, asset, context);
        }
        return this.closeBackpackPositionAction(position.backpack ?? null, asset);
      };

      const closeResult = await runWithRetries(runClose, (r) => r.success, {
        maxRetries: 3,
        delayMs: 1500,
      });

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
  private async closeLighterPositionAction(
    ltPosition: { symbol: string; size: string; side: 'Long' | 'Short' } | null,
    asset: string,
    context: ExecutorContext
  ): Promise<ActionResult> {
    if (!ltPosition) {
      return {
        success: false,
        txHash: null,
        error: `No Lighter position found for ${asset}`,
        legResults: null,
      };
    }

    console.log(
      `[HedgeExecutor] Closing Lighter position: ${ltPosition.symbol} ${ltPosition.side} size=${ltPosition.size}`
    );

    const result = await closeLighterPosition(ltPosition, context.evmAddress, context.organizationId);

    return {
      success: result.success,
      txHash: null,
      error: result.success ? null : result.error || 'Failed to close Lighter position',
      legResults: null,
    };
  }

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

  private async closePhoenixPositionAction(
    phxPosition: { symbol: string; size: string; side: 'Long' | 'Short' } | null,
    asset: string,
    context: ExecutorContext
  ): Promise<ActionResult> {
    if (!phxPosition) {
      return {
        success: false,
        txHash: null,
        error: `No Phoenix position found for ${asset}`,
        legResults: null,
      };
    }

    console.log(
      `[HedgeExecutor] Closing Phoenix position: ${phxPosition.symbol} ${phxPosition.side} size=${phxPosition.size}`
    );

    const result = await closePhoenixPosition(
      phxPosition,
      context.solanaAddress,
      context.organizationId
    );

    return {
      success: result.success,
      txHash: null,
      error: result.success ? null : result.error || 'Failed to close Phoenix position',
      legResults: null,
    };
  }

  private async closeBackpackPositionAction(
    bpPosition: { symbol: string; size: string; side: 'Long' | 'Short' } | null,
    asset: string
  ): Promise<ActionResult> {
    // backpack (disabled for display-only demo)
    return {
      success: false,
      txHash: null,
      error: `Backpack trading is disabled in this demo build (asset ${asset})`,
      legResults: null,
    };

    // unreachable (kept for reference while Backpack is disabled)
    // if (!bpPosition) {
    //   return {
    //     success: false,
    //     txHash: null,
    //     error: `No Backpack position found for ${asset}`,
    //     legResults: null,
    //   };
    // }
    //
    // const result = await closeBackpackPosition(bpPosition, context.solanaAddress, context.organizationId);
    //
    // return {
    //   success: result.success,
    //   txHash: null,
    //   error: result.success ? null : result.error || 'Failed to close Backpack position',
    //   legResults: null,
    // };
  }

  // Bridge status polling is now handled by the shared pollBridgeStatus utility
}
