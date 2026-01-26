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
  },
  market: {
    feed: '/aggregated/live/market-feed',
  },
  // Add more endpoint groups as needed
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;

