import { BACKEND_URL } from '@/constants';

export interface PacificaPerpAssetMeta {
  symbol: string;
  tick_size: string;
  min_tick: string;
  max_tick: string;
  lot_size: string;
  max_leverage: number;
  isolated_only: boolean;
  min_order_size: string;
  max_order_size: string;
  funding_rate: string;
  next_funding_rate: string;
  created_at: number;
}

/** In-memory cache */
let cachedMeta: PacificaPerpAssetMeta[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Fetches Pacifica perp metadata from the backend proxy.
 * Results are cached in memory for CACHE_TTL ms.
 */
export async function getPacificaPerpMeta(): Promise<PacificaPerpAssetMeta[]> {
  const now = Date.now();
  if (cachedMeta && now - cacheTimestamp < CACHE_TTL) {
    return cachedMeta;
  }

  const response = await fetch(`${BACKEND_URL}pacifica/perp-metadata`);
  const data = await response.json();

  if (!data || !Array.isArray(data)) return [];

  cachedMeta = data as PacificaPerpAssetMeta[];
  cacheTimestamp = now;
  return cachedMeta;
}

/**
 * Returns the metadata for a single symbol, or undefined if not found.
 */
export async function getAssetMeta(
  symbol: string
): Promise<PacificaPerpAssetMeta | undefined> {
  const meta = await getPacificaPerpMeta();
  return meta.find(
    (m) => m.symbol.toUpperCase() === symbol.toUpperCase()
  );
}
