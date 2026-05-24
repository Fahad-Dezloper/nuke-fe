'use client';

/**
 * Best Pair Tooltip Component
 * Shows detailed information about the best arbitrage pair on hover
 */

import { cn } from '@/lib/utils';
import type { AssetDropdownItem } from '@/types/positions';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useBestPair } from '@/hooks/use-best-pair';

interface BestPairTooltipProps {
  asset: AssetDropdownItem;
  isVisible: boolean;
  position?: { x: number; y: number };
}

const PROTOCOL_LABELS: Record<string, string> = {
  hyperliquid: 'HyperLiquid',
  pacifica: 'Pacifica',
  backpack: 'Backpack',
  lighter: 'Lighter',
};

export function BestPairTooltip({ asset, isVisible, position }: BestPairTooltipProps) {
  const { getBestPairForAsset } = useBestPair();

  if (!isVisible) return null;

  const bestPair = getBestPairForAsset(asset);
  const longProtocol = PROTOCOL_LABELS[bestPair.long] ?? bestPair.long;
  const shortProtocol = PROTOCOL_LABELS[bestPair.short] ?? bestPair.short;

  return (
    <div
      className={cn(
        'absolute z-10002 pointer-events-none',
        'bg-card border border-border-white-10',
        'rounded-sm shadow-2xl shadow-black/50',
        'px-4 py-3 min-w-[240px]',
        'animate-in fade-in-0 zoom-in-95 duration-200'
      )}
      style={{
        left: `${(position?.x ?? 0) - 80}px`,
        top: `${position?.y ?? 0}px`,
      }}
    >
      {/* Best Pair Info */}
      <div className="flex items-center gap-2 ">
        <div className="flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-[var(--chart-hyperliquid)]" />
          <span className="text-xs font-semibold text-text-primary">Long {longProtocol}</span>
        </div>
        <span className="text-text-muted-60">→</span>
        <div className="flex items-center gap-1.5">
          <ArrowDownRight className="h-3.5 w-3.5 text-[var(--chart-pink)]" />
          <span className="text-xs font-semibold text-text-primary">Short {shortProtocol}</span>
        </div>
      </div>
    </div>
  );
}
