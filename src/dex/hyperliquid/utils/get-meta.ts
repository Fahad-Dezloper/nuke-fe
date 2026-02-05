import { BACKEND_URL } from '@/constants';

export async function getPerpMeta() {
  const response = await fetch(`${BACKEND_URL}/hyperliquid/perp-metadata`);

  const data = await response.json();

  if (!data) return [];

  return JSON.parse(data);
}

export async function getSpotMeta() {
  const response = await fetch(`${BACKEND_URL}/hyperliquid/spot-metadata`);

  const data = await response.json();

  if (!data) return [];

  return JSON.parse(data);
}
