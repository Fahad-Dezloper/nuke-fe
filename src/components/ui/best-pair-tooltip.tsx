'use client';

/**
 * Best Pair Tooltip Component
 * Shows detailed information about the best arbitrage pair on hover
 */

import { cn } from '@/lib/utils';
import type { AssetDropdownItem } from '@/types/positions';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface BestPairTooltipProps {
  asset: AssetDropdownItem;
  isVisible: boolean;
  position?: { x: number; y: number };
}

export function BestPairTooltip({
  asset,
  isVisible,
  position,
}: BestPairTooltipProps) {
  if (!isVisible) return null;

  // Determine best pair based on funding rates
  // Long on lower funding rate, Short on higher funding rate
  const hyperliquidRate = asset.hyperliquidFundingRate;
  const pacificaRate = asset.pacificaFundingRate;
  const isHyperliquidLower = hyperliquidRate < pacificaRate;
  
  const longProtocol = isHyperliquidLower ? 'HyperLiquid' : 'Pacifica';
  const shortProtocol = isHyperliquidLower ? 'Pacifica' : 'HyperLiquid';

  return (
    <div
      className={cn(
        'absolute z-10002 pointer-events-none',
        'bg-card/60 backdrop-blur-md border border-border-white-20/50',
        'rounded-xl shadow-2xl shadow-black/50',
        'px-4 py-3 min-w-[240px]',
        'animate-in fade-in-0 zoom-in-95 duration-200'
      )}
      style={{
        left: `${(position?.x ?? 0) - 80}px`,
        top: `${(position?.y ?? 0)}px`,
      }}>
      {/* Best Pair Info */}
      <div className='flex items-center gap-2 '>
        <div className='flex items-center gap-1.5'>
          <ArrowUpRight className='h-3.5 w-3.5 text-[var(--chart-hyperliquid)]' />
          <span className='text-xs font-semibold text-text-primary'>
            Long {longProtocol}
          </span>
        </div>
        <span className='text-text-muted-60'>→</span>
        <div className='flex items-center gap-1.5'>
          <ArrowDownRight className='h-3.5 w-3.5 text-[var(--chart-pink)]' />
          <span className='text-xs font-semibold text-text-primary'>
            Short {shortProtocol}
          </span>
        </div>
      </div>

    </div>
  );
}
