/**
 * Arbitrage Pair Selector Component
 * Allows users to select an arbitrage pair for execution
 */

'use client';

import { useAtom, useAtomValue } from 'jotai';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  selectedArbitragePairAtom,
  selectedAssetAtom,
} from './store';
import { arbitrageService } from '@/lib/arbitrage';
import type { ArbitragePair } from '@/lib/arbitrage';

interface ArbitragePairSelectorProps {
  className?: string;
}

export function ArbitragePairSelector({
  className,
}: ArbitragePairSelectorProps) {
  const [selectedAsset] = useAtom(selectedAssetAtom);
  const [selectedPair, setSelectedPair] = useAtom(selectedArbitragePairAtom);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get available pairs for the selected asset
  const availablePairs = useMemo(() => {
    const pairs = arbitrageService.getPairsForAsset(selectedAsset);
    return pairs.filter((pair) => pair.isActive);
  }, [selectedAsset]);

  // Auto-select first pair if none selected
  useEffect(() => {
    if (!selectedPair && availablePairs.length > 0) {
      setSelectedPair(availablePairs[0]);
    }
  }, [selectedPair, availablePairs, setSelectedPair]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (pair: ArbitragePair) => {
    setSelectedPair(pair);
    setIsOpen(false);
  };

  if (availablePairs.length === 0) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
          ARBITRAGE PAIR
        </label>
        <div className='text-sm text-text-muted-60 p-3 rounded-xl bg-card/40 border border-border-white-10/50'>
          No arbitrage pairs available for {selectedAsset}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
        ARBITRAGE PAIR
      </label>
      <div ref={dropdownRef} className='relative'>
        <button
          type='button'
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3',
            'bg-card/40 backdrop-blur-sm border border-border-white-10/50',
            'rounded-xl text-text-primary text-sm',
            'hover:bg-card/60 focus:outline-none focus:ring-2 focus:ring-accent/50',
            'transition-colors shadow-md shadow-black/10'
          )}>
          <span className='text-left'>
            {selectedPair ? (
              <div className='flex flex-col'>
                <span className='font-medium'>{selectedPair.name}</span>
                {selectedPair.description && (
                  <span className='text-xs text-text-muted-60'>
                    {selectedPair.description}
                  </span>
                )}
              </div>
            ) : (
              <span className='text-text-muted-60'>Select pair</span>
            )}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-text-muted-60 transition-transform',
              isOpen && 'transform rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div className='absolute z-50 w-full mt-2 bg-card/95 backdrop-blur-md border border-border-white-10/50 rounded-xl shadow-lg shadow-black/20 overflow-hidden'>
            <div className='max-h-60 overflow-y-auto'>
              {availablePairs.map((pair) => (
                <button
                  key={pair.id}
                  type='button'
                  onClick={() => handleSelect(pair)}
                  className={cn(
                    'w-full text-left px-4 py-3',
                    'hover:bg-card/80 transition-colors',
                    'border-b border-border-white-10/30 last:border-b-0',
                    selectedPair?.id === pair.id && 'bg-accent/10'
                  )}>
                  <div className='flex flex-col'>
                    <span className='font-medium text-text-primary'>
                      {pair.name}
                    </span>
                    {pair.description && (
                      <span className='text-xs text-text-muted-60 mt-0.5'>
                        {pair.description}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
