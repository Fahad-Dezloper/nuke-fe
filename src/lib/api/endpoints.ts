/**
 * API Endpoints Configuration
 * Centralized endpoint definitions for type safety and maintainability
 */

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
  },
  arbitrage: {
    openPositions: (evmAddress: string, solanaAddress: string) =>
      `/aggregated/open-positions/${evmAddress}/${solanaAddress}`,
  },
  market: {
    feed: '/aggregated/live/market-feed',
    averageApr: '/aggregated/average/apr',
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
  withdrawIntent: {
    create: '/withdraw-intents/create-intent',
    nextAction: (id: string) => `/withdraw-intents/${id}/next-action`,
    transaction: '/withdraw-intents/transaction',
    bridge: '/withdraw-intents/bridge',
    actionResult: (id: string) => `/withdraw-intents/${id}/action-result`,
    detail: (id: string) => `/withdraw-intents/${id}`,
    userIntents: (userId: string) => `/withdraw-intents/user/${userId}`,
  },
  pacificaClaim: {
    claim: '/user/claim/pacifica',
    status: (userId: string) => `/user/claim-status/pacifica/${userId}`,
  },
  portfolio: {
    performance: (evmAddress: string, solanaAddress: string) =>
      `/aggregated/portfolio/performance/${evmAddress}/${solanaAddress}`,
    pnlChart: (evmAddress: string, solanaAddress: string) =>
      `/aggregated/portfolio/pnl-chart/${evmAddress}/${solanaAddress}`,
    exchanges: (evmAddress: string, solanaAddress: string) =>
      `/aggregated/portfolio/exchanges/${evmAddress}/${solanaAddress}`,
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
