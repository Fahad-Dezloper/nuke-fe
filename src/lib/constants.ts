export const APP_CONFIG = {
  name: 'Nuke',
  description: 'Perpetual Arbitrage Terminal',
  version: '1.0.0',
} as const;

export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  positions: '/positions',
  strategies: '/strategies',
  history: '/history',
  settings: '/settings',
} as const;

export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
} as const;

// Re-export from turnkey constants to avoid duplication
export { SESSION_EXPIRATION_SECONDS } from '@/lib/turnkey/constants';
