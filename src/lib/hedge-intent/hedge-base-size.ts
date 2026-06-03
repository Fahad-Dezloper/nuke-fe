/**
 * Align hedge leg size to the strictest venue precision so delta-neutral opens match.
 * e.g. HL szDecimals 0 → 11, Phoenix accepts 11.9 → both open at 11.
 */

import { getPerpMeta } from '@/dex/hyperliquid/utils/get-meta';
import { getAssetMeta as getPacificaAssetMeta } from '@/dex/pacifica/utils/get-meta';
import { fetchLighterPerpRow } from '@/lib/services/lighter/lighter-reads';
import type { Exchange } from './types';

const PHOENIX_BASE_SIZE_DECIMALS = 6;

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

async function baseSizeDecimalsForExchange(
  asset: string,
  exchange: Exchange
): Promise<number | null> {
  const symbol = asset.toUpperCase();

  switch (exchange) {
    case 'hyperliquid': {
      const perpMeta = await getPerpMeta();
      const row = perpMeta.find((t) => t.name === symbol);
      return row?.szDecimals ?? null;
    }
    case 'phoenix':
      return PHOENIX_BASE_SIZE_DECIMALS;
    case 'pacifica': {
      const meta = await getPacificaAssetMeta(symbol);
      if (!meta?.lot_size) return null;
      return decimalsFromStepString(meta.lot_size);
    }
    case 'lighter': {
      const row = await fetchLighterPerpRow(symbol);
      return row?.size_decimals ?? null;
    }
    case 'backpack':
      return null;
    default:
      return null;
  }
}

/**
 * Per-leg floor then min — shared base size every leg can fill at the same coin amount.
 */
export async function alignHedgeBaseSize(params: {
  rawBaseSize: number;
  asset: string;
  exchanges: Exchange[];
}): Promise<string | undefined> {
  const { rawBaseSize, asset, exchanges } = params;
  if (!Number.isFinite(rawBaseSize) || rawBaseSize <= 0) return undefined;

  const uniqueExchanges = [...new Set(exchanges)];
  const perLegFloors: number[] = [];
  const decimalLimits: number[] = [];

  for (const exchange of uniqueExchanges) {
    const decimals = await baseSizeDecimalsForExchange(asset, exchange);
    if (decimals == null) continue;
    decimalLimits.push(decimals);
    perLegFloors.push(floorBaseSizeToDecimals(rawBaseSize, decimals));
  }

  if (perLegFloors.length === 0) {
    return formatAlignedBaseSize(
      floorBaseSizeToDecimals(rawBaseSize, PHOENIX_BASE_SIZE_DECIMALS),
      PHOENIX_BASE_SIZE_DECIMALS
    );
  }

  const aligned = Math.min(...perLegFloors);
  if (aligned <= 0) return undefined;

  const formatDecimals = Math.min(...decimalLimits);
  return formatAlignedBaseSize(aligned, formatDecimals);
}
