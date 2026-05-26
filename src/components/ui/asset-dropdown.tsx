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
  X,
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
import { useUpdateTradingUrl } from '@/lib/hooks/use-trading-url-params';
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
  /** Stretch trigger to full container width (mobile header) */
  fullWidth?: boolean;
}

export function AssetDropdown({
  selectedAsset: propSelectedAsset,
  onSelect,
  className,
  placeholder = 'Select asset',
  fullWidth = false,
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
  const updateTradingUrl = useUpdateTradingUrl();

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

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
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
    updateTradingUrl({
      asset: asset.asset,
      pair: overridePair ?? undefined,
    });
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
          'group relative z-10001 flex cursor-pointer items-center gap-2.5 rounded-md border border-border-white-10/50',
          'bg-card/40 px-3 py-2.5 shadow-md shadow-black/10 backdrop-blur-sm transition-all',
          'hover:border-border-white-20 hover:bg-card/60',
          fullWidth ? 'w-full min-w-0' : 'min-w-[140px]'
        )}
      >
        {selectedAsset ? (
          <>
            <Image
              src={hyperliquidCoinIconUrl(selectedAsset.asset)}
              alt={selectedAsset.asset}
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full ring-1 ring-border-white-10"
            />
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-text-primary">{selectedAsset.asset}</span>
                {fullWidth && (
                  <span className="rounded border border-green-500/25 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-green-400">
                    {formatPercentWithSign(selectedAsset.netAPR)}
                  </span>
                )}
              </div>
              {fullWidth && (
                <p className="mt-0.5 truncate text-[11px] text-text-muted-60">
                  Tap to change asset
                </p>
              )}
            </div>
          </>
        ) : (
          <span className="flex-1 text-left text-sm text-text-muted-60">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-muted-60 transition-all group-hover:text-text-primary',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close asset list"
          className="fixed inset-0 z-[10001] bg-black/70 lg:hidden"
          onClick={() => {
            setIsOpen(false);
            setSearchQuery('');
          }}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'z-[10002] flex flex-col overflow-hidden',
            'bg-background/98 backdrop-blur-xl border border-border-white-20/50',
            'shadow-2xl shadow-black/60 ring-1 ring-white/10',
            // Mobile: bottom sheet
            'fixed inset-x-0 bottom-0 max-h-[min(92dvh,760px)] rounded-t-xl border-b-0',
            'pb-[env(safe-area-inset-bottom,0px)]',
            // Desktop: anchored panel
            'lg:absolute lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-full lg:mt-2',
            'lg:min-h-[500px] lg:max-h-[600px] lg:w-auto lg:min-w-[1280px] lg:max-w-[1580px] lg:rounded-lg'
          )}
        >
          {/* Sheet handle — mobile */}
          <div className="flex shrink-0 justify-center pt-2 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-border-white-20" />
          </div>

          {/* Header with Legend */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-white-10/50 bg-section-surface px-4 py-3 sm:px-5 sm:py-3.5 lg:bg-linear-to-r lg:from-card/70 lg:via-card/60 lg:to-card/70">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-text-primary">Select asset</span>
              <span className="text-[11px] text-text-muted-60 tabular-nums">
                {sortedAndFilteredAssets.length} of {assets.length} pairs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-text-muted-60 sm:inline">
                Sorted by {sort.column === '7dApr' ? '7D APR' : sort.column === 'netApr' ? 'Net APR' : sort.column === 'price' ? 'Price' : 'default'}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className="flex size-8 items-center justify-center rounded-md border border-border-white-10 bg-card/50 text-text-muted-60 transition-colors hover:text-text-primary lg:hidden"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="shrink-0 border-b border-border-white-10/50 bg-card/30 px-3 py-2.5 sm:px-5 sm:py-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted-60 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search asset..."
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-md',
                  'bg-card/50 backdrop-blur-sm border border-border-white-10/50',
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

          {/* Mobile sort chips */}
          <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 py-2.5 lg:hidden">
            {(
              [
                { col: '7dApr' as const, label: '7D APR' },
                { col: 'netApr' as const, label: 'Net APR' },
                { col: 'price' as const, label: 'Price' },
              ] as const
            ).map(({ col, label }) => (
              <button
                key={col}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort(col);
                }}
                className={cn(
                  'shrink-0 rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  sort.column === col
                    ? 'border-accent/40 bg-accent/15 text-accent'
                    : 'border-border-white-10 bg-card/30 text-text-muted-60'
                )}
              >
                {label}
                {sort.column === col && (sort.direction === 'desc' ? ' ↓' : ' ↑')}
              </button>
            ))}
          </div>

          {/* Exchange filters + best-pair metric */}
          <div className="shrink-0 border-b border-border-white-10/50 bg-black/20 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted-60">
                  Exchanges
                </span>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
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
                          'group inline-flex shrink-0 items-center gap-1.5 rounded-md border py-1.5 px-2.5 text-[11px] text-left transition-all duration-200 cursor-pointer sm:gap-2 sm:rounded-lg sm:py-2 sm:px-4 sm:text-xs',
                          on
                            ? ' bg-white/[0.07] text-text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                            : 'border-white/[0.07] bg-transparent text-text-muted-60 hover:border-white/12 hover:bg-white/[0.03] hover:text-text-primary',
                          lockOn && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex  shrink-0 items-center justify-center rounded-lg border transition-colors',
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
                  className="flex h-9 w-full shrink-0 items-stretch rounded-md border border-white/[0.1] bg-black/35 p-0.5 sm:inline-flex sm:h-10 sm:w-auto sm:rounded-lg"
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
                      'min-w-[5.75rem] rounded-lg px-3 cursor-pointer text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer',
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
                      'min-w-[5.75rem] rounded-lg px-3 cursor-pointer text-xs font-semibold tracking-tight transition-all duration-200',
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

          {/* Table Header — desktop only */}
          <div className="sticky top-0 z-10001 hidden shrink-0 border-b border-border-white-10/50 bg-linear-to-r from-card/60 via-card/50 to-card/60 px-5 py-3 shadow-lg shadow-black/20 backdrop-blur-md lg:block">
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
          <div className="relative min-h-0 flex-1 overflow-y-auto scroll-touch custom-scrollbar">
            {sortedAndFilteredAssets.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-text-muted-60 text-sm font-medium">No assets found</p>
              </div>
            ) : (
              <>
              {/* Mobile card list */}
              <div className="flex flex-col gap-2 p-3 lg:hidden">
                {sortedAndFilteredAssets.map((asset) => {
                  const isSelected = selectedAsset?.asset === asset.asset;
                  const topPairs = computeTopPairs(asset, spreadAprData, selectedList, metric);
                  const bestPair = topPairs[0]
                    ? { long: topPairs[0].long, short: topPairs[0].short }
                    : getBestPairForAsset(asset);
                  const maxLev = maxLeverageAmongSelected(asset, selectedList);
                  const aprValue =
                    topPairs[0] != null
                      ? metric === 'seven_day_apr'
                        ? (topPairs[0].sevenDayApr ?? topPairs[0].netApr)
                        : topPairs[0].netApr
                      : asset.netAPR;
                  const apr = formatPercentWithSign(aprValue);
                  const aprPositive = aprValue >= 0;
                  const longCfg = getProtocolConfig(bestPair.long);
                  const shortCfg = getProtocolConfig(bestPair.short);
                  const price = formatPrice(
                    asset.markPx || asset.hyperliquidMarkPx || 0,
                    'USD',
                    'en-US',
                    2,
                    2
                  );

                  return (
                    <button
                      key={asset.asset}
                      type="button"
                      onClick={() => handleSelect(asset, null)}
                      className={cn(
                        'w-full rounded-md border text-left touch-manipulation transition-all active:scale-[0.99]',
                        isSelected
                          ? 'border-accent/50 bg-accent/10 shadow-[0_0_0_1px_rgba(137,207,240,0.2)]'
                          : 'border-border-white-10 bg-section-surface active:bg-card/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 p-3 pb-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <Image
                            src={hyperliquidCoinIconUrl(asset.asset)}
                            alt={asset.asset}
                            width={36}
                            height={36}
                            className="size-9 shrink-0 rounded-full ring-1 ring-border-white-10"
                          />
                          <div className="min-w-0">
                            <p className="text-base font-bold leading-tight text-text-primary">
                              {asset.asset}
                            </p>
                            <p className="mt-0.5 text-[11px] text-text-muted-60">
                              Max leverage {maxLev}x
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'shrink-0 rounded-md border px-2.5 py-1.5 text-right',
                            aprPositive
                              ? 'border-green-500/25 bg-green-500/10'
                              : 'border-red-500/25 bg-red-500/10'
                          )}
                        >
                          <p
                            className={cn(
                              'text-sm font-bold tabular-nums leading-none',
                              aprPositive ? 'text-green-400' : 'text-red-400'
                            )}
                          >
                            {apr}
                          </p>
                          <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-text-muted-40">
                            {metric === 'seven_day_apr' ? '7D APR' : 'Net APR'}
                          </p>
                        </div>
                      </div>

                      <div className="mx-3 mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border-white-10 bg-border-white-10">
                        <div className="bg-card/40 px-2.5 py-2">
                          <p className="text-[9px] font-medium uppercase tracking-wider text-text-muted-40">
                            Best pair
                          </p>
                          <div className="mt-1.5 flex items-center gap-1">
                            <ProtocolIcon protocol={bestPair.long} />
                            <ArrowUpRight className="size-3 shrink-0 text-text-muted-40" />
                            <ProtocolIcon protocol={bestPair.short} />
                          </div>
                          <p className="mt-1 truncate text-[11px] font-medium text-text-primary">
                            {longCfg?.chipLabel ?? bestPair.long}
                            <span className="text-text-muted-40"> → </span>
                            {shortCfg?.chipLabel ?? bestPair.short}
                          </p>
                        </div>
                        <div className="bg-card/40 px-2.5 py-2">
                          <p className="text-[9px] font-medium uppercase tracking-wider text-text-muted-40">
                            Mark price
                          </p>
                          <p className="mt-2 text-sm font-semibold tabular-nums text-text-primary">
                            {price}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop table rows */}
              <div className="hidden divide-y divide-border-white-10/30 lg:block">
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
                          'hover:border-l-accent/60 hover:bg-gray-500/10 hover:backdrop-blur-sm cursor-pointer',
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
                                  'inline-flex items-center justify-center rounded-md',
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
                                  'px-5 py-3.5 rounded-lg',
                                  'bg-white/5 border border-border-white-10/30',
                                  'hover:bg-gray-500/10 hover:backdrop-blur-sm cursor-pointer'
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
              </>
            )}
            {/* Tooltip - desktop only */}
            {hoveredAsset && tooltipPosition && (
              <div className="hidden lg:block">
                <BestPairTooltip asset={hoveredAsset} isVisible={true} position={tooltipPosition} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
