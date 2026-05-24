'use client';

/**
 * Asset Dropdown Component
 * Professional dropdown component for selecting assets with search functionality
 * Displays asset image, name, max leverage, funding rates, and APR data
 *
 * Supports column sorting on Price, Net APR, and 7D APR.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  TABLE_EXCHANGE_ORDER,
  computeTopPairs,
  maxLeverageAmongSelected,
  protocolFundingYearly,
  type BestPairMetricMode,
} from '@/lib/arbitrage/asset-table-pairs';
import {
  selectedExchangesAtom,
  toggleExchangeAtom,
  bestPairMetricAtom,
  selectedVenuesList,
} from '@/lib/stores/arbitrage-table-filters.store';
import {
  ChevronDown,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercentWithSign, formatPrice } from '@/lib/utils';
import type { AssetDropdownItem } from '@/types/positions';
import {
  marketFeedDataAtom,
  selectedAssetAtom,
  selectedAssetSymbolAtom,
} from '@/lib/stores/market-feed.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import { useAssetQueryParam } from '@/lib/hooks/use-asset-query-param';
import { BestPairTooltip } from './best-pair-tooltip';
import type { SpreadAprMap } from '@/lib/api/services/apr.service';
import Image from 'next/image';
import { hyperliquidCoinIconUrl } from '@/lib/hyperliquid/coin-icon-url';
import { getProtocolConfig } from '@/lib/protocols/config';
import type { Protocol } from '@/hooks/use-best-pair';

// ─── Sorting Types & Helpers ──────────────────────────────────────────────────

/** Columns that support sorting */
type SortColumn = 'price' | 'netApr' | '7dApr';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  column: SortColumn | null;
  direction: SortDirection;
}

/** Default sort: 7D APR descending (highest first) */
const DEFAULT_SORT: SortConfig = { column: '7dApr', direction: 'desc' };

function tableGridStyle(visibleCount: number): CSSProperties {
  const parts = [
    'minmax(140px,auto)',
    'minmax(140px,auto)',
    'minmax(100px,auto)',
    ...Array.from({ length: visibleCount }, () => 'minmax(100px,auto)'),
    'minmax(90px,auto)',
    'minmax(90px,auto)',
  ];
  return { gridTemplateColumns: parts.join(' ') };
}

/**
 * Extract the numeric value for a given sort column from an asset.
 * Returns 0 for missing / unparseable values so they sort to the bottom.
 */
function getSortValue(
  asset: AssetDropdownItem,
  column: SortColumn,
  spreadAprData: SpreadAprMap,
  selected: readonly Protocol[],
  metric: BestPairMetricMode
): number {
  switch (column) {
    case 'price':
      return asset.markPx || asset.hyperliquidMarkPx || 0;
    case 'netApr':
      return computeTopPairs(asset, spreadAprData, selected, 'net_apr')[0]?.netApr ?? 0;
    case '7dApr':
      return (
        computeTopPairs(asset, spreadAprData, selected, 'seven_day_apr')[0]?.sevenDayApr ??
        spreadAprData[asset.asset]?.sevenDayApr ??
        -Infinity
      );
    default:
      return 0;
  }
}

/**
 * Compare two assets based on a SortConfig.
 * Falls back to alphabetical asset name when values are equal.
 */
function compareAssets(
  a: AssetDropdownItem,
  b: AssetDropdownItem,
  sort: SortConfig,
  spreadAprData: SpreadAprMap,
  selected: readonly Protocol[],
  metric: BestPairMetricMode
): number {
  if (!sort.column) return 0;

  const valA = getSortValue(a, sort.column, spreadAprData, selected, metric);
  const valB = getSortValue(b, sort.column, spreadAprData, selected, metric);

  const diff = sort.direction === 'desc' ? valB - valA : valA - valB;

  // Stable sort: tie-break by asset name
  if (diff === 0) return a.asset.localeCompare(b.asset);
  return diff;
}

/**
 * Advance sort state when a column header is clicked.
 *
 * - Clicking a NEW column → sort that column descending
 * - Clicking the SAME column → toggle direction (desc → asc → reset to default)
 */
function nextSortState(current: SortConfig, column: SortColumn): SortConfig {
  if (current.column !== column) {
    return { column, direction: 'desc' };
  }
  if (current.direction === 'desc') {
    return { column, direction: 'asc' };
  }
  // asc → reset to default sort
  return DEFAULT_SORT;
}

function ExchangeFundingCell({
  asset,
  protocol,
  muted,
}: {
  asset: AssetDropdownItem;
  protocol: Protocol;
  muted?: boolean;
}) {
  const y = protocolFundingYearly(asset, protocol);
  const has = asset.protocols[protocol] != null && y !== null;
  const positive = has && y !== null && y >= 0;
  return (
    <div className={cn('flex items-center gap-1.5', muted && 'opacity-80')}>
      {has && y != null ? (
        <>
          {positive ? (
            <ArrowUp className="h-3 w-3 text-green-400 shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 text-red-400 shrink-0" />
          )}
          <span
            className={cn('text-sm tabular-nums', positive ? 'text-green-400' : 'text-red-400')}
          >
            {formatPercentWithSign(y)}
          </span>
        </>
      ) : (
        <span className="text-sm text-text-muted-60 tabular-nums">—</span>
      )}
    </div>
  );
}

// ─── Sortable Header Sub-Component ───────────────────────────────────────────

interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  sort: SortConfig;
  onSort: (column: SortColumn) => void;
}

/**
 * A clickable table header cell with a sort indicator icon.
 */
function SortableHeader({ label, column, sort, onSort }: SortableHeaderProps) {
  const isActive = sort.column === column;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSort(column);
      }}
      className={cn(
        'flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold transition-colors',
        'hover:text-text-primary cursor-pointer select-none',
        isActive ? 'text-white' : 'text-text-muted-60'
      )}
    >
      {label}
      <span className="inline-flex shrink-0">
        {isActive ? (
          sort.direction === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </button>
  );
}

export interface AssetDropdownProps {
  selectedAsset?: AssetDropdownItem;
  onSelect?: (asset: AssetDropdownItem) => void;
  className?: string;
  placeholder?: string;
  /** Compact trigger for the asset header strip */
  variant?: 'default' | 'header';
}

export function AssetDropdown({
  selectedAsset: propSelectedAsset,
  onSelect,
  className,
  placeholder = 'Select asset',
  variant = 'default',
}: AssetDropdownProps) {
  // Get assets from global store
  const assets = useAtomValue(marketFeedDataAtom);
  const globalSelectedAsset = useAtomValue(selectedAssetAtom);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  void useAtomValue(selectedAssetSymbolAtom);
  const setBestPairOverride = useSetAtom(bestPairOverrideAtom);
  const { getBestPairForAsset, spreadAprData, metric } = useBestPair();
  const selectedExchangeMap = useAtomValue(selectedExchangesAtom);
  const setToggleExchange = useSetAtom(toggleExchangeAtom);
  const setPairMetric = useSetAtom(bestPairMetricAtom);

  const selectedList = useMemo(
    () => selectedVenuesList(selectedExchangeMap),
    [selectedExchangeMap]
  );

  const tableGrid = useMemo(() => tableGridStyle(selectedList.length), [selectedList.length]);

  // URL query param sync
  const { updateUrlWithAsset } = useAssetQueryParam();

  // Use prop if provided, otherwise use global state
  const selectedAsset = propSelectedAsset || globalSelectedAsset;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hoveredAsset, setHoveredAsset] = useState<AssetDropdownItem | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  /** Handler for clicking a sortable column header */
  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) => nextSortState(prev, column));
  }, []);

  // Filter and sort assets
  const sortedAndFilteredAssets = useMemo(() => {
    let filtered = assets;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = assets.filter(
        (asset) =>
          asset.asset.toLowerCase().includes(query) || asset.asset.toLowerCase().startsWith(query)
      );
    }

    // Apply sort
    return [...filtered].sort((a, b) =>
      compareAssets(a, b, sort, spreadAprData, selectedList, metric)
    );
  }, [assets, searchQuery, sort, spreadAprData, selectedList, metric]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setHoveredAsset(null);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (
    asset: AssetDropdownItem,
    overridePair?: { long: Protocol; short: Protocol } | null
  ) => {
    // Update global state
    setSelectedAsset(asset);
    // Set/clear best pair override for this asset
    setBestPairOverride((prev) => {
      const next = { ...prev };
      if (overridePair) next[asset.asset] = overridePair;
      else delete next[asset.asset];
      return next;
    });
    // Update URL query param
    updateUrlWithAsset(asset.asset);
    // Call prop callback if provided
    onSelect?.(asset);
    setIsOpen(false);
    setSearchQuery('');
    setHoveredAsset(null);
  };

  const toggleExpanded = useCallback((symbol: string) => {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }, []);

  // Note: Auto-selection is now handled by useAssetQueryParam hook
  // which initializes from URL or falls back to default asset (BTC)

  const handleBestPairMouseEnter = (
    event: React.MouseEvent<HTMLDivElement>,
    asset: AssetDropdownItem
  ) => {
    setHoveredAsset(asset);
    const targetElement = event.currentTarget;
    const rect = targetElement.getBoundingClientRect();

    // Find the scrollable container (Assets List)
    const scrollableContainer = targetElement.closest('.custom-scrollbar') as HTMLElement;

    if (scrollableContainer) {
      const containerRect = scrollableContainer.getBoundingClientRect();
      const scrollTop = scrollableContainer.scrollTop;

      // Calculate position relative to the scrollable container
      // The tooltip is positioned absolutely within the relative container
      const relativeLeft = rect.left - containerRect.left;
      const relativeTop = rect.top - containerRect.top + scrollTop;

      setTooltipPosition({
        x: relativeLeft,
        y: relativeTop + rect.height + 4, // 4px gap below the element
      });
    }
  };

  const handleBestPairMouseLeave = () => {
    setHoveredAsset(null);
    setTooltipPosition(null);
  };

  const ProtocolIcon = ({ protocol }: { protocol: Protocol }) => {
    const cfg = getProtocolConfig(protocol);
    if (!cfg) return null;
    const isBackpack = protocol === 'backpack';
    return (
      <Image
        src={cfg.logo}
        alt={cfg.displayName}
        width={isBackpack ? 12 : 20}
        height={isBackpack ? 12 : 20}
        className={cn('shrink-0', protocol !== 'backpack' && 'rounded-full')}
      />
    );
  };

  return (
    <div ref={dropdownRef} className={cn('relative z-10000', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 cursor-pointer group transition-colors relative z-10001',
          variant === 'default' && [
            'px-3 py-1.5 min-w-[140px] rounded-sm',
            'bg-secondary border border-border-white-10',
            'hover:border-border-white-20',
          ],
          variant === 'header' && 'px-0 py-0 hover:opacity-90'
        )}
      >
        {selectedAsset ? (
          <>
            {variant === 'default' && (
              <Image
                src={hyperliquidCoinIconUrl(selectedAsset.asset)}
                alt={selectedAsset.asset}
                width={20}
                height={20}
                className="shrink-0 rounded-full"
              />
            )}
            <span
              className={cn(
                'font-semibold text-text-primary',
                variant === 'header' ? 'text-base' : 'text-sm'
              )}
            >
              {selectedAsset.asset}
            </span>
            <span className="text-[10px] text-text-muted-40 uppercase tracking-wide">Perp</span>
          </>
        ) : (
          <span className="text-text-muted-60 text-sm">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-text-muted-60 group-hover:text-text-primary transition-all shrink-0',
            variant === 'default' && 'ml-auto',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-2 z-10002',
            'w-auto min-w-[1280px] max-w-[1580px] min-h-[500px] max-h-[600px] overflow-hidden',
            'bg-background border border-border-white-20',
            'rounded-sm shadow-2xl shadow-black/60',
            'ring-1 ring-white/10',
            'flex flex-col'
          )}
        >
          {/* Header with Legend */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-white-10/50 bg-card">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
              <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                FUNDING RATE ARBITRAGE
              </span>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <ArrowUp className="h-3.5 w-3.5 text-chart-hyperliquid" />
                <span className="text-[11px] text-text-muted-60 uppercase tracking-wide font-medium">
                  LONG
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowDown className="h-3.5 w-3.5 text-chart-pink" />
                <span className="text-[11px] text-text-muted-60 uppercase tracking-wide font-medium">
                  SHORT
                </span>
              </div>
              <span className="text-[11px] text-text-muted-60 font-medium">
                {sortedAndFilteredAssets.length}/{assets.length} pairs
              </span>
            </div>
          </div>

          {/* Search Input */}
          <div className="px-5 py-3 border-b border-border-white-10/50 bg-card/30">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted-60 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search asset..."
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-sm',
                  'bg-card border border-border-white-10',
                  'text-sm text-text-primary placeholder:text-text-muted-40',
                  'shadow-sm shadow-black/10',
                  'focus:outline-none focus:bg-card/70 focus:border-border-white-30 focus:ring-2 focus:ring-accent/20',
                  'transition-all duration-200'
                )}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Exchange filters + best-pair metric */}
          <div className="px-5 py-3 border-b border-border-white-10/50 bg-black/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted-60">
                  Exchanges
                </span>
                <div className="flex flex-wrap gap-2">
                  {TABLE_EXCHANGE_ORDER.map((id) => {
                    const cfg = getProtocolConfig(id);
                    if (!cfg) return null;
                    const on = selectedExchangeMap[id];
                    const count = TABLE_EXCHANGE_ORDER.filter((p) => selectedExchangeMap[p]).length;
                    const lockOn = on && count <= 2;
                    const isBp = id === 'backpack';
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={lockOn}
                        aria-pressed={on}
                        onClick={(e) => {
                          e.stopPropagation();
                          setToggleExchange(id);
                        }}
                        className={cn(
                          'group inline-flex items-center gap-2 rounded-sm border py-2 px-4 text-xs text-left transition-all duration-200 cursor-pointer',
                          on
                            ? ' bg-white/[0.07] text-text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                            : 'border-white/[0.07] bg-transparent text-text-muted-60 hover:border-white/12 hover:bg-white/[0.03] hover:text-text-primary',
                          lockOn && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex  shrink-0 items-center justify-center rounded-sm border transition-colors',
                            on
                              ? ' bg-black/40'
                              : 'border-white/[0.06] bg-black/25 group-hover:border-white/10'
                          )}
                        >
                          <Image
                            src={cfg.logo}
                            alt=""
                            width={isBp ? 10 : 14}
                            height={isBp ? 10 : 14}
                            className={cn('shrink-0', !isBp && 'rounded-full')}
                          />
                        </span>
                        <span className="text-xs font-semibold tracking-tight">
                          {cfg.chipLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted-60">
                  Best pair by
                </span>
                <div
                  className="inline-flex h-10 shrink-0 items-stretch rounded-sm border border-white/[0.1] bg-black/35 p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                  role="group"
                  aria-label="Best pair metric"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPairMetric('seven_day_apr');
                    }}
                    className={cn(
                      'min-w-[5.75rem] rounded-sm px-3 cursor-pointer text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer',
                      metric === 'seven_day_apr'
                        ? 'bg-white/[0.12] text-white shadow-sm ring-1 ring-inset ring-white/[0.08]'
                        : 'text-text-muted-60 hover:text-text-primary'
                    )}
                  >
                    7D APR
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPairMetric('net_apr');
                    }}
                    className={cn(
                      'min-w-[5.75rem] rounded-sm px-3 cursor-pointer text-xs font-semibold tracking-tight transition-all duration-200',
                      metric === 'net_apr'
                        ? 'bg-white/[0.12] text-white shadow-sm ring-1 ring-inset ring-white/[0.08]'
                        : 'text-text-muted-60 hover:text-text-primary'
                    )}
                  >
                    Net APR
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div className="sticky top-0 z-10001 px-5 py-3 border-b border-border-white-10/50 bg-card shrink-0">
            <div className="grid gap-4" style={tableGrid}>
              <span className="text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold">
                ASSET
              </span>
              <span className="text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold">
                BEST PAIR
              </span>
              <SortableHeader label="PRICE" column="price" sort={sort} onSort={handleSort} />
              {selectedList.map((id) => {
                const cfg = getProtocolConfig(id);
                if (!cfg) return null;
                const isBp = id === 'backpack';
                return (
                  <span
                    key={id}
                    className="text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold flex items-center gap-2"
                  >
                    <Image
                      src={cfg.logo}
                      alt={cfg.displayName}
                      width={isBp ? 12 : 20}
                      height={isBp ? 12 : 20}
                      className={cn('rounded shrink-0', id !== 'backpack' && 'rounded-full')}
                    />
                    {cfg.displayName.toUpperCase()}
                  </span>
                );
              })}
              <SortableHeader label="NET APR" column="netApr" sort={sort} onSort={handleSort} />
              <SortableHeader label="7D APR" column="7dApr" sort={sort} onSort={handleSort} />
            </div>
          </div>

          {/* Assets List */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
            {sortedAndFilteredAssets.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-text-muted-60 text-sm font-medium">No assets found</p>
              </div>
            ) : (
              <div className="divide-y divide-border-white-10/30">
                {sortedAndFilteredAssets.map((asset) => {
                  const isSelected = selectedAsset?.asset === asset.asset;
                  const topPairs = computeTopPairs(asset, spreadAprData, selectedList, metric);
                  const bestPair = topPairs[0]
                    ? { long: topPairs[0].long, short: topPairs[0].short }
                    : getBestPairForAsset(asset);
                  const assetSpreadApr = spreadAprData[asset.asset];
                  const isExpanded = expandedAssets.has(asset.asset);
                  const maxLev = maxLeverageAmongSelected(asset, selectedList);

                  return (
                    <div key={asset.asset} className="relative">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelect(asset, null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelect(asset, null);
                          }
                        }}
                        className={cn(
                          'w-full grid items-center gap-4 px-5 py-3.5',
                          'text-left transition-all duration-200',
                          'border-l-[3px] border-l-transparent',
                          'hover:border-l-accent/60 hover:bg-card cursor-pointer',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                          isSelected && 'bg-card/20 border-l-accent/40',
                          'group'
                        )}
                        style={tableGrid}
                      >
                        {/* Asset */}
                        <div className="flex items-center gap-2.5">
                          <Image
                            src={hyperliquidCoinIconUrl(asset.asset)}
                            alt={asset.asset}
                            width={24}
                            height={24}
                            className="rounded-full shrink-0 ring-1 ring-border-white-10/50"
                          />
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-text-primary leading-tight">
                                {asset.asset}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(asset.asset);
                                }}
                                className={cn(
                                  'inline-flex items-center justify-center rounded-sm',
                                  'h-5 w-5 border border-border-white-10/40 bg-white/5',
                                  'hover:bg-white/10 hover:border-border-white-20/60 transition-colors',
                                  'text-text-muted-60 hover:text-text-primary'
                                )}
                                aria-label={isExpanded ? 'Hide more pairs' : 'Show more pairs'}
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-3 w-3 transition-transform duration-150',
                                    isExpanded && 'rotate-180'
                                  )}
                                />
                              </button>
                            </div>
                            <span className="text-[11px] text-text-muted-60 leading-tight font-medium">
                              Max {maxLev}x
                            </span>
                          </div>
                        </div>

                        {/* Best Pair */}
                        <div className="relative">
                          <div
                            ref={tooltipRef}
                            className="flex items-center gap-2 cursor-pointer"
                            onMouseEnter={(e) => handleBestPairMouseEnter(e, asset)}
                            onMouseLeave={handleBestPairMouseLeave}
                          >
                            <div className="flex items-center gap-1.5">
                              <ProtocolIcon protocol={bestPair.long} />
                              <ArrowUpRight className="h-3 w-3 text-text-muted-40" />
                              <ProtocolIcon protocol={bestPair.short} />
                            </div>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-center">
                          <span className="text-sm  text-text-primary tabular-nums">
                            {formatPrice(
                              asset.markPx || asset.hyperliquidMarkPx || 0,
                              'USD',
                              'en-US',
                              2,
                              4
                            )}
                          </span>
                        </div>

                        {selectedList.map((ex) => (
                          <ExchangeFundingCell key={ex} asset={asset} protocol={ex} />
                        ))}

                        {/* NET APR */}
                        <span className="text-sm  tabular-nums text-green-400">
                          {topPairs[0]
                            ? formatPercentWithSign(topPairs[0].netApr)
                            : formatPercentWithSign(asset.netAPR)}
                        </span>

                        {/* 7D APR */}
                        <span className="text-sm  tabular-nums text-green-400">
                          {topPairs[0]?.sevenDayApr != null
                            ? formatPercentWithSign(topPairs[0].sevenDayApr)
                            : assetSpreadApr
                              ? formatPercentWithSign(assetSpreadApr.sevenDayApr)
                              : '—'}
                        </span>
                      </div>

                      {/* Expanded: show next 2 pairs */}
                      {isExpanded && topPairs.length > 1 && (
                        <div className="px-5 pb-3">
                          <div className="mt-1 space-y-1">
                            {topPairs.slice(1, 3).map((pair, idx) => (
                              <button
                                type="button"
                                key={`${pair.long}-${pair.short}-${idx}`}
                                style={tableGrid}
                                className={cn(
                                  'grid items-center gap-4',
                                  'w-full text-left transition-all duration-200',
                                  'px-5 py-3.5 rounded-sm',
                                  'bg-white/5 border border-border-white-10/30',
                                  'hover:bg-card cursor-pointer'
                                )}
                                onClick={() =>
                                  handleSelect(asset, { long: pair.long, short: pair.short })
                                }
                              >
                                {/* Asset */}
                                <div className="flex items-center gap-2.5 opacity-80">
                                  <Image
                                    src={hyperliquidCoinIconUrl(asset.asset)}
                                    alt={asset.asset}
                                    width={24}
                                    height={24}
                                    className="rounded-full shrink-0 ring-1 ring-border-white-10/50"
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-text-primary leading-tight">
                                      {asset.asset}
                                    </span>
                                    <span className="text-[11px] text-text-muted-60 leading-tight font-medium">
                                      Max {maxLev}x
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <ProtocolIcon protocol={pair.long} />
                                  <ArrowUpRight className="h-3 w-3 text-text-muted-40" />
                                  <ProtocolIcon protocol={pair.short} />
                                </div>
                                {/* Price */}
                                <div className="flex items-center">
                                  <span className="text-sm text-text-primary tabular-nums opacity-80">
                                    {formatPrice(
                                      asset.markPx || asset.hyperliquidMarkPx || 0,
                                      'USD',
                                      'en-US',
                                      2,
                                      4
                                    )}
                                  </span>
                                </div>
                                {selectedList.map((ex) => (
                                  <ExchangeFundingCell key={ex} asset={asset} protocol={ex} muted />
                                ))}
                                <span className="text-sm tabular-nums text-green-400 opacity-80">
                                  {formatPercentWithSign(pair.netApr)}
                                </span>
                                <span className="text-sm tabular-nums text-green-400 opacity-80">
                                  {pair.sevenDayApr != null
                                    ? formatPercentWithSign(pair.sevenDayApr)
                                    : formatPercentWithSign(pair.netApr)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Tooltip - rendered at dropdown level for proper positioning */}
            {hoveredAsset && tooltipPosition && (
              <BestPairTooltip asset={hoveredAsset} isVisible={true} position={tooltipPosition} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
