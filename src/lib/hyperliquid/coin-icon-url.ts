/**
 * Hyperliquid serves SVGs at https://app.hyperliquid.xyz/coins/{TICKER}.svg
 * Some merged / scaled perps use a leading "K" in the app symbol while the
 * icon file keeps the base name (e.g. KPEPE → PEPE, KBONK → BONK).
 */
const COIN_ICON_TICKER_OVERRIDES: Record<string, string> = {
  KPEPE: 'PEPE',
  KBONK: 'BONK',
};

export function hyperliquidCoinIconTicker(symbol: string): string {
  const u = symbol.toUpperCase();
  return COIN_ICON_TICKER_OVERRIDES[u] ?? u;
}

export function hyperliquidCoinIconUrl(symbol: string): string {
  const ticker = hyperliquidCoinIconTicker(symbol);
  return `https://app.hyperliquid.xyz/coins/${ticker}.svg`;
}
