/**
 * Align hedge leg size to the strictest venue precision so delta-neutral opens match.
 * Uses each venue's real rounding (Phoenix lot packets, Pacifica lot_size, HL szDecimals).
 */

import { Side } from '@ellipsis-labs/rise';
import { MarketPriceHelper } from '@/dex/hyperliquid/utils/market-price';
import { getPerpMeta } from '@/dex/hyperliquid/utils/get-meta';
import { getAssetMeta as getPacificaAssetMeta } from '@/dex/pacifica/utils/get-meta';
import { roundAmount, roundToStep } from '@/dex/pacifica/utils/rounding';
import { ensurePhoenixExchangeReady, getPhoenixRiseClient, toPhoenixSymbol } from '@/lib/services/phoenix/phoenix-client';
import { fetchLighterPerpRow } from '@/lib/services/lighter/lighter-reads';
import type { Exchange } from './types';

const PHOENIX_FALLBACK_DECIMALS = 6;
const PACIFICA_FALLBACK_LOT_SIZE = '0.0001';

/** Floor base-asset size down to venue lot / sz decimals. */
export function floorBaseSizeToDecimals(size: number, decimalPlaces: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  const places = Math.max(0, Math.floor(decimalPlaces));
  if (places === 0) return Math.floor(size);
  const factor = 10 ** places;
  return Math.floor(size * factor) / factor;
}

function decimalsFromStepString(step: string): number {
  const trimmed = step.trim();
  if (!trimmed.includes('.')) return 0;
  const fractional = trimmed.split('.')[1]?.replace(/0+$/, '') ?? '';
  return fractional.length;
}

export function formatAlignedBaseSize(size: number, decimalPlaces: number): string {
  const places = Math.max(0, Math.floor(decimalPlaces));
  if (places === 0) return String(Math.floor(size));
  const formatted = size.toFixed(places).replace(/\.?0+$/, '');
  return formatted || '0';
}

function baseLotsToHumanUnits(numBaseLots: bigint, baseLotsDecimals: number): number {
  const lots = numBaseLots;
  const scale = 10 ** Math.abs(baseLotsDecimals);
  if (baseLotsDecimals >= 0) {
    return Number(lots) / scale;
  }
  return Number(lots) * scale;
}

/** Phoenix effective fill size after Rise market-order lot quantization. */
async function phoenixFlooredBaseSize(asset: string, rawBaseSize: number): Promise<number | null> {
  if (!Number.isFinite(rawBaseSize) || rawBaseSize <= 0) return null;
  try {
    await ensurePhoenixExchangeReady();
    const client = getPhoenixRiseClient();
    const symbol = toPhoenixSymbol(asset);
    const packet = await client.orderPackets.buildMarketOrderPacket({
      symbol,
      side: Side.Bid,
      baseUnits: String(rawBaseSize),
    });
    const market = client.exchange.market(symbol);
    const baseLotsDecimals = market?.baseLotsDecimals ?? PHOENIX_FALLBACK_DECIMALS;
    const lots =
      typeof packet.numBaseLots === 'bigint' ? packet.numBaseLots : BigInt(packet.numBaseLots);
    const human = baseLotsToHumanUnits(lots, baseLotsDecimals);
    return Number.isFinite(human) && human > 0 ? human : null;
  } catch (err) {
    console.warn('[hedge-base-size] Phoenix lot preview failed, using decimal floor:', err);
    return floorBaseSizeToDecimals(rawBaseSize, PHOENIX_FALLBACK_DECIMALS);
  }
}

async function pacificaFlooredBaseSize(asset: string, rawBaseSize: number): Promise<number | null> {
  if (!Number.isFinite(rawBaseSize) || rawBaseSize <= 0) return null;
  const symbol = asset.toUpperCase();
  try {
    const rounded = await roundAmount(rawBaseSize, symbol);
    const n = Number.parseFloat(rounded);
    if (Number.isFinite(n) && n > 0) return n;
  } catch (err) {
    console.warn('[hedge-base-size] Pacifica roundAmount failed:', err);
  }
  const meta = await getPacificaAssetMeta(symbol);
  const lotSize = meta?.lot_size ?? PACIFICA_FALLBACK_LOT_SIZE;
  const rounded = roundToStep(rawBaseSize, lotSize);
  const n = Number.parseFloat(rounded);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function hyperliquidFlooredBaseSize(asset: string, rawBaseSize: number): Promise<number | null> {
  if (!Number.isFinite(rawBaseSize) || rawBaseSize <= 0) return null;
  const helper = new MarketPriceHelper();
  const tickInfo = await helper.getTickAndLotSize(asset.toUpperCase(), 'perps');
  if (!tickInfo) {
    const perpMeta = await getPerpMeta();
    const row = perpMeta.find((t) => t.name === asset.toUpperCase());
    if (row?.szDecimals == null) return null;
    return floorBaseSizeToDecimals(rawBaseSize, row.szDecimals);
  }
  const rounded = Number.parseFloat(tickInfo.roundSize(rawBaseSize));
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}

async function effectiveFlooredBaseSize(
  rawBaseSize: number,
  asset: string,
  exchange: Exchange
): Promise<number | null> {
  switch (exchange) {
    case 'phoenix':
      return phoenixFlooredBaseSize(asset, rawBaseSize);
    case 'pacifica':
      return pacificaFlooredBaseSize(asset, rawBaseSize);
    case 'hyperliquid':
      return hyperliquidFlooredBaseSize(asset, rawBaseSize);
    case 'lighter': {
      const row = await fetchLighterPerpRow(asset.toUpperCase());
      if (row?.size_decimals == null) return null;
      return floorBaseSizeToDecimals(rawBaseSize, row.size_decimals);
    }
    case 'backpack':
      return null;
    default:
      return null;
  }
}

async function formatFinalAlignedSize(
  aligned: number,
  asset: string,
  exchanges: Exchange[]
): Promise<string> {
  if (exchanges.includes('pacifica')) {
    return roundAmount(aligned, asset.toUpperCase());
  }
  if (exchanges.includes('phoenix')) {
    const phx = await phoenixFlooredBaseSize(asset, aligned);
    if (phx != null && phx > 0) {
      const market = getPhoenixRiseClient().exchange.market(toPhoenixSymbol(asset));
      const decimals = market?.baseLotsDecimals ?? PHOENIX_FALLBACK_DECIMALS;
      return formatAlignedBaseSize(phx, Math.max(0, decimals));
    }
  }
  const decimalLimits: number[] = [];
  for (const exchange of exchanges) {
    if (exchange === 'hyperliquid') {
      const perpMeta = await getPerpMeta();
      const row = perpMeta.find((t) => t.name === asset.toUpperCase());
      if (row?.szDecimals != null) decimalLimits.push(row.szDecimals);
    } else if (exchange === 'lighter') {
      const row = await fetchLighterPerpRow(asset.toUpperCase());
      if (row?.size_decimals != null) decimalLimits.push(row.size_decimals);
    }
  }
  const formatDecimals =
    decimalLimits.length > 0 ? Math.min(...decimalLimits) : PHOENIX_FALLBACK_DECIMALS;
  return formatAlignedBaseSize(aligned, formatDecimals);
}

/**
 * Per-leg venue rounding then min — shared base size every leg can fill at the same coin amount.
 */
export async function alignHedgeBaseSize(params: {
  rawBaseSize: number;
  asset: string;
  exchanges: Exchange[];
}): Promise<string | undefined> {
  const { rawBaseSize, asset, exchanges } = params;
  if (!Number.isFinite(rawBaseSize) || rawBaseSize <= 0) return undefined;

  const uniqueExchanges = [...new Set(exchanges)];
  let candidate = rawBaseSize;

  for (let pass = 0; pass < 3; pass++) {
    const perLegFloors = await Promise.all(
      uniqueExchanges.map((exchange) => effectiveFlooredBaseSize(candidate, asset, exchange))
    );
    const valid = perLegFloors.filter((n): n is number => n != null && n > 0);
    if (valid.length === 0) break;

    const next = Math.min(...valid);
    if (next <= 0) return undefined;
    if (Math.abs(next - candidate) < 1e-12) break;
    candidate = next;
  }

  if (candidate <= 0) return undefined;

  return formatFinalAlignedSize(candidate, asset, uniqueExchanges);
}
