/**
 * Phoenix trading surface (Rise): invite, register, deposit, balances snapshot, market orders.
 */

import {
  MarginType,
  OrderFlags,
  Side,
  type Authority,
  type ImmediateOrCancelOrderPacket,
  symbol as riseMarketSymbol,
} from '@ellipsis-labs/rise';
import {
  isPhoenixTradingEnabled,
  isPhoenixInviteRequired,
  resolvePhoenixActivationCodes,
  getPhoenixFeePayerAddress,
  isPhoenixFeePayerConfigured,
} from '@/lib/phoenix/env';
import { getStoredAccessCode } from '@/lib/auth/access-code';
import {
  fetchPhoenixIsolatedMarketOrderInstructions,
  type PhoenixIsolatedTpSlConfig,
} from '@/lib/phoenix/isolated-ix';
import { mapHedgeTpslToPhoenixIsolatedIx } from '@/lib/hedge-intent/hedge-tpsl';
import type { HedgeLegTpslPrices } from '@/lib/hedge-intent/hedge-tpsl';
import type { PositionApiResponse } from '@/lib/api/services/positions.service';
import { phoenixCollateralToUsd, USDC_MICROS_PER_USD } from '@/lib/phoenix/units';
import { hedgeUsesIsolatedMargin, usdToUsdcMicros } from '@/lib/trading/margin-mode';
import { ensurePhoenixExchangeReady, getPhoenixRiseClient, toPhoenixSymbol } from './phoenix-client';
import {
  PhoenixSubmitError,
  normalizeRiseInstruction,
  submitRiseInstructions,
  web3InstructionToRise,
} from './phoenix-submit';
import {
  PHOENIX_DEPOSIT_MIN_SOL_LAMPORTS,
  buildUsdcAtaIdempotentIx,
  getSolBalanceLamports,
} from '@/lib/phoenix/solana-usdc-ata';
import { getUSDCBalanceOnSolana } from '@/lib/bridge/balance-api';
import { registerPhoenixTraderSponsored } from '@/lib/phoenix/register-trader-client';

const DEFAULT_TRADER_PDA_INDEX = 0;
const DEFAULT_TRADER_SUBACCOUNT_INDEX = 0;

/** Invite already redeemed / trader exists — not a hard failure. */
function isPhoenixInviteConflictError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('already') ||
    m.includes('activated') ||
    m.includes('409') ||
    m.includes('conflict')
  );
}

export class PhoenixServiceError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = 'PhoenixServiceError';
  }
}

type TraderSubaccountSnapshot = {
  subaccountIndex: number;
  collateral?: string;
  positions?: Array<{
    symbol: string;
    basePositionLots: string;
    basePositionUnits?: string;
    entryPriceUsd?: string;
  }>;
};

export class PhoenixService {
  isTradingEnabled(): boolean {
    return isPhoenixTradingEnabled();
  }

  useIsolatedMarginForHedges(): boolean {
    return hedgeUsesIsolatedMargin();
  }

  /**
   * Phoenix private beta: HTTP invite/referral creates the trader PDA server-side.
   * On-chain registerTrader is a fallback when open access is enabled.
   */
  async ensureActivatedAndRegistered(
    solanaAuthority: string,
    organizationId: string,
    options?: { userAccessCode?: string | null }
  ): Promise<void> {
    if (!this.isTradingEnabled()) {
      throw new PhoenixServiceError('Phoenix trading is disabled (NEXT_PUBLIC_PHOENIX_TRADING_ENABLED).');
    }

    const client = getPhoenixRiseClient();
    await ensurePhoenixExchangeReady();

    if (await this.isTraderRegistered(solanaAuthority)) {
      return;
    }

    const userAccessCode =
      options?.userAccessCode ??
      (typeof window !== 'undefined' ? getStoredAccessCode() : null);
    const { referralCode, inviteCode } = resolvePhoenixActivationCodes(userAccessCode);

    if (isPhoenixInviteRequired() && !referralCode && !inviteCode) {
      throw new PhoenixServiceError(
        'Phoenix requires an invite or referral code for new accounts. Set NEXT_PUBLIC_PHOENIX_INVITE_CODE or NEXT_PUBLIC_PHOENIX_REFERRAL_CODE, or sign in with a valid access code.',
        'INVITE'
      );
    }

    const hadInviteCodes = !!(referralCode || inviteCode);
    let invitedTraderPda: string | undefined;

    if (hadInviteCodes) {
      try {
        const activation = referralCode
          ? await client.api.invite().activateInviteWithReferral({
              authority: solanaAuthority,
              referral_code: referralCode,
            })
          : await client.api.invite().activateInvite({
              authority: solanaAuthority,
              code: inviteCode!,
            });
        invitedTraderPda = activation.trader_pda?.trim() || undefined;
        console.info('[Phoenix] Invite activated', {
          authority: solanaAuthority,
          traderPda: invitedTraderPda,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isPhoenixInviteConflictError(msg)) {
          throw new PhoenixServiceError(`Phoenix invite activation failed: ${msg}`, 'INVITE');
        }
        console.info('[Phoenix] Invite already used for authority, verifying trader state');
      }

      // HTTP invite creates the trader PDA server-side (gasless). Never fall back to on-chain RegisterTrader.
      if (await this.confirmTraderAfterInvite(solanaAuthority, invitedTraderPda)) {
        return;
      }

      throw new PhoenixServiceError(
        'Phoenix invite succeeded but trader state is not yet visible. Wait a few seconds and retry.',
        'TRADER_NOT_REGISTERED'
      );
    }

    console.warn(
      '[Phoenix] No invite/referral code — attempting on-chain registerTrader (may fail in private beta)'
    );

    if (await this.isTraderRegistered(solanaAuthority)) {
      return;
    }

    const feePayerAddress = getPhoenixFeePayerAddress();

    if (feePayerAddress) {
      try {
        await registerPhoenixTraderSponsored(solanaAuthority);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('already exists')) {
          /* trader exists on-chain */
        } else {
          throw new PhoenixServiceError(
            `Phoenix registerTrader (sponsored) failed: ${msg}`,
            'REGISTER_TRADER'
          );
        }
      }

      if (await this.waitForTraderRegistered(solanaAuthority, 10, 1000)) {
        return;
      }

      throw new PhoenixServiceError(
        'Phoenix sponsored registerTrader completed but trader state is not yet available. Retry in a few seconds.',
        'TRADER_NOT_REGISTERED'
      );
    }

    const registerParams = {
      authority: solanaAuthority as Authority,
      marginType: MarginType.Cross,
      traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
      traderSubaccountIndex: DEFAULT_TRADER_SUBACCOUNT_INDEX,
      ...(feePayerAddress ? { feePayer: feePayerAddress as Authority } : { feePayer: null }),
    };

    // Rise runtime accepts feePayer for rent; TS union also documents sponsorshipToken path.
    const regIx = await client.ixs.buildRegisterTrader(
      registerParams as Parameters<typeof client.ixs.buildRegisterTrader>[0]
    );

    try {
      await submitRiseInstructions([normalizeRiseInstruction(regIx)], solanaAuthority, organizationId, {
        feePayerAddress,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('insufficient lamports') || msg.includes('0x1')) {
        throw new PhoenixServiceError(
          feePayerAddress
            ? 'Phoenix registerTrader failed: sponsor fee payer may be out of SOL.'
            : 'Phoenix registerTrader failed: wallet needs ~0.003 SOL for account rent, or configure NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS.',
          'REGISTER_TRADER'
        );
      }
      throw new PhoenixServiceError(`Phoenix registerTrader failed: ${msg}`, 'REGISTER_TRADER');
    }

    if (await this.isTraderRegistered(solanaAuthority)) {
      return;
    }

    throw new PhoenixServiceError(
      'Phoenix trader account not found. Private beta requires invite activation before deposit — verify your access/referral code and try again.',
      'TRADER_NOT_REGISTERED'
    );
  }

  async isTraderRegistered(solanaAuthority: string): Promise<boolean> {
    const client = getPhoenixRiseClient();
    try {
      await client.api.traders().getTraderStateSnapshot(solanaAuthority, {
        traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * After HTTP invite, Phoenix returns `trader_pda` for the same authority + pda index 0.
   * Confirm via trader lookup or authority snapshot — do not re-run on-chain RegisterTrader.
   */
  private async confirmTraderAfterInvite(
    solanaAuthority: string,
    invitedTraderPda?: string
  ): Promise<boolean> {
    if (invitedTraderPda) {
      const client = getPhoenixRiseClient();
      try {
        await client.api.traders().getTrader(invitedTraderPda);
        return true;
      } catch {
        /* snapshot poll below */
      }
    }
    return this.waitForTraderRegistered(solanaAuthority, 20, 1000);
  }

  /** Poll after HTTP invite — Phoenix API may take a few seconds to reflect the trader PDA. */
  private async waitForTraderRegistered(
    solanaAuthority: string,
    attempts = 15,
    delayMs = 1000
  ): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      if (await this.isTraderRegistered(solanaAuthority)) {
        return true;
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return false;
  }

  private async fetchTraderSubaccounts(solanaAuthority: string): Promise<TraderSubaccountSnapshot[]> {
    const client = getPhoenixRiseClient();
    await ensurePhoenixExchangeReady();
    const snap = await client.api.traders().getTraderStateSnapshot(solanaAuthority, {
      traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
    });
    return (snap.snapshot.subaccounts ?? []) as TraderSubaccountSnapshot[];
  }

  /**
   * Free USDC on the cross subaccount (index 0) — used for deposits and isolated transfer source.
   */
  async fetchFreeCollateralUsd(
    solanaAuthority: string
  ): Promise<{ success: true; usd: number } | { success: false; error: string }> {
    try {
      const subs = await this.fetchTraderSubaccounts(solanaAuthority);
      const sub = subs.find((s) => s.subaccountIndex === DEFAULT_TRADER_SUBACCOUNT_INDEX);
      const raw = sub?.collateral ?? '0';
      const usd = phoenixCollateralToUsd(raw);
      if (!Number.isFinite(usd)) {
        return { success: false, error: 'Invalid collateral in Phoenix snapshot' };
      }
      return { success: true, usd };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Find isolated subaccount (index > 0) with an open position for `assetSymbol`, if any.
   */
  async findIsolatedSubaccountForAsset(
    solanaAuthority: string,
    assetSymbol: string
  ): Promise<number | null> {
    try {
      const want = toPhoenixSymbol(assetSymbol);
      const subs = await this.fetchTraderSubaccounts(solanaAuthority);
      for (const sub of subs) {
        if (sub.subaccountIndex <= DEFAULT_TRADER_SUBACCOUNT_INDEX || !sub.positions?.length) {
          continue;
        }
        for (const pos of sub.positions) {
          if (toPhoenixSymbol(pos.symbol) !== want) continue;
          const lots = BigInt(pos.basePositionLots);
          if (lots !== BigInt(0)) {
            return sub.subaccountIndex;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private positionLegFromSubaccount(
    sub: TraderSubaccountSnapshot,
    assetSymbol: string
  ): NonNullable<PositionApiResponse['phoenix']> | null {
    if (!sub.positions?.length) return null;

    const want = toPhoenixSymbol(assetSymbol);
    for (const pos of sub.positions) {
      if (toPhoenixSymbol(pos.symbol) !== want) continue;

      const lots = BigInt(pos.basePositionLots);
      const zero = BigInt(0);
      if (lots === zero) return null;

      const isLong = lots > zero;
      let size: string;
      const unitsRaw = pos.basePositionUnits?.trim();
      if (unitsRaw) {
        const n = Math.abs(Number.parseFloat(unitsRaw));
        if (!Number.isFinite(n) || n === 0) return null;
        size = n.toString();
      } else {
        size = (lots < zero ? -lots : lots).toString();
      }

      const collateralUsd = phoenixCollateralToUsd(sub.collateral ?? '0');
      const entryUsd = pos.entryPriceUsd ? Number.parseFloat(pos.entryPriceUsd) : 0;
      const notional =
        Number.isFinite(entryUsd) && entryUsd > 0 ? Math.abs(Number.parseFloat(size)) * entryUsd : 0;
      const leverage =
        collateralUsd > 0 && notional > 0
          ? Math.max(1, Math.round(notional / collateralUsd))
          : 1;

      return {
        symbol: assetSymbol.toUpperCase(),
        size,
        side: isLong ? 'Long' : 'Short',
        pnl: '0',
        funding: '0',
        margin: collateralUsd.toFixed(2),
        leverage,
        liquidationPrice: '0',
      };
    }
    return null;
  }

  /**
   * Open perp leg from Rise trader snapshot when Nuke aggregated positions omit `phoenix`.
   * Prefers isolated subaccounts (index > 0), then cross (index 0).
   */
  async fetchOpenPositionLeg(
    solanaAuthority: string,
    assetSymbol: string
  ): Promise<NonNullable<PositionApiResponse['phoenix']> | null> {
    try {
      const subs = await this.fetchTraderSubaccounts(solanaAuthority);
      const isolated = subs
        .filter((s) => s.subaccountIndex > DEFAULT_TRADER_SUBACCOUNT_INDEX)
        .sort((a, b) => b.subaccountIndex - a.subaccountIndex);
      for (const sub of isolated) {
        const leg = this.positionLegFromSubaccount(sub, assetSymbol);
        if (leg) return leg;
      }
      const cross = subs.find((s) => s.subaccountIndex === DEFAULT_TRADER_SUBACCOUNT_INDEX);
      if (cross) {
        return this.positionLegFromSubaccount(cross, assetSymbol);
      }
      return null;
    } catch (err) {
      console.warn('[Phoenix] fetchOpenPositionLeg failed:', err);
      return null;
    }
  }

  async depositUsdc(
    solanaAuthority: string,
    organizationId: string,
    amountMicros: bigint
  ): Promise<string> {
    if (!this.isTradingEnabled()) {
      throw new PhoenixServiceError('Phoenix trading is disabled.');
    }
    if (amountMicros <= BigInt(0)) {
      throw new PhoenixServiceError('Deposit amount must be positive.');
    }

    const client = getPhoenixRiseClient();
    await ensurePhoenixExchangeReady();
    await this.ensureActivatedAndRegistered(solanaAuthority, organizationId);

    const usdcMicros = await getUSDCBalanceOnSolana(solanaAuthority);
    if (usdcMicros < amountMicros) {
      throw new PhoenixServiceError(
        usdcMicros === BigInt(0)
          ? 'No USDC on Solana. Send USDC to your wallet before depositing to Phoenix margin.'
          : `Insufficient Solana USDC for Phoenix deposit (have ${Number(usdcMicros) / 1e6}, need ${Number(amountMicros) / 1e6}).`,
        'INSUFFICIENT_USDC'
      );
    }

    const solLamports = await getSolBalanceLamports(solanaAuthority);
    if (!isPhoenixFeePayerConfigured() && solLamports < BigInt(PHOENIX_DEPOSIT_MIN_SOL_LAMPORTS)) {
      throw new PhoenixServiceError(
        'Insufficient SOL on Solana for Phoenix deposit fees and account rent. Keep at least 0.005 SOL in the wallet, or configure NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS.',
        'INSUFFICIENT_SOL'
      );
    }

    const feePayerAddress = getPhoenixFeePayerAddress();

    const flow = await client.ixs.buildDepositIxs({
      authority: solanaAuthority as Authority,
      amount: amountMicros,
      traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
      traderSubaccountIndex: DEFAULT_TRADER_SUBACCOUNT_INDEX,
      ...(feePayerAddress ? { feePayer: feePayerAddress as Authority } : {}),
    });

    // Rise deposit ixs create the Phoenix canonical ATA but not the wallet USDC ATA Ember debits.
    const usdcAtaIx = await buildUsdcAtaIdempotentIx(solanaAuthority, feePayerAddress);
    const ixs = [
      web3InstructionToRise(usdcAtaIx),
      ...flow.instructions.map((ix) => normalizeRiseInstruction(ix)),
    ];

    try {
      return await submitRiseInstructions(ixs, solanaAuthority, organizationId, {
        feePayerAddress,
      });
    } catch (err) {
      if (err instanceof PhoenixSubmitError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new PhoenixServiceError(`Phoenix deposit failed: ${msg}`, 'DEPOSIT');
    }
  }

  /**
   * Place a market-style IOC order.
   * Opens with isolated margin + `transferAmount` when `marginUsd` is set and isolated hedges are enabled.
   */
  async placeMarketOrder(params: {
    symbol: string;
    direction: 'long' | 'short';
    baseUnits: string;
    solanaAuthority: string;
    organizationId: string;
    reduceOnly?: boolean;
    /** Leg margin in USD — required for isolated opens */
    marginUsd?: number;
    useIsolatedMargin?: boolean;
    hedgeTpsl?: HedgeLegTpslPrices;
  }): Promise<{ success: true; txSignature: string } | { success: false; error: string }> {
    const {
      symbol,
      direction,
      baseUnits,
      solanaAuthority,
      organizationId,
      reduceOnly,
      marginUsd,
      useIsolatedMargin = hedgeUsesIsolatedMargin(),
      hedgeTpsl,
    } = params;

    if (!this.isTradingEnabled()) {
      return { success: false, error: 'Phoenix trading is disabled.' };
    }

    try {
      const client = getPhoenixRiseClient();
      await ensurePhoenixExchangeReady();
      await this.ensureActivatedAndRegistered(solanaAuthority, organizationId);

      const phxSymbol = toPhoenixSymbol(symbol);
      const side = direction === 'long' ? Side.Bid : Side.Ask;
      const phoenixSide = direction === 'long' ? 'bid' : 'ask';

      const orderPacket: ImmediateOrCancelOrderPacket =
        await client.orderPackets.buildMarketOrderPacket({
          symbol: phxSymbol,
          side,
          baseUnits,
          orderFlags: reduceOnly ? OrderFlags.ReduceOnly : OrderFlags.None,
        });

      const numBaseLots = orderPacket.numBaseLots;

      const wantIsolatedOpen =
        useIsolatedMargin && !reduceOnly && marginUsd != null && Number.isFinite(marginUsd) && marginUsd > 0;

      if (wantIsolatedOpen) {
        const transferAmountMicros = usdToUsdcMicros(marginUsd);
        if (transferAmountMicros <= BigInt(0)) {
          return { success: false, error: 'Phoenix isolated open requires positive marginUsd' };
        }

        let tpSl: PhoenixIsolatedTpSlConfig | undefined;
        if (hedgeTpsl) {
          tpSl = mapHedgeTpslToPhoenixIsolatedIx(hedgeTpsl, numBaseLots);
        }

        const feePayerAddress = getPhoenixFeePayerAddress();

        const ixs = await fetchPhoenixIsolatedMarketOrderInstructions({
          authority: solanaAuthority,
          symbol: phxSymbol,
          side: phoenixSide,
          numBaseLots,
          transferAmountMicros,
          skipTransferToParent: true,
          tpSl,
          feePayer: feePayerAddress,
        });

        const txSignature = await submitRiseInstructions(ixs, solanaAuthority, organizationId, {
          feePayerAddress,
        });
        return { success: true, txSignature };
      }

      let traderSubaccountIndex = DEFAULT_TRADER_SUBACCOUNT_INDEX;
      if (useIsolatedMargin && reduceOnly) {
        const isolatedIdx = await this.findIsolatedSubaccountForAsset(solanaAuthority, symbol);
        if (isolatedIdx != null) {
          traderSubaccountIndex = isolatedIdx;
        }
      }

      const ix = await client.ixs.buildPlaceMarketOrder({
        authority: solanaAuthority as Authority,
        symbol: riseMarketSymbol(phxSymbol),
        orderPacket,
        traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
        traderSubaccountIndex,
      });

      const feePayerAddress = getPhoenixFeePayerAddress();
      const txSignature = await submitRiseInstructions(
        [normalizeRiseInstruction(ix)],
        solanaAuthority,
        organizationId,
        { feePayerAddress }
      );
      return { success: true, txSignature };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /** Isolated positions use transferAmount on open; no separate leverage ix. */
  async updateLeverage(_asset: string, _leverage: number): Promise<{ success: true }> {
    return { success: true };
  }
}

export const phoenixService = new PhoenixService();

// Re-export for adapters computing micros
export { USDC_MICROS_PER_USD };
