/**
 * Portfolio Service
 * Reads aggregate performance, PnL chart, and per-venue balances for the
 * authenticated user. All endpoints require a JWT bearer token (attached
 * automatically by apiClient).
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';

export type VenueKey = 'hyperliquid' | 'pacifica' | 'phoenix' | 'backpack' | 'lighter';

export type PerformanceTimeframe = 'day' | 'week' | 'month' | 'all';

export interface PerformanceBucket {
  volumeUsd: number;
  strategiesOpened: number;
  pnlUsd: number;
}

export interface PerformanceResponse {
  day: PerformanceBucket;
  week: PerformanceBucket;
  month: PerformanceBucket;
  all: PerformanceBucket;
}

export interface PnlChartPoint {
  timestamp: string;
  cumulativePnlUsd: number;
}

export interface PnlChartResponse {
  timeframe: PerformanceTimeframe;
  rangeStart: string;
  rangeEnd: string;
  points: PnlChartPoint[];
}

export interface ExchangeRow {
  venue: VenueKey;
  displayName: string;
  connected: boolean;
  availableBalanceUsd: number | null;
  totalEquityUsd: number | null;
  /** Trading volume (USD); backend may send per venue. */
  volumeUsd?: number | null;
  error: string | null;
}

export interface ExchangesResponse {
  exchanges: ExchangeRow[];
  totals: {
    availableBalanceUsd: number;
    totalEquityUsd: number;
    volumeUsd?: number | null;
  };
}

export const portfolioService = {
  async getPerformance(
    evmAddress: string,
    solanaAddress: string,
    signal?: AbortSignal
  ): Promise<PerformanceResponse> {
    return apiClient.get<PerformanceResponse>(
      API_ENDPOINTS.portfolio.performance(evmAddress, solanaAddress),
      undefined,
      { signal }
    );
  },

  async getPnlChart(
    evmAddress: string,
    solanaAddress: string,
    timeframe: PerformanceTimeframe,
    signal?: AbortSignal
  ): Promise<PnlChartResponse> {
    return apiClient.get<PnlChartResponse>(
      API_ENDPOINTS.portfolio.pnlChart(evmAddress, solanaAddress),
      { timeframe },
      { signal }
    );
  },

  async getExchanges(
    evmAddress: string,
    solanaAddress: string,
    signal?: AbortSignal
  ): Promise<ExchangesResponse> {
    return apiClient.get<ExchangesResponse>(
      API_ENDPOINTS.portfolio.exchanges(evmAddress, solanaAddress),
      undefined,
      { signal }
    );
  },
};
