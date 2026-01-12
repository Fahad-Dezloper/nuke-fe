/**
 * Type Definitions
 * Centralized TypeScript types and interfaces
 */

// API Response Types
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  data?: unknown;
}

// Common Types
export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Example: Arbitrage Types (replace with your actual types)
export interface Position {
  id: string;
  symbol: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

// Position and Trading Types
export * from './positions';
export * from './trading';

// Add more types as needed

