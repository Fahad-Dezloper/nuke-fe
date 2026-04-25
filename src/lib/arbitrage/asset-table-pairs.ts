/**
 * Best-pair and top-pair computation for the asset table, respecting
 * selected exchanges and Net APR vs 7D APR metric.
 */

import type { AssetDropdownItem } from '@/types/positions';
import type { HedgeVenueProtocol } from '@/types/hedge-venues';
import type { SpreadAprMap, SpreadAprEntry } from '@/lib/api/services/apr.service';

export const TABLE_EXCHANGE_ORDER: HedgeVenueProtocol[] = [
  'hyperliquid',
  'pacifica',
  'backpack',
  'lighter',
];

export type BestPairMetricMode = 'net_apr' | 'seven_day_apr';

export interface PairRow {
  long: HedgeVenueProtocol;
  short: HedgeVenueProtocol;
  netApr: number;
  sevenDayApr: number | null;
}

export interface BestPairResult {
  long: HedgeVenueProtocol;
  short: HedgeVenueProtocol;
}

export function protocolFundingYearly(
  asset: AssetDropdownItem,
  protocol: HedgeVenueProtocol
): number | null {
  const p = asset.protocols?.[protocol];
  const direct = p?.fundingRateYearly;
  const fallback =
    protocol === 'hyperliquid'
      ? asset.hyperliquidFundingRate
      : protocol === 'pacifica'
        ? asset.pacificaFundingRate
        : protocol === 'backpack'
          ? asset.backpackFundingRate
          : asset.lighterFundingRate;
  const v = typeof direct === 'number' && Number.isFinite(direct) ? direct : fallback;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function findSevenDayForPair(
  spreadRows: SpreadAprEntry[] | undefined,
  long: HedgeVenueProtocol,
  short: HedgeVenueProtocol
): number | null {
  if (!spreadRows?.length) return null;
  const hit = spreadRows.find(
    (e) => e.long_platform === long && e.short_platform === short
  );
  return hit ? hit.total_spread * 52 : null;
}

function defaultPair(selected: readonly HedgeVenueProtocol[]): BestPairResult {
  const ordered = TABLE_EXCHANGE_ORDER.filter((p) => selected.includes(p));
  if (ordered.length >= 2) {
    return { long: ordered[0]!, short: ordered[1]! };
  }
  return { long: 'hyperliquid', short: 'pacifica' };
}

/**
 * Top spread rows for UI (max 3), ordered by the active metric among selected venues only.
 */
export function computeTopPairs(
  asset: AssetDropdownItem,
  spreadAprData: SpreadAprMap,
  selected: readonly HedgeVenueProtocol[],
  metric: BestPairMetricMode
): PairRow[] {
  const sel = new Set(selected);
  if (sel.size < 2) return [];

  if (metric === 'seven_day_apr') {
    const spread = spreadAprData[asset.asset];
    const sorted = spread?.sortedSpreadPairs ?? spread?.topPairs ?? [];
    const filtered = sorted.filter(
      (e) => sel.has(e.long_platform) && sel.has(e.short_platform)
    );
    return filtered.slice(0, 3).map((e) => {
      const long = e.long_platform;
      const short = e.short_platform;
      const longY = protocolFundingYearly(asset, long);
      const shortY = protocolFundingYearly(asset, short);
      const netApr =
        longY != null && shortY != null ? shortY - longY : e.total_spread * 52;
      return {
        long,
        short,
        netApr,
        sevenDayApr: e.total_spread * 52,
      };
    });
  }

  const available = TABLE_EXCHANGE_ORDER.filter((id) => sel.has(id))
    .map((id) => ({ id, yearly: protocolFundingYearly(asset, id) }))
    .filter((e): e is { id: HedgeVenueProtocol; yearly: number } => e.yearly !== null);

  if (available.length < 2) return [];

  const sortedSpread = spreadAprData[asset.asset]?.sortedSpreadPairs ?? [];
  const pairs: PairRow[] = [];
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const a = available[i]!;
      const b = available[j]!;
      const long = a.yearly <= b.yearly ? a : b;
      const short = a.yearly <= b.yearly ? b : a;
      const netApr = short.yearly - long.yearly;
      const sevenDayApr =
        findSevenDayForPair(sortedSpread, long.id, short.id) ??
        findSevenDayForPair(sortedSpread, short.id, long.id);
      pairs.push({
        long: long.id,
        short: short.id,
        netApr,
        sevenDayApr,
      });
    }
  }
  pairs.sort((x, y) => y.netApr - x.netApr);
  return pairs.slice(0, 3);
}

export interface GetBestPairOptions {
  selectedExchanges: readonly HedgeVenueProtocol[];
  metric: BestPairMetricMode;
}

export function getBestPairResolved(
  asset: AssetDropdownItem | null | undefined,
  spreadAprData: SpreadAprMap,
  override: BestPairResult | null | undefined,
  options?: GetBestPairOptions
): BestPairResult {
  const selectedExchanges = options?.selectedExchanges ?? TABLE_EXCHANGE_ORDER;
  const metric = options?.metric ?? 'seven_day_apr';

  const DEFAULT = defaultPair(selectedExchanges);
  if (!asset) return DEFAULT;

  const sel = new Set(selectedExchanges);
  if (sel.size < 2) return DEFAULT;

  if (override && sel.has(override.long) && sel.has(override.short)) {
    return override;
  }

  const top = computeTopPairs(asset, spreadAprData, selectedExchanges, metric);
  if (top[0]) {
    return { long: top[0].long, short: top[0].short };
  }

  const entries = TABLE_EXCHANGE_ORDER.filter((id) => sel.has(id))
    .map((id) => ({ id, yearly: protocolFundingYearly(asset, id) }))
    .filter((e): e is { id: HedgeVenueProtocol; yearly: number } => e.yearly !== null);

  if (entries.length < 2) return DEFAULT;

  entries.sort((a, b) => a.yearly - b.yearly);
  return { long: entries[0]!.id, short: entries[entries.length - 1]!.id };
}

export function maxLeverageAmongSelected(
  asset: AssetDropdownItem,
  selected: readonly HedgeVenueProtocol[]
): number {
  const levs = selected
    .map((id) => asset.protocols?.[id]?.maxLeverage)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  if (levs.length === 0) return asset.maxLeverage;
  return Math.min(...levs);
}
