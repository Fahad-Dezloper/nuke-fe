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
  isPhoenixInviteOnboardingEnabled,
  getPhoenixInviteCode,
  getPhoenixReferralCode,
} from '@/lib/phoenix/env';
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
import { PhoenixSubmitError, normalizeRiseInstruction, submitRiseInstructions } from './phoenix-submit';

const DEFAULT_TRADER_PDA_INDEX = 0;
const DEFAULT_TRADER_SUBACCOUNT_INDEX = 0;

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
   * On-chain register trader if missing. HTTP invite/referral is optional (see env flags).
   */
  async ensureActivatedAndRegistered(
    solanaAuthority: string,
    organizationId: string
  ): Promise<void> {
    if (!this.isTradingEnabled()) {
      throw new PhoenixServiceError('Phoenix trading is disabled (NEXT_PUBLIC_PHOENIX_TRADING_ENABLED).');
    }

    const client = getPhoenixRiseClient();
    await ensurePhoenixExchangeReady();

    if (await this.isTraderRegistered(solanaAuthority)) {
      return;
    }

    if (isPhoenixInviteOnboardingEnabled()) {
      const invite = getPhoenixInviteCode();
      const referral = getPhoenixReferralCode();
      try {
        if (referral) {
          await client.api.invite().activateInviteWithReferral({
            authority: solanaAuthority,
            referral_code: referral,
          });
        } else if (invite) {
          await client.api.invite().activateInvite({
            authority: solanaAuthority,
            code: invite,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new PhoenixServiceError(`Phoenix invite activation failed: ${msg}`, 'INVITE');
      }
    } else {
      console.warn(
        '[Phoenix] Skipping HTTP invite/referral activation (enable NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE when ready)'
      );
    }

    if (await this.isTraderRegistered(solanaAuthority)) {
      return;
    }

    const regIx = await client.ixs.buildRegisterTrader({
      authority: solanaAuthority as Authority,
      marginType: MarginType.Cross,
      traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
      traderSubaccountIndex: DEFAULT_TRADER_SUBACCOUNT_INDEX,
    });

    try {
      await submitRiseInstructions([normalizeRiseInstruction(regIx)], solanaAuthority, organizationId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Phoenix] registerTrader failed (continuing — deposit may still work):', msg);
    }
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

    const flow = await client.ixs.buildDepositIxs({
      authority: solanaAuthority as Authority,
      amount: amountMicros,
      traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
      traderSubaccountIndex: DEFAULT_TRADER_SUBACCOUNT_INDEX,
    });

    const ixs = flow.instructions.map((ix) => normalizeRiseInstruction(ix));

    try {
      return await submitRiseInstructions(ixs, solanaAuthority, organizationId);
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

        const ixs = await fetchPhoenixIsolatedMarketOrderInstructions({
          authority: solanaAuthority,
          symbol: phxSymbol,
          side: phoenixSide,
          numBaseLots,
          transferAmountMicros,
          skipTransferToParent: true,
          tpSl,
        });

        const txSignature = await submitRiseInstructions(ixs, solanaAuthority, organizationId);
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

      const txSignature = await submitRiseInstructions(
        [normalizeRiseInstruction(ix)],
        solanaAuthority,
        organizationId
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
