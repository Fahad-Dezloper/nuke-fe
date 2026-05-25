/**
 * Singleton Rise `createPhoenixClient` with optional Flight (builder) routing.
 * Call `ensurePhoenixExchangeReady()` before order/deposit ix builders that need metadata.
 */

import { createPhoenixClient, type Authority, type PhoenixClient } from '@ellipsis-labs/rise';
import { isPhoenixFlightEnabled } from '@/lib/phoenix/env';

let client: PhoenixClient | null = null;
let exchangeReady: Promise<void> | null = null;

/**
 * Phoenix perp symbols in Rise are short tickers (e.g. `MON`, `SOL`), not `*-PERP`.
 */
export function toPhoenixSymbol(asset: string): string {
  return asset
    .trim()
    .toUpperCase()
    .replace(/-PERP$/i, '')
    .replace(/\/USDC$/i, '')
    .replace(/_USDC$/i, '');
}

export function getPhoenixRiseClient(): PhoenixClient {
  if (client) return client;

  const apiUrl =
    process.env.NEXT_PUBLIC_PHOENIX_API_URL?.trim() || 'https://perp-api.phoenix.trade';
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com';

  const builderAuthorityRaw = process.env.NEXT_PUBLIC_PHOENIX_FLIGHT_BUILDER_AUTHORITY?.trim();
  const flightEnabled = isPhoenixFlightEnabled() && Boolean(builderAuthorityRaw);

  const flight = flightEnabled
    ? {
        builderAuthority: builderAuthorityRaw as Authority,
        builderPdaIndex:
          Number.parseInt(process.env.NEXT_PUBLIC_PHOENIX_FLIGHT_BUILDER_PDA_INDEX || '0', 10) ||
          0,
        builderSubaccountIndex:
          Number.parseInt(
            process.env.NEXT_PUBLIC_PHOENIX_FLIGHT_BUILDER_SUBACCOUNT_INDEX || '0',
            10
          ) || 0,
      }
    : undefined;

  client = createPhoenixClient({
    apiUrl,
    rpcUrl,
    exchangeMetadata: { stream: true },
    flight,
  });

  return client;
}

export async function ensurePhoenixExchangeReady(): Promise<void> {
  const c = getPhoenixRiseClient();
  if (!exchangeReady) {
    exchangeReady = c.exchange.ready().then(() => undefined);
  }
  await exchangeReady;
}
