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
import { isPhoenixTradingEnabled, getPhoenixInviteCode, getPhoenixReferralCode } from '@/lib/phoenix/env';
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

export class PhoenixService {
  isTradingEnabled(): boolean {
    return isPhoenixTradingEnabled();
  }

  /**
   * HTTP invite + on-chain register trader if snapshot is missing.
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

    const registered = await this.isTraderRegistered(solanaAuthority);
    if (registered) return;

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
      } else {
        throw new PhoenixServiceError(
          'Phoenix account is not registered. Set NEXT_PUBLIC_PHOENIX_INVITE_CODE (or NEXT_PUBLIC_PHOENIX_REFERRAL_CODE) for invite activation.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new PhoenixServiceError(`Phoenix invite activation failed: ${msg}`, 'INVITE');
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
      throw new PhoenixServiceError(`Phoenix registerTrader failed: ${msg}`, 'REGISTER');
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

  /**
   * Free collateral (USDC) on the default subaccount from HTTP snapshot (`collateral` string).
   */
  async fetchFreeCollateralUsd(
    solanaAuthority: string
  ): Promise<{ success: true; usd: number } | { success: false; error: string }> {
    try {
      const client = getPhoenixRiseClient();
      await ensurePhoenixExchangeReady();
      const snap = await client.api.traders().getTraderStateSnapshot(solanaAuthority, {
        traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
      });
      const sub = snap.snapshot.subaccounts.find(
        (s) => s.subaccountIndex === DEFAULT_TRADER_SUBACCOUNT_INDEX
      );
      const raw = sub?.collateral ?? '0';
      const usd = Number.parseFloat(raw);
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
   * Move USDC from Solana wallet into Phoenix collateral (full Rise deposit ix bundle).
   */
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
   * Place a market-style IOC order. `baseUnits` uses Rise decimal parsing (human size string is OK).
   */
  async placeMarketOrder(params: {
    symbol: string;
    direction: 'long' | 'short';
    baseUnits: string;
    solanaAuthority: string;
    organizationId: string;
    reduceOnly?: boolean;
  }): Promise<{ success: true; txSignature: string } | { success: false; error: string }> {
    const { symbol, direction, baseUnits, solanaAuthority, organizationId, reduceOnly } = params;

    if (!this.isTradingEnabled()) {
      return { success: false, error: 'Phoenix trading is disabled.' };
    }

    try {
      const client = getPhoenixRiseClient();
      await ensurePhoenixExchangeReady();
      await this.ensureActivatedAndRegistered(solanaAuthority, organizationId);

      const phxSymbol = toPhoenixSymbol(symbol);
      const side = direction === 'long' ? Side.Bid : Side.Ask;

      const orderPacket: ImmediateOrCancelOrderPacket =
        await client.orderPackets.buildMarketOrderPacket({
          symbol: phxSymbol,
          side,
          baseUnits,
          orderFlags: reduceOnly ? OrderFlags.ReduceOnly : OrderFlags.None,
        });

      const ix = await client.ixs.buildPlaceMarketOrder({
        authority: solanaAuthority as Authority,
        symbol: riseMarketSymbol(phxSymbol),
        orderPacket,
        traderPdaIndex: DEFAULT_TRADER_PDA_INDEX,
        traderSubaccountIndex: DEFAULT_TRADER_SUBACCOUNT_INDEX,
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

  /**
   * No-op until Rise exposes a dedicated client leverage ix wired for our margin mode.
   * Phoenix uses cross margin by default at registration.
   */
  async updateLeverage(_asset: string, _leverage: number): Promise<{ success: true }> {
    return { success: true };
  }
}

export const phoenixService = new PhoenixService();
