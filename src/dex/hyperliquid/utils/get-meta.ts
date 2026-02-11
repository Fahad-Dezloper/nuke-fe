import { BACKEND_URL } from '@/constants';

interface PerpAssetMeta {
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

interface SpotMeta {
  tokens: SpotToken[];
  universe: SpotMarket[];
}

export async function getPerpMeta(): Promise<PerpAssetMeta[]> {
  const response = await fetch(`${BACKEND_URL}hyperliquid/perp-metadata`);

  const data = await response.json();

  if (!data) return [];

  // response.json() already parses the JSON — no need for JSON.parse.
  // The API returns [{ universe: [...] }, ...ctx], extract the universe array.
  if (Array.isArray(data) && data[0]?.universe) {
    return data[0].universe as PerpAssetMeta[];
  }

  return data as PerpAssetMeta[];
}

export async function getSpotMeta(): Promise<SpotMeta> {
  const response = await fetch(`${BACKEND_URL}hyperliquid/spot-metadata`);

  const data = await response.json();

  if (!data) return { tokens: [], universe: [] };

  // response.json() already parses the JSON — no need for JSON.parse.
  // The API returns [{ tokens: [...], universe: [...] }, ...ctx].
  if (Array.isArray(data) && data[0]?.tokens) {
    return data[0] as SpotMeta;
  }

  return data as SpotMeta;
}
