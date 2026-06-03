import type { PerformanceTimeframe, VenueKey } from '@/lib/api/services';
import type { FundExchange } from '@/hooks/use-fund-exchange';

/** Map portfolio venue to fund-exchange target for Add Margin. */
export function venueToFundExchange(venue: VenueKey): FundExchange | null {
  switch (venue) {
    case 'hyperliquid':
      return 'hyperliquid';
    case 'pacifica':
      return 'pacifica';
    case 'phoenix':
      return 'phoenix';
    case 'lighter':
      return 'lighter';
    default:
      return null;
  }
}

export const timeframeTabs = ['Day', 'Week', 'Month', 'All'] as const;

export type TimeframeTab = (typeof timeframeTabs)[number];

export const tabToApiTimeframe: Record<TimeframeTab, PerformanceTimeframe> = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
  All: 'all',
};

/** Display monogram shown when a venue logo image isn't available. */
export const venueMarks: Record<VenueKey, string> = {
  hyperliquid: 'HL',
  backpack: 'BP',
  pacifica: 'Pa',
  phoenix: 'Phx',
  lighter: 'Lt',
};

/** Order to render exchange cards in, regardless of API order. */
export const venueDisplayOrder: VenueKey[] = [
  'hyperliquid',
  'backpack',
  'pacifica',
  'phoenix',
  'lighter',
];
