/**
 * API Endpoints Configuration
 * Centralized endpoint definitions for type safety and maintainability
 */

export const API_ENDPOINTS = {
  // Example endpoints - replace with your actual API endpoints
  auth: {},
  arbitrage: {
    openPositions: (evmAddress: string, solanaAddress: string) =>
      `/open-positions/${evmAddress}/${solanaAddress}`,
  },
  market: {
    feed: '/aggregated/live/market-feed',
    chart: (assetName: string) => `/aggregated/chart/${assetName}`,
  },
  bridge: {
    quote: '/bridge/quote',
    executePermits: '/bridge/execute/permits',
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
