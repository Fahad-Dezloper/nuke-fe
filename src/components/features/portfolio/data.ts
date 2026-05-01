import type { PerformanceTimeframe, VenueKey } from '@/lib/api/services';

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
  lighter: 'Lt',
};

/** Order to render exchange cards in, regardless of API order. */
export const venueDisplayOrder: VenueKey[] = ['hyperliquid', 'backpack', 'pacifica', 'lighter'];
