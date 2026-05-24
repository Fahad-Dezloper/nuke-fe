'use client';

import { useAtom, useAtomValue } from 'jotai';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { selectedArbitragePairAtom, selectedAssetAtom } from './store';
import { arbitrageService } from '@/lib/arbitrage';
import type { ArbitragePair } from '@/lib/arbitrage';

interface ArbitragePairSelectorProps {
  className?: string;
}

export function ArbitragePairSelector({ className }: ArbitragePairSelectorProps) {
  const [selectedAsset] = useAtom(selectedAssetAtom);
  const [selectedPair, setSelectedPair] = useAtom(selectedArbitragePairAtom);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availablePairs = useMemo(() => {
    return arbitrageService.getPairsForAsset(selectedAsset).filter((p) => p.isActive);
  }, [selectedAsset]);

  useEffect(() => {
    if (!selectedPair && availablePairs.length > 0) setSelectedPair(availablePairs[0]);
  }, [selectedPair, availablePairs, setSelectedPair]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (availablePairs.length === 0) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <label className="text-[10px] text-text-muted-40 uppercase tracking-wider">Arbitrage Pair</label>
        <div className="text-xs text-text-muted-60 p-3 rounded-sm bg-card border border-border-white-10">
          No pairs available for {selectedAsset}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-[10px] text-text-muted-40 uppercase tracking-wider">Arbitrage Pair</label>
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 h-10 bg-background border border-border-white-10 rounded-sm text-sm text-text-primary hover:border-border-white-20 focus:outline-none transition-colors"
        >
          <span className="text-left">
            {selectedPair ? (
              <div className="flex flex-col">
                <span className="font-medium text-xs">{selectedPair.name}</span>
                {selectedPair.description && (
                  <span className="text-[10px] text-text-muted-40">{selectedPair.description}</span>
                )}
              </div>
            ) : (
              <span className="text-text-muted-40 text-xs">Select pair</span>
            )}
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 text-text-muted-40 transition-transform shrink-0', isOpen && 'rotate-180')}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border-white-10 rounded-sm shadow-xl overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {availablePairs.map((pair) => (
                <button
                  key={pair.id}
                  type="button"
                  onClick={() => { setSelectedPair(pair); setIsOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 text-xs hover:bg-card transition-colors border-b border-border-white-10 last:border-b-0',
                    selectedPair?.id === pair.id && 'bg-green/5 text-green'
                  )}
                >
                  <span className="font-medium text-text-primary">{pair.name}</span>
                  {pair.description && (
                    <div className="text-[10px] text-text-muted-40 mt-0.5">{pair.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
