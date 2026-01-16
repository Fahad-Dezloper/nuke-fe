import { BACKEND_URL } from "@/constants";

//TODO: move the redis client implementation to backend and then fetch from there
export async function getPerpMeta() {
  const response = await fetch(`${BACKEND_URL}/perp-meta`);

  const data = await response.json();

  if (!data) return [];

  return JSON.parse(data);
}

export async function getSpotMeta() {
  const response = await fetch(`${BACKEND_URL}/spot-meta`);

  const data = await response.json();

  if (!data) return [];

  return JSON.parse(data);
}
