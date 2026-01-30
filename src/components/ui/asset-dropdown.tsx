'use client';

/**
 * Asset Dropdown Component
 * Professional dropdown component for selecting assets with search functionality
 * Displays asset image, name, max leverage, funding rates, and APR data
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronDown, Search, ArrowUp, ArrowDown, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercentWithSign, formatPrice } from '@/lib/utils';
import type { AssetDropdownItem } from '@/types/positions';
import { marketFeedDataAtom, selectedAssetAtom, selectedAssetSymbolAtom } from '@/lib/stores/market-feed.store';
import { BestPairTooltip } from './best-pair-tooltip';
import Image from 'next/image';

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
  
  // Use prop if provided, otherwise use global state
  const selectedAsset = propSelectedAsset || globalSelectedAsset;
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hoveredAsset, setHoveredAsset] = useState<AssetDropdownItem | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Sort and filter assets
  const sortedAndFilteredAssets = useMemo(() => {
    let filtered = assets;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = assets.filter(
        (asset) =>
          asset.asset.toLowerCase().includes(query) ||
          asset.asset.toLowerCase().startsWith(query)
      );
    }

    // Sort by mark price (descending - highest first)
    return [...filtered].sort((a, b) => {
      const priceA = a.markPx || a.hyperliquidMarkPx || 0;
      const priceB = b.markPx || b.hyperliquidMarkPx || 0;
      return priceB - priceA;
    });
  }, [assets, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
    // Call prop callback if provided
    onSelect?.(asset);
    setIsOpen(false);
    setSearchQuery('');
    setHoveredAsset(null);
  };

  // Auto-select first asset if none selected and assets are available
  useEffect(() => {
    if (!selectedSymbol && assets.length > 0) {
      setSelectedAsset(assets[0]);
    }
  }, [selectedSymbol, assets, setSelectedAsset]);
  
  // Note: The selectedAssetAtom is a derived atom that automatically
  // syncs with the latest market feed data, so no need to manually update it here

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
  const ProtocolIcon = ({ protocol, className }: { protocol: 'hyperliquid' | 'pacifica'; className?: string }) => {
    if (protocol === 'hyperliquid') {
      return (
        <Image
          src='/tokens/hype.png'
          alt='Hyperliquid'
          width={20}
          height={20}
          className='rounded-full shrink-0'
        />
      );
    }
    return (
      <Image
        src='/tokens/pacifica.jpg'
        alt='Pacifica'
        width={20}
        height={20}
        className='rounded-full shrink-0'
      />
    );
  };

  // Determine best pair for an asset
  // Logic: Long on lower funding rate, Short on higher funding rate
  const getBestPair = (asset: AssetDropdownItem) => {
    const hyperliquidRate = asset.hyperliquidFundingRate;
    const pacificaRate = asset.pacificaFundingRate;
    
    // Long on the platform with lower funding rate
    // Short on the platform with higher funding rate
    const longProtocol = hyperliquidRate < pacificaRate ? 'hyperliquid' as const : 'pacifica' as const;
    const shortProtocol = hyperliquidRate < pacificaRate ? 'pacifica' as const : 'hyperliquid' as const;
    
    return {
      long: longProtocol,
      short: shortProtocol,
    };
  };

  return (
    <div ref={dropdownRef} className={cn('relative z-[10000]', className)}>
      {/* Trigger Button */}
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl',
          'bg-card/40 backdrop-blur-sm border border-border-white-10/50',
          'shadow-md shadow-black/10 transition-all',
          'cursor-pointer group hover:bg-card/60 hover:border-border-white-20',
          'min-w-[140px] relative z-[10001]'
        )}>
        {selectedAsset ? (
          <>
            <Image
              src={`https://app.hyperliquid.xyz/coins/${selectedAsset.asset.toUpperCase()}.svg`}
              alt={selectedAsset.asset}
              width={20}
              height={20}
              className='shrink-0 rounded-full'
            />
            <span className='font-semibold text-text-primary text-sm'>
              {selectedAsset.asset}
            </span>
          </>
        ) : (
          <span className='text-text-muted-60 text-sm'>{placeholder}</span>
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
            'w-auto min-w-[900px] max-w-[1200px] max-h-[500px] overflow-hidden',
            'bg-background/95 backdrop-blur-xl border border-border-white-20/50',
            'rounded-2xl shadow-2xl shadow-black/60',
            'ring-1 ring-white/10',
            'flex flex-col'
          )}>
          {/* Header with Legend */}
          <div className='flex items-center justify-between px-5 py-3.5 border-b border-border-white-10/50 bg-gradient-to-r from-card/70 via-card/60 to-card/70 backdrop-blur-md'>
            <div className='flex items-center gap-2.5'>
              <div className='h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50' />
              <span className='text-xs font-semibold text-text-primary uppercase tracking-wider'>
                FUNDING RATE ARBITRAGE
              </span>
            </div>
            <div className='flex items-center gap-5'>
              <div className='flex items-center gap-1.5'>
                <ArrowUp className='h-3.5 w-3.5 text-[var(--chart-hyperliquid)]' />
                <span className='text-[11px] text-text-muted-60 uppercase tracking-wide font-medium'>LONG</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <ArrowDown className='h-3.5 w-3.5 text-[var(--chart-pink)]' />
                <span className='text-[11px] text-text-muted-60 uppercase tracking-wide font-medium'>SHORT</span>
              </div>
              <span className='text-[11px] text-text-muted-60 font-medium'>
                {sortedAndFilteredAssets.length}/{assets.length} pairs
              </span>
            </div>
          </div>

          {/* Search Input */}
          <div className='px-5 py-3 border-b border-border-white-10/50 bg-card/30'>
            <div className='relative'>
              <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted-60 pointer-events-none' />
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search asset...'
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
          <div className='sticky top-0 z-[10001] px-5 py-3 border-b border-border-white-10/50 bg-gradient-to-r from-card/60 via-card/50 to-card/60 backdrop-blur-md shadow-lg shadow-black/20 shrink-0'>
            <div className='grid grid-cols-[minmax(140px,auto)_minmax(140px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(90px,auto)_minmax(90px,auto)] gap-4'>
              <span className='text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold'>
                ASSET
              </span>
              <span className='text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold'>
                BEST PAIR
              </span>
              <span className='text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold'>
                PRICE
              </span>
              <span className='text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold'>
                HYPERLIQUID
              </span>
              <span className='text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold'>
                PACIFICA
              </span>
              <span className='text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold'>
                NET APR
              </span>
              <span className='text-[11px] text-text-muted-60 uppercase tracking-wider font-semibold'>
                30D APR
              </span>
            </div>
          </div>

          {/* Assets List */}
          <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar relative'>
            {sortedAndFilteredAssets.length === 0 ? (
              <div className='flex items-center justify-center py-16'>
                <p className='text-text-muted-60 text-sm font-medium'>No assets found</p>
              </div>
            ) : (
              <div className='divide-y divide-border-white-10/30'>
                {sortedAndFilteredAssets.map((asset) => {
                  const isSelected = selectedAsset?.asset === asset.asset;
                    const hyperliquidPositive = asset.hyperliquidFundingRate >= 0;
                    const pacificaPositive = asset.pacificaFundingRate >= 0;
                    // Net APR and 30D APR are always positive (higher rate - lower rate)
                  const bestPair = getBestPair(asset);

                  return (
                    <div key={asset.asset} className='relative'>
                      <button
                        type='button'
                        onClick={() => handleSelect(asset)}
                        className={cn(
                          'w-full grid grid-cols-[minmax(140px,auto)_minmax(140px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(100px,auto)_minmax(90px,auto)_minmax(90px,auto)] gap-4 px-5 py-3.5',
                          'text-left transition-all duration-200',
                          'border-l-[3px] border-l-transparent',
                          'hover:border-l-accent/60 hover:bg-card/30 hover:backdrop-blur-sm',
                          isSelected && 'bg-card/20 border-l-accent/40',
                          'group'
                        )}>
                        {/* Asset */}
                        <div className='flex items-center gap-2.5'>
                          <Image
                            src={`https://app.hyperliquid.xyz/coins/${asset.asset.toUpperCase()}.svg`}
                            alt={asset.asset}
                            width={24}
                            height={24}
                            className='rounded-full shrink-0 ring-1 ring-border-white-10/50'
                          />
                          <div className='flex flex-col gap-0.5'>
                            <span className='text-sm font-semibold text-text-primary leading-tight'>
                              {asset.asset}
                            </span>
                            <span className='text-[11px] text-text-muted-60 leading-tight font-medium'>
                              Max {asset.maxLeverage}x
                            </span>
                          </div>
                        </div>

                        {/* Best Pair */}
                        <div className='relative'>
                          <div
                            ref={tooltipRef}
                            className='flex items-center gap-2 cursor-pointer'
                            onMouseEnter={(e) => handleBestPairMouseEnter(e, asset)}
                            onMouseLeave={handleBestPairMouseLeave}>
                            <div className='flex items-center gap-1.5'>
                              <ProtocolIcon protocol={bestPair.long} />
                              <ArrowUpRight className='h-3 w-3 text-text-muted-40' />
                              <ProtocolIcon protocol={bestPair.short} />
                            </div>
                          </div>
                        </div>

                        {/* Price */}
                        <div className='flex items-center'>
                          <span className='text-sm font-semibold text-text-primary tabular-nums'>
                            {formatPrice(asset.markPx || asset.hyperliquidMarkPx || 0, 'USD', 'en-US', 2, 4)}
                          </span>
                        </div>

                        {/* Hyperliquid Funding Rate */}
                        <div className='flex items-center gap-1.5'>
                          {hyperliquidPositive ? (
                            <ArrowUp className='h-3 w-3 text-green-400 shrink-0' />
                          ) : (
                            <ArrowDown className='h-3 w-3 text-red-400 shrink-0' />
                          )}
                          <span
                            className={cn(
                              'text-sm font-semibold tabular-nums',
                              hyperliquidPositive ? 'text-green-400' : 'text-red-400'
                            )}>
                            {formatPercentWithSign(asset.hyperliquidFundingRate)}
                          </span>
                        </div>

                        {/* Pacifica Funding Rate */}
                        <div className='flex items-center gap-1.5'>
                          {pacificaPositive ? (
                            <ArrowUp className='h-3 w-3 text-green-400 shrink-0' />
                          ) : (
                            <ArrowDown className='h-3 w-3 text-red-400 shrink-0' />
                          )}
                          <span
                            className={cn(
                              'text-sm font-semibold tabular-nums',
                              pacificaPositive ? 'text-green-400' : 'text-red-400'
                            )}>
                            {formatPercentWithSign(asset.pacificaFundingRate)}
                          </span>
                        </div>

                        {/* NET APR */}
                        <span className='text-sm font-semibold tabular-nums text-green-400'>
                          {formatPercentWithSign(asset.netAPR)}
                        </span>

                        {/* 30D APR */}
                        <span className='text-sm font-semibold tabular-nums text-green-400'>
                          {formatPercentWithSign(asset.apr30D)}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Tooltip - rendered at dropdown level for proper positioning */}
            {hoveredAsset && tooltipPosition && (
              <BestPairTooltip
                asset={hoveredAsset}
                isVisible={true}
                position={tooltipPosition}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
