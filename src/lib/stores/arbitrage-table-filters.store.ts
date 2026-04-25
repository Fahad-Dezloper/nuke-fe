'use client';

import { atom } from 'jotai';
import type { HedgeVenueProtocol } from '@/types/hedge-venues';
import { TABLE_EXCHANGE_ORDER } from '@/lib/arbitrage/asset-table-pairs';
import type { BestPairMetricMode } from '@/lib/arbitrage/asset-table-pairs';

export function defaultExchangeSelection(): Record<HedgeVenueProtocol, boolean> {
  return {
    hyperliquid: true,
    pacifica: true,
    backpack: false,
    lighter: true,
  };
}

/** Which venues appear in the arb table and participate in best-pair logic. Min 2 always on. */
export const selectedExchangesAtom = atom<Record<HedgeVenueProtocol, boolean>>(
  defaultExchangeSelection()
);

export const toggleExchangeAtom = atom(
  null,
  (get, set, protocol: HedgeVenueProtocol) => {
    const cur = get(selectedExchangesAtom);
    if (cur[protocol]) {
      const count = TABLE_EXCHANGE_ORDER.filter((p) => cur[p]).length;
      if (count <= 2) return;
    }
    set(selectedExchangesAtom, { ...cur, [protocol]: !cur[protocol] });
  }
);

/** Whether best pair + top rows use live net spread or 7D spread from CRON. */
export const bestPairMetricAtom = atom<BestPairMetricMode>('seven_day_apr');

export function selectedVenuesList(
  map: Record<HedgeVenueProtocol, boolean>
): HedgeVenueProtocol[] {
  return TABLE_EXCHANGE_ORDER.filter((p) => map[p]);
}
