/**
 * Read-only Lighter account / market helpers via `lighter-sdk-client` InfoClient.
 */

import { getAddress } from 'viem';
import { LIGHTER_HTTP_MAINNET } from './constants';

export async function fetchLighterPerpRow(assetSymbol: string) {
  const { InfoClient } = await import('lighter-sdk-client');
  const client = new InfoClient({ baseURL: LIGHTER_HTTP_MAINNET });
  const res = await client.getOrderBookDetails();
  const sym = assetSymbol.toUpperCase();
  const row = res.order_book_details?.find(
    (d) =>
      d.symbol?.toUpperCase() === sym && d.market_type === 'perp' && d.status === 'active'
  );
  return row ?? null;
}

/**
 * Protective limit price for a reduce-only market close (taker-friendly bound).
 */
/** Human USD price → Lighter integer price (same scale as `last_trade_price`). */
export function lighterHumanPriceToInt(humanPrice: string, priceDecimals: number): number {
  const n = Number.parseFloat(humanPrice);
  if (!Number.isFinite(n) || n <= 0) {
    throw new RangeError(`Invalid Lighter price: ${humanPrice}`);
  }
  return Math.max(1, Math.round(n * 10 ** priceDecimals));
}

export function lighterWorstPriceForClose(
  positionSide: 'long' | 'short',
  lastTradePrice: number,
  slippagePercent: number
): number {
  const slip = slippagePercent / 100;
  if (positionSide === 'long') {
    return Math.max(1, Math.floor(lastTradePrice * (1 - slip)));
  }
  return Math.max(1, Math.ceil(lastTradePrice * (1 + slip)));
}

export function computeLighterOpenAmounts(input: {
  marginUsd: number;
  leverage: number;
  direction: 'long' | 'short';
  slippagePercent: number;
  lastTradePrice: number;
  priceDecimals: number;
  sizeDecimals: number;
}): { baseAmount: number; worstPrice: number } {
  const {
    marginUsd,
    leverage,
    direction,
    slippagePercent,
    lastTradePrice,
    priceDecimals,
    sizeDecimals,
  } = input;

  if (lastTradePrice <= 0 || !Number.isFinite(lastTradePrice)) {
    throw new RangeError('Invalid last_trade_price from Lighter metadata');
  }

  const markUsd = lastTradePrice / 10 ** priceDecimals;
  if (markUsd <= 0) {
    throw new RangeError('Computed mark USD is invalid');
  }

  const notionalUsd = marginUsd * leverage;
  const baseHuman = notionalUsd / markUsd;
  const baseAmount = Math.max(1, Math.floor(baseHuman * 10 ** sizeDecimals));

  const slip = slippagePercent / 100;
  const worstPrice =
    direction === 'long'
      ? Math.max(1, Math.ceil(lastTradePrice * (1 + slip)))
      : Math.max(1, Math.floor(lastTradePrice * (1 - slip)));

  return { baseAmount, worstPrice };
}

export async function fetchLighterAvailableUsd(evmAddress: string): Promise<number> {
  const { InfoClient } = await import('lighter-sdk-client');
  const client = new InfoClient({ baseURL: LIGHTER_HTTP_MAINNET });
  const addr = getAddress(evmAddress as `0x${string}`);
  try {
    const res = await client.getAccountInfo({ by: 'l1_address', value: addr });
    const first = res.accounts?.[0];
    if (!first?.available_balance) return 0;
    const n = Number.parseFloat(first.available_balance);
    return Number.isFinite(n) ? n : 0;
  } catch (error) {
    // Wallets that have never used Lighter return HTTP 400 from the accounts
    // endpoint. Treat that case as zero balance rather than a thrown error so
    // callers like Promise.allSettled don't surface it as a failure.
    const message = error instanceof Error ? error.message : String(error);
    if (/\b400\b|not\s*found|no\s*account/i.test(message)) {
      return 0;
    }
    throw error;
  }
}

export async function fetchLighterLeverageForMarket(
  evmAddress: string,
  marketId: number
): Promise<number | null> {
  const { InfoClient } = await import('lighter-sdk-client');
  const client = new InfoClient({ baseURL: LIGHTER_HTTP_MAINNET });
  const addr = getAddress(evmAddress as `0x${string}`);
  const res = await client.getAccountInfo({ by: 'l1_address', value: addr });
  const account = res.accounts?.[0];
  if (!account?.positions) return null;
  const pos = account.positions.find((p) => p.market_id === marketId);
  if (!pos?.initial_margin_fraction) return null;
  const imf = Number.parseInt(pos.initial_margin_fraction, 10);
  if (!Number.isFinite(imf) || imf <= 0) return null;
  return Math.round(10_000 / imf);
}
