import { getPhoenixFundingHourlyDivisor } from './env';

/** Normalize Phoenix hourly funding from API/WS to match other venues' hourly scale. */
export function normalizePhoenixHourlyFunding(rawHourly: number): number {
  return rawHourly / getPhoenixFundingHourlyDivisor();
}
