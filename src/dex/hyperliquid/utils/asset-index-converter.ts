import { getPerpMeta, getSpotMeta } from "./get-meta";

// utiltily file to convert tickers to asset index and vice versa ("ETH" => 01, 01 => "ETH")
export async function perpIndexToTicker(assetIndex: number) {
  const perpMeta = await getPerpMeta();

  const ticker = perpMeta[assetIndex].name;
  return ticker;
}

export async function perpTickerToIndex(ticker: string) {
  const perpMeta = await getPerpMeta();

  const assetIndex = perpMeta.findIndex((i) => i.name === ticker.toUpperCase());
  return assetIndex;
}

// spot markets = pairs of token indexes ("ETH/USDC")
// Tokens array has actual name ("ETH")
// look up the name's position ("ETH") then find the market in universe that uses those indexes
// spot asset index = 10000 + market index.

export async function spotTickerToIndex(ticker: string, token?: string) {
  if (ticker === "PURR/USDC") {
    return 10000;
  }

  const quoteToken = token ? token : "USDC";
  const tickerUpper = ticker.toUpperCase();
  let formattedTicker = tickerUpper;

  if (formattedTicker === "ETH") {
    formattedTicker = "UETH";
  } else if (formattedTicker === "BTC") {
    formattedTicker = "UBTC";
  } else if (formattedTicker === "SOL") {
    formattedTicker = "USOL";
  }

  const spotMeta = await getSpotMeta();

  const baseIndex = spotMeta.tokens.findIndex(
    (t) => t.name === formattedTicker
  );
  const quoteIndex = spotMeta.tokens.findIndex(
    (t) => t.name === quoteToken.toUpperCase()
  );

  const match = spotMeta.universe.find(
    (m) => m.tokens[0] === baseIndex && m.tokens[1] === quoteIndex
  );

  return match ? 10000 + match.index : -1;
}

export async function spotIndexToTicker(assetIndex: number) {
  const index = assetIndex - 10000;

  const spotMeta = await getSpotMeta();

  const match = spotMeta.universe.find((m) => m.index === index);

  if (!match) return undefined;

  const baseToken = spotMeta.tokens[match.tokens[0]];
  const quoteToken = spotMeta.tokens[match.tokens[1]];

  return `${baseToken.name}/${quoteToken.name}`;
}

export async function spotTickerToAtSymbol(
  ticker: string,
  quoteToken: string = "USDC"
): Promise<string | undefined> {
  const spotMeta = await getSpotMeta();

  const baseIndex = spotMeta.tokens.findIndex(
    (t) => t.name === ticker.toUpperCase()
  );
  const quoteIndex = spotMeta.tokens.findIndex(
    (t) => t.name === quoteToken.toUpperCase()
  );

  const match = spotMeta.universe.find(
    (m) => m.tokens[0] === baseIndex && m.tokens[1] === quoteIndex
  );

  return match ? `@${match.index}` : undefined;
}

/**
 * Returns the key to use when accessing allMids[ticker]
 * For perps: returns "ETH", "BTC", etc.
 * For spot: returns "@87", "@123", etc.
 */
export async function tickerToAllMidsKey(
  ticker: string,
  quoteToken: string = "USDC"
): Promise<string | undefined> {
  const perpMeta = await getPerpMeta();

  const perpIndex = perpMeta.findIndex((p) => p.name === ticker.toUpperCase());
  if (perpIndex !== -1) return ticker.toUpperCase();

  const spotMeta = await getSpotMeta();

  const baseIndex = spotMeta.tokens.findIndex(
    (t) => t.name === ticker.toUpperCase()
  );
  const quoteIndex = spotMeta.tokens.findIndex(
    (t) => t.name === quoteToken.toUpperCase()
  );

  const spotMatch = spotMeta.universe.find(
    (m) => m.tokens[0] === baseIndex && m.tokens[1] === quoteIndex
  );

  return spotMatch ? `@${spotMatch.index}` : undefined;
}

function extractNumber(input: string): number {
  return parseInt(input.replace("@", ""), 10);
}

export async function atSymbolToTicker(atSymbol: string) {
  const marketIndex = extractNumber(atSymbol);

  const spotMeta = await getSpotMeta();

  // Find the universe entry with the number in the atSymbol
  const marketInfo = spotMeta.universe.find(
    (market) => market.index === marketIndex
  );
  if (!marketInfo) {
    return undefined;
  }

  // Get the base token index (first element in tokens array)
  const baseTokenIndex = marketInfo.tokens[0];

  // Look up the token name using this index
  const token = spotMeta.tokens[baseTokenIndex];
  if (!token) {
    return undefined;
  }

  return token.name;
}

export async function assetToTicker(asset: string | number): Promise<string> {
  if (typeof asset === "string" && asset.startsWith("@")) {
    const ticker = atSymbolToTicker(asset);
    if (ticker) return ticker;
  }

  const assetNum = typeof asset === "string" ? parseInt(asset, 10) : asset;

  if (assetNum >= 10000) {
    const ticker = await spotIndexToTicker(assetNum);
    if (ticker) return ticker;
  }

  const ticker = await perpIndexToTicker(assetNum);
  if (ticker) return ticker;

  return typeof asset === "string" ? asset : asset.toString();
}

export type MarketType = "spot" | "perp";

export async function tickerToAsset(
  ticker: string,
  marketType: MarketType
): Promise<string | number> {
  if (ticker.startsWith("@")) {
    const index = await spotTickerToAtSymbol(ticker);
    if (index) return index;
  }

  if (marketType === "spot") {
    const index = await spotTickerToIndex(ticker);
    if (index !== -1) return index;
  } else {
    const index = await perpTickerToIndex(ticker);
    // typescript thinks if index === 0 (BTC) then false and won't return the index so explicitly state if not -1
    if (index !== -1) return index;
  }

  return ticker;
}
