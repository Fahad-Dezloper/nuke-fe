/**
 * React Query Key Factory
 *
 * Centralized query key definitions for cache management.
 * Following the query key factory pattern for consistency.
 */

export const queryKeys = {
  positions: {
    all: ['positions'] as const,
    open: (evmAddress: string, solanaAddress: string) =>
      ['positions', 'open', evmAddress, solanaAddress] as const,
  },

  marketFeed: {
    all: ['market-feed'] as const,
    live: ['market-feed', 'live'] as const,
  },

  spreadApr: {
    all: ['spread-apr'] as const,
    average: ['spread-apr', 'average'] as const,
  },

  chart: {
    all: ['chart'] as const,
    fundingRate: (asset: string, timeframe: string) =>
      ['chart', 'funding-rate', asset, timeframe] as const,
  },

  bridgeFees: {
    all: ['bridge-fees'] as const,
    estimate: (amount: string, evmAddress: string) =>
      ['bridge-fees', 'estimate', amount, evmAddress] as const,
  },

  balance: {
    all: ['balance'] as const,
    usdcBase: (address: string) => ['balance', 'usdc-base', address] as const,
    usdcSolana: (address: string) => ['balance', 'usdc-solana', address] as const,
    /** Hyperliquid + Pacifica (unsigned / server-side reads — safe to poll). */
    exchangeHlPac: (evmAddress: string, solanaAddress: string) =>
      ['balance', 'exchange-hl-pac', evmAddress, solanaAddress] as const,
  },

  withdrawal: {
    all: ['withdrawal'] as const,
    detail: (id: string) => ['withdrawal', id] as const,
    user: (userId: string) => ['withdrawal', 'user', userId] as const,
  },

  portfolio: {
    all: ['portfolio'] as const,
    performance: (evmAddress: string, solanaAddress: string) =>
      ['portfolio', 'performance', evmAddress, solanaAddress] as const,
    pnlChart: (evmAddress: string, solanaAddress: string, timeframe: string) =>
      ['portfolio', 'pnl-chart', evmAddress, solanaAddress, timeframe] as const,
    exchanges: (evmAddress: string, solanaAddress: string) =>
      ['portfolio', 'exchanges', evmAddress, solanaAddress] as const,
  },
} as const;
