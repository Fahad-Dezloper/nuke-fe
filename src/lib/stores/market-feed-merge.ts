/**
 * When the market feed poll returns a new array, every `AssetDropdownItem` is a
 * new object reference. That makes `selectedAssetAtom` (and any subscriber)
 * appear "changed" on every tick even when numbers are identical — heavy
 * re-renders across charts and controls.
 *
 * Reuse previous row objects when serialized content matches so Jotai/React can
 * skip updates when nothing meaningful changed.
 */

import type { AssetDropdownItem } from '@/types/positions';

function marketFeedRowKey(item: AssetDropdownItem): string {
  return JSON.stringify({
    a: item.asset,
    hl: item.hyperliquidFundingRate,
    pc: item.pacificaFundingRate,
    bp: item.backpackFundingRate ?? null,
    phx: item.phoenixFundingRate ?? null,
    net: item.netAPR,
    m30: item.apr30D,
    ml: item.maxLeverage,
    mp: item.markPx,
    hmp: item.hyperliquidMarkPx ?? null,
    pmp: item.pacificaMarkPx ?? null,
    bmp: item.backpackMarkPx ?? null,
    protocols: item.protocols,
  });
}

/**
 * Merge `next` with `prev`, reusing row references where content is unchanged.
 * Returns `prev` if the merged array is pointer-identical to `prev` (no notify).
 */
export function mergeStableMarketFeed(
  prev: AssetDropdownItem[],
  next: AssetDropdownItem[]
): AssetDropdownItem[] {
  if (prev.length === 0) return next;

  const prevBySymbol = new Map(prev.map((row) => [row.asset, row]));
  const merged = next.map((row) => {
    const old = prevBySymbol.get(row.asset);
    if (old && marketFeedRowKey(old) === marketFeedRowKey(row)) return old;
    return row;
  });

  if (merged.length !== prev.length) return merged;
  for (let i = 0; i < merged.length; i++) {
    if (merged[i] !== prev[i]) return merged;
  }
  return prev;
}
