/**
 * Arbitrage Service
 * Example service for arbitrage-related API calls
 * Replace with your actual API endpoints and logic
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import type { Position, Strategy, PaginatedResponse } from '@/types';

export const arbitrageService = {
  /**
   * Get all positions
   */
  async getPositions(params?: {
    page?: number;
    pageSize?: number;
    status?: 'open' | 'closed';
  }): Promise<PaginatedResponse<Position>> {
    return apiClient.get<PaginatedResponse<Position>>(
      API_ENDPOINTS.arbitrage.positions,
      params
    );
  },

  /**
   * Get a single position by ID
   */
  async getPosition(id: string): Promise<Position> {
    return apiClient.get<Position>(`${API_ENDPOINTS.arbitrage.positions}/${id}`);
  },

  /**
   * Get all strategies
   */
  async getStrategies(): Promise<Strategy[]> {
    return apiClient.get<Strategy[]>(API_ENDPOINTS.arbitrage.strategies);
  },

  /**
   * Get strategy by ID
   */
  async getStrategy(id: string): Promise<Strategy> {
    return apiClient.get<Strategy>(
      `${API_ENDPOINTS.arbitrage.strategies}/${id}`
    );
  },

  /**
   * Create a new strategy
   */
  async createStrategy(data: Omit<Strategy, 'id' | 'createdAt'>): Promise<Strategy> {
    return apiClient.post<Strategy>(API_ENDPOINTS.arbitrage.strategies, data);
  },

  /**
   * Update a strategy
   */
  async updateStrategy(
    id: string,
    data: Partial<Strategy>
  ): Promise<Strategy> {
    return apiClient.patch<Strategy>(
      `${API_ENDPOINTS.arbitrage.strategies}/${id}`,
      data
    );
  },

  /**
   * Delete a strategy
   */
  async deleteStrategy(id: string): Promise<void> {
    return apiClient.delete(`${API_ENDPOINTS.arbitrage.strategies}/${id}`);
  },

  /**
   * Get trading history
   */
  async getHistory(params?: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Position>> {
    return apiClient.get<PaginatedResponse<Position>>(
      API_ENDPOINTS.arbitrage.history,
      params
    );
  },

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalPnl: number;
    totalPositions: number;
    activePositions: number;
    winRate: number;
  }> {
    return apiClient.get(API_ENDPOINTS.arbitrage.stats);
  },
};

