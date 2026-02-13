import { BACKEND_URL } from '@/constants';

export interface PerpAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
}

interface SpotToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  isCanonical: boolean;
  evmContract: string | null;
  fullName: string | null;
  tokenId: string;
}

interface SpotMarket {
  tokens: [number, number];
  name: string;
  index: number;
  isCanonical: boolean;
}

export interface SpotMeta {
  tokens: SpotToken[];
  universe: SpotMarket[];
}

// ─── In-memory caches (loaded once, reused for the session) ─────────────────

let cachedPerpMeta: PerpAssetMeta[] | null = null;
let perpMetaPromise: Promise<PerpAssetMeta[]> | null = null;

let cachedSpotMeta: SpotMeta | null = null;
let spotMetaPromise: Promise<SpotMeta> | null = null;

/**
 * Fetches Hyperliquid perp metadata.
 * Cached in memory for the entire session — this data is static.
 * Deduplicates concurrent requests via a shared promise.
 */
export async function getPerpMeta(): Promise<PerpAssetMeta[]> {
  if (cachedPerpMeta) return cachedPerpMeta;

  // Deduplicate: if a fetch is already in-flight, reuse it
  if (!perpMetaPromise) {
    perpMetaPromise = (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/hyperliquid/perp-metadata`);
        const data = await response.json();

        if (!data) return [];

        let result: PerpAssetMeta[];
        if (Array.isArray(data) && data[0]?.universe) {
          result = data[0].universe as PerpAssetMeta[];
        } else {
          result = data as PerpAssetMeta[];
        }

        cachedPerpMeta = result;
        return result;
      } catch (err) {
        // Allow retry on next call
        perpMetaPromise = null;
        throw err;
      }
    })();
  }

  return perpMetaPromise;
}

/**
 * Fetches Hyperliquid spot metadata.
 * Cached in memory for the entire session — this data is static.
 * Deduplicates concurrent requests via a shared promise.
 */
export async function getSpotMeta(): Promise<SpotMeta> {
  if (cachedSpotMeta) return cachedSpotMeta;

  if (!spotMetaPromise) {
    spotMetaPromise = (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/hyperliquid/spot-metadata`);
        const data = await response.json();

        if (!data) return { tokens: [], universe: [] };

        let result: SpotMeta;
        if (Array.isArray(data) && data[0]?.tokens) {
          result = data[0] as SpotMeta;
        } else {
          result = data as SpotMeta;
        }

        cachedSpotMeta = result;
        return result;
      } catch (err) {
        spotMetaPromise = null;
        throw err;
      }
    })();
  }

  return spotMetaPromise;
}

/**
 * Pre-warm both HL metadata caches.
 * Call once on app load so all subsequent usage is instant.
 */
export async function preloadHyperliquidMeta(): Promise<void> {
  await Promise.all([getPerpMeta(), getSpotMeta()]);
}
