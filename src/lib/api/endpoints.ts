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
    chart: (assetName: string, timeframe: '30m' | '1h' | '24h' = '30m') =>
      `/aggregated/chart/${assetName}?timeframe=${timeframe}`,
  },
  bridge: {
    quote: '/bridge/quote',
    executePermits: '/bridge/execute/permits',
  },
  hedgeIntent: {
    create: '/hedge-intents',
    nextAction: (intentId: string) => `/hedge-intents/${intentId}/next-action`,
    actionResult: (intentId: string) => `/hedge-intents/${intentId}/action-result`,
    detail: (intentId: string) => `/hedge-intents/${intentId}`,
    userIntents: (userId: string) => `/hedge-intents/user/${userId}`,
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
