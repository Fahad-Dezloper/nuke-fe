/**
 * Trading Types
 * Shared type definitions for trading operations
 */

/**
 * Leverage configuration
 */
export interface LeverageConfig {
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * Position Size configuration
 */
export interface PositionSizeConfig {
  currency: string;
  minSize: number;
  stepSize: number;
  conversionRate?: number; // For currency conversion
}

/**
 * Currency option for position size
 */
export type Currency = 'USD' | 'EUR' | 'GBP';

