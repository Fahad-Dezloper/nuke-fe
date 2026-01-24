'use client';

/**
 * Asset Dropdown Component
 * Reusable dropdown component for selecting assets with search functionality
 * Displays asset image, name, max leverage, funding rates, and APY data
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercentWithSign } from '@/lib/utils';
import type { AssetDropdownItem } from '@/types/positions';
import Image from 'next/image';

export interface AssetDropdownProps {
  assets: AssetDropdownItem[];
  selectedAsset?: AssetDropdownItem;
  onSelect?: (asset: AssetDropdownItem) => void;
  className?: string;
  placeholder?: string;
}

export function AssetDropdown({
  assets,
  selectedAsset,
  onSelect,
  className,
  placeholder = 'Select asset',
}: AssetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter assets based on search query
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets;
    const query = searchQuery.toLowerCase();
    return assets.filter(
      (asset) =>
        asset.asset.toLowerCase().includes(query) ||
        asset.asset.toLowerCase().startsWith(query)
    );
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
    onSelect?.(asset);
    setIsOpen(false);
    setSearchQuery('');
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
              src={selectedAsset.assetLogo}
              alt={selectedAsset.asset}
              width={20}
              height={20}
              className='shrink-0'
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
            'absolute top-full left-0 mt-1 z-[10000]',
            'w-[680px] max-h-[420px] overflow-hidden',
            'bg-background/80 backdrop-blur-md border border-border-white-10/50',
            'rounded-2xl shadow-2xl shadow-black/50',
            'ring-1 ring-white/5',
            'flex flex-col'
          )}>
          {/* Header with Legend */}
          <div className='flex items-center justify-between px-4 md:px-6 pt-4 pb-3 border-b border-border-white-10/50 bg-gradient-to-r from-card/60 via-card/50 to-card/60 backdrop-blur-md rounded-t-xl shadow-lg shadow-black/20'>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 rounded-full bg-green-500' />
              <span className='text-xs text-text-muted-60 uppercase tracking-wide font-medium'>
                FUNDING RATE ARBITRAGE
              </span>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-1.5'>
                <ArrowUp className='h-3 w-3 text-[var(--chart-hyperliquid)]' />
                <span className='text-[10px] text-text-muted-60 uppercase tracking-wide'>LONG</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <ArrowDown className='h-3 w-3 text-[var(--chart-pink)]' />
                <span className='text-[10px] text-text-muted-60 uppercase tracking-wide'>SHORT</span>
              </div>
              <span className='text-[10px] text-text-muted-60'>
                {filteredAssets.length}/{assets.length} pairs
              </span>
            </div>
          </div>

          {/* Search Input */}
          <div className='px-4 md:px-6 py-3 border-b border-border-white-10/50'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted-60 pointer-events-none' />
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search...'
                className={cn(
                  'w-full pl-9 pr-3 py-2 rounded-xl',
                  'bg-card/40 backdrop-blur-sm border border-border-white-10/50',
                  'text-text-primary text-xs placeholder:text-text-muted-40',
                  'shadow-md shadow-black/10',
                  'focus:outline-none focus:bg-card/60 focus:border-border-white-20',
                  'transition-all duration-200'
                )}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Table Header */}
          <div className='sticky top-0 z-10 px-4 md:px-6 py-3 border-b border-border-white-10/50 bg-gradient-to-r from-card/50 via-card/40 to-card/50 backdrop-blur-md shadow-lg shadow-black/20 shrink-0'>
            <div className='grid grid-cols-[160px_110px_110px_90px_90px] gap-4'>
              <span className='text-xs text-text-muted-60 uppercase tracking-wide font-medium'>
                ASSET
              </span>
              <span className='text-xs text-text-muted-60 uppercase tracking-wide font-medium'>
                HYPERLIQUID
              </span>
              <span className='text-xs text-text-muted-60 uppercase tracking-wide font-medium'>
                PACIFICA
              </span>
              <span className='text-xs text-text-muted-60 uppercase tracking-wide font-medium'>
                NET APY
              </span>
              <span className='text-xs text-text-muted-60 uppercase tracking-wide font-medium'>
                30D APY
              </span>
            </div>
          </div>

          {/* Assets List */}
          <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar'>
            {filteredAssets.length === 0 ? (
              <div className='flex items-center justify-center py-12'>
                <p className='text-text-muted-60 text-sm'>No assets found</p>
              </div>
            ) : (
              <div className='divide-y divide-border-white-10'>
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAsset?.asset === asset.asset;
                  const hyperliquidPositive = asset.hyperliquidFundingRate >= 0;
                  const pacificaPositive = asset.pacificaFundingRate >= 0;
                  return (
                    <button
                      key={asset.asset}
                      type='button'
                      onClick={() => handleSelect(asset)}
                      className={cn(
                        'w-full grid grid-cols-[160px_110px_110px_90px_90px] gap-4 px-4 md:px-6 py-2.5',
                        'text-left transition-all duration-200',
                        'border-l-2 border-l-transparent',
                        'hover:border-l-accent/50 hover:bg-card/20 hover:backdrop-blur-sm',
                        isSelected && 'bg-card/10'
                      )}>
                      {/* Asset */}
                      <div className='flex items-center gap-2'>
                        <Image
                          src={asset.assetLogo}
                          alt={asset.asset}
                          width={20}
                          height={20}
                          className='rounded-full shrink-0'
                        />
                        <div className='flex flex-col gap-0'>
                          <span className='text-xs font-semibold text-text-primary leading-tight'>
                            {asset.asset}
                          </span>
                          <span className='text-[10px] text-text-muted-60 leading-tight'>
                            Max {asset.maxLeverage}x
                          </span>
                        </div>
                      </div>

                      {/* Hyperliquid Funding Rate */}
                      <div className='flex items-center gap-1'>
                        {hyperliquidPositive ? (
                          <ArrowUp className='h-2.5 w-2.5 text-[var(--chart-hyperliquid)] shrink-0' />
                        ) : (
                          <ArrowDown className='h-2.5 w-2.5 text-[var(--chart-hyperliquid)] shrink-0' />
                        )}
                        <span className='text-xs font-medium text-[var(--chart-hyperliquid)] tabular-nums'>
                          {formatPercentWithSign(asset.hyperliquidFundingRate)}
                        </span>
                      </div>

                      {/* Pacifica Funding Rate */}
                      <div className='flex items-center gap-1'>
                        {pacificaPositive ? (
                          <ArrowUp className='h-2.5 w-2.5 text-[var(--chart-pink)] shrink-0' />
                        ) : (
                          <ArrowDown className='h-2.5 w-2.5 text-[var(--chart-pink)] shrink-0' />
                        )}
                        <span className='text-xs font-medium text-[var(--chart-pink)] tabular-nums'>
                          {formatPercentWithSign(asset.pacificaFundingRate)}
                        </span>
                      </div>

                      {/* NET APY */}
                      <span className='text-xs font-medium text-green-400 tabular-nums'>
                        {formatPercentWithSign(asset.netAPY)}
                      </span>

                      {/* 30D APY */}
                      <span className='text-xs font-medium text-green-400 tabular-nums'>
                        {formatPercentWithSign(asset.apy30D)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

