'use client';

/**
 * Asset Dropdown Component
 * Professional dropdown component for selecting assets with search functionality
 * Displays asset image, name, max leverage, funding rates, and APR data
 *
 * Supports column sorting on Price, Net APR, and 7D APR.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
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
import { useAssetQueryParam } from '@/lib/hooks/use-asset-query-param';
import { BestPairTooltip } from './best-pair-tooltip';
import type { SpreadAprMap } from '@/lib/api/services/apr.service';
import Image from 'next/image';

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

/**
 * Extract the numeric value for a given sort column from an asset.
 * Returns 0 for missing / unparseable values so they sort to the bottom.
 */
function getSortValue(
  asset: AssetDropdownItem,
  column: SortColumn,
  spreadAprData: SpreadAprMap
): number {
  switch (column) {
    case 'price':
      return asset.markPx || asset.hyperliquidMarkPx || 0;
    case 'netApr':
      return asset.netAPR || 0;
    case '7dApr':
      return spreadAprData[asset.asset]?.sevenDayApr ?? -Infinity;
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
  spreadAprData: SpreadAprMap
): number {
  if (!sort.column) return 0;

  const valA = getSortValue(a, sort.column, spreadAprData);
  const valB = getSortValue(b, sort.column, spreadAprData);

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
}

export function AssetDropdown({
  selectedAsset: propSelectedAsset,
  onSelect,
  className,
  placeholder = 'Select asset',
}: AssetDropdownProps) {
  // Get assets from global store
  const assets = useAtomValue(marketFeedDataAtom);
  const globalSelectedAsset = useAtomValue(selectedAssetAtom);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  const selectedSymbol = useAtomValue(selectedAssetSymbolAtom);
  const { getBestPairForAsset, spreadAprData } = useBestPair();

  // URL query param sync
  const { updateUrlWithAsset } = useAssetQueryParam();

  // Use prop if provided, otherwise use global state
  const selectedAsset = propSelectedAsset || globalSelectedAsset;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);
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
    return [...filtered].sort((a, b) => compareAssets(a, b, sort, spreadAprData));
  }, [assets, searchQuery, sort, spreadAprData]);

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

  const handleSelect = (asset: AssetDropdownItem) => {
    // Update global state
    setSelectedAsset(asset);
    // Update URL query param
    updateUrlWithAsset(asset.asset);
    // Call prop callback if provided
    onSelect?.(asset);
    setIsOpen(false);
    setSearchQuery('');
    setHoveredAsset(null);
  };

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

  // Get protocol logo/icon component
  const ProtocolIcon = ({
    protocol,
    className,
  }: {
    protocol: 'hyperliquid' | 'pacifica';
    className?: string;
  }) => {
    if (protocol === 'hyperliquid') {
      return (
        <Image
          src="/tokens/hype.png"
          alt="Hyperliquid"
          width={20}
          height={20}
          className="rounded-full shrink-0"
        />
      );
    }
    return (
      <Image
        src="/tokens/pacifica.jpg"
        alt="Pacifica"
        width={20}
        height={20}
        className="rounded-full shrink-0"
      />
    );
  };

  return (
    <div ref={dropdownRef} className={cn('relative z-[10000]', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl',
          'bg-card/40 backdrop-blur-sm border border-border-white-10/50',
          'shadow-md shadow-black/10 transition-all',
          'cursor-pointer group hover:bg-card/60 hover:border-border-white-20',
          'min-w-[140px] relative z-[10001]'
        )}
      >
        {selectedAsset ? (
          <>
            <Image
              src={`https://app.hyperliquid.xyz/coins/${selectedAsset.asset.toUpperCase()}.svg`}
              alt={selectedAsset.asset}
              width={20}
              height={20}
              className="shrink-0 rounded-full"
            />
            <span className="font-semibold text-text-primary text-sm">{selectedAsset.asset}</span>
          </>
        ) : (
          <span className="text-text-muted-60 text-sm">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-text-muted-60 group-hover:text-text-primary transition-all ml-auto shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-2 z-[10002]',
            'w-auto min-w-[1200px] max-w-[1500px] min-h-[500px] max-h-[600px] overflow-hidden',
            'bg-background/95 backdrop-blur-xl border border-border-white-20/50',
            'rounded-2xl shadow-2xl shadow-black/60',
            'ring-1 ring-white/10',
            'flex flex-col'
          )}
        >
          {/* Header with Legend */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-white-10/50 bg-gradient-to-r from-card/70 via-card/60 to-card/70 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
              <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                FUNDING RATE ARBITRAGE
              </span>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <ArrowUp className="h-3.5 w-3.5 text-[var(--chart-hyperliquid)]" />
                <span className="text-[11px] text-text-muted-60 uppercase tracking-wide font-medium">
                  LONG
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowDown className="h-3.5 w-3.5 text-[var(--chart-pink)]" />
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
                  'w-full pl-10 pr-4 py-2.5 rounded-xl',
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

          {/* Table Header */}
          <div className="sticky top-0 z-[10001] px-5 py-3 border-b border-border-white-10/50 bg-gradient-to-r from-card/60 via-card/50 to-card/60 backdrop-blur-md shadow-lg shadow-black/20 shrink-0">
            <div className="grid grid-cols-[minmax(140px,auto)_minmax(140px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(90px,auto)_minmax(90px,auto)] gap-4">
              <span className="text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold">
                ASSET
              </span>
              <span className="text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold">
                BEST PAIR
              </span>
              <SortableHeader label="PRICE" column="price" sort={sort} onSort={handleSort} />
              <span className="text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold flex items-center gap-2">
                <Image
                  src="/tokens/hype.png"
                  alt="Hyperliquid"
                  width={20}
                  height={20}
                  className="rounded shrink-0"
                />
                HYPERLIQUID
              </span>
              <span className="text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold flex items-center gap-2">
                <Image
                  src="/tokens/pacifica.jpg"
                  alt="Pacifica"
                  width={20}
                  height={20}
                  className="rounded shrink-0"
                />
                PACIFICA
              </span>
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
                  const hyperliquidPositive = asset.hyperliquidFundingRate >= 0;
                  const pacificaPositive = asset.pacificaFundingRate >= 0;
                  const bestPair = getBestPairForAsset(asset);
                  const assetSpreadApr = spreadAprData[asset.asset];

                  return (
                    <div key={asset.asset} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSelect(asset)}
                        className={cn(
                          'w-full grid grid-cols-[minmax(140px,auto)_minmax(140px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(90px,auto)_minmax(90px,auto)] items-center gap-4 px-5 py-3.5',
                          'text-left transition-all duration-200',
                          'border-l-[3px] border-l-transparent',
                          'hover:border-l-accent/60 hover:bg-gray-500/10 hover:backdrop-blur-sm cursor-pointer',
                          isSelected && 'bg-card/20 border-l-accent/40',
                          'group'
                        )}
                      >
                        {/* Asset */}
                        <div className="flex items-center gap-2.5">
                          <Image
                            src={`https://app.hyperliquid.xyz/coins/${asset.asset.toUpperCase()}.svg`}
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
                              Max {asset.maxLeverage}x
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

                        {/* Hyperliquid Funding Rate */}
                        <div className="flex items-center gap-1.5">
                          {hyperliquidPositive ? (
                            <ArrowUp className="h-3 w-3 text-green-400 shrink-0" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-red-400 shrink-0" />
                          )}
                          <span
                            className={cn(
                              'text-sm  tabular-nums',
                              hyperliquidPositive ? 'text-green-400' : 'text-red-400'
                            )}
                          >
                            {formatPercentWithSign(asset.hyperliquidFundingRate)}
                          </span>
                        </div>

                        {/* Pacifica Funding Rate */}
                        <div className="flex items-center gap-1.5">
                          {pacificaPositive ? (
                            <ArrowUp className="h-3 w-3 text-green-400 shrink-0" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-red-400 shrink-0" />
                          )}
                          <span
                            className={cn(
                              'text-sm  tabular-nums',
                              pacificaPositive ? 'text-green-400' : 'text-red-400'
                            )}
                          >
                            {formatPercentWithSign(asset.pacificaFundingRate)}
                          </span>
                        </div>

                        {/* NET APR */}
                        <span className="text-sm  tabular-nums text-green-400">
                          {formatPercentWithSign(asset.netAPR)}
                        </span>

                        {/* 7D APR */}
                        <span className="text-sm  tabular-nums text-green-400">
                          {assetSpreadApr ? formatPercentWithSign(assetSpreadApr.sevenDayApr) : '—'}
                        </span>
                      </button>
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
