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

// ─── In-memory cache (loaded once, reused for the session) ──────────────────

let cachedMeta: PacificaPerpAssetMeta[] | null = null;
let metaPromise: Promise<PacificaPerpAssetMeta[]> | null = null;

/**
 * Fetches Pacifica perp metadata from the backend proxy.
 * Cached in memory for the entire session — this data is static.
 * Deduplicates concurrent requests via a shared promise.
 */
export async function getPacificaPerpMeta(): Promise<PacificaPerpAssetMeta[]> {
  if (cachedMeta) return cachedMeta;

  if (!metaPromise) {
    metaPromise = (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/pacifica/perp-metadata`);
        const data = await response.json();

        if (!data || !Array.isArray(data)) return [];

        cachedMeta = data as PacificaPerpAssetMeta[];
        return cachedMeta;
      } catch (err) {
        // Allow retry on next call
        metaPromise = null;
        throw err;
      }
    })();
  }

  return metaPromise;
}

/**
 * Returns the metadata for a single symbol, or undefined if not found.
 */
export async function getAssetMeta(symbol: string): Promise<PacificaPerpAssetMeta | undefined> {
  const meta = await getPacificaPerpMeta();
  return meta.find((m) => m.symbol.toUpperCase() === symbol.toUpperCase());
}

/**
 * Pre-warm the Pacifica metadata cache.
 * Call once on app load so all subsequent usage is instant.
 */
export async function preloadPacificaMeta(): Promise<void> {
  await getPacificaPerpMeta();
}
