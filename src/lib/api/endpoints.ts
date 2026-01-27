/**
 * API Endpoints Configuration
 * Centralized endpoint definitions for type safety and maintainability
 */

export const API_ENDPOINTS = {
  // Example endpoints - replace with your actual API endpoints
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
  },
  arbitrage: {
    positions: '/arbitrage/positions',
    strategies: '/arbitrage/strategies',
    history: '/arbitrage/history',
    stats: '/arbitrage/stats',
    openPositions: (evmAddress: string, solanaAddress: string) =>
      `/open-positions/${evmAddress}/${solanaAddress}`,
  },
  market: {
    feed: '/aggregated/live/market-feed',
    chart: (assetName: string) => `/aggregated/chart/${assetName}`,
  },
  // Add more endpoint groups as needed
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;

