'use client';

/**
 * Position Row Component
 * Individual position row in the positions table
 */

import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface PositionData {
  asset: string;
  leverage: string;
  assetLogo: string;
  long: {
    platform: string;
  };
  short: {
    platform: string;
  };
  size: string;
  apr: string;
  pricePnl: string;
  fundingPnl: {
    current: string;
    estimated: string;
  };
  totalPnl: string;
}

interface PositionRowProps {
  position: PositionData;
  onClose?: (asset: string) => void;
}

export function PositionRow({ position, onClose }: PositionRowProps) {
  const isTotalPnlPositive =
    position.totalPnl.startsWith('+') ||
    parseFloat(position.totalPnl.replace(/[^0-9.-]/g, '')) > 0;
  const isPricePnlPositive =
    position.pricePnl.startsWith('+') ||
    parseFloat(position.pricePnl.replace(/[^0-9.-]/g, '')) > 0;
  const isFundingPnlPositive =
    position.fundingPnl.current.startsWith('+') ||
    parseFloat(position.fundingPnl.current.replace(/[^0-9.-]/g, '')) > 0;

  return (
    <div className='border-b border-border-white-10/30 last:border-0 border-l-2 border-l-transparent hover:border-l-accent/50 hover:bg-card/20 hover:backdrop-blur-sm transition-all duration-200 group'>
      <div className='px-4 md:px-6 py-2.5'>
        <div className='grid grid-cols-[120px_200px_80px_80px_100px_120px_100px_40px] gap-4 items-center'>
          {/* ASSET */}
          <div className='flex items-center gap-2'>
            <Image
              src={position.assetLogo}
              alt={position.asset}
              width={20}
              height={20}
            />
            <div className='flex flex-col gap-0'>
              <span className='text-xs font-semibold text-text-primary leading-tight'>
                {position.asset}
              </span>
              <span className='text-[10px] text-text-muted-60 leading-tight'>
                {position.leverage}
              </span>
            </div>
          </div>

          {/* LONG / SHORT */}
          <div className='flex flex-col gap-1 w-full'>
            {/* LONG */}
            <div className='flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--chart-hyperliquid)]/10 border border-[var(--chart-hyperliquid)]/20 hover:bg-[var(--chart-hyperliquid)]/15 hover:border-[var(--chart-hyperliquid)]/30 transition-all duration-200 w-fit'>
              <ArrowUp className='h-2.5 w-2.5 text-[var(--chart-hyperliquid)] shrink-0' />
              <span className='text-[10px] font-medium text-text-primary whitespace-nowrap'>
                {position.long.platform}
              </span>
            </div>
            {/* SHORT */}
            <div className='flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--chart-pink)]/10 border border-[var(--chart-pink)]/20 hover:bg-[var(--chart-pink)]/15 hover:border-[var(--chart-pink)]/30 transition-all duration-200 w-fit'>
              <ArrowDown className='h-2.5 w-2.5 text-[var(--chart-pink)] shrink-0' />
              <span className='text-[10px] font-medium text-text-primary whitespace-nowrap'>
                {position.short.platform}
              </span>
            </div>
          </div>

          {/* SIZE */}
          <div>
            <span className='text-xs font-medium text-text-primary tabular-nums'>
              {position.size}
            </span>
          </div>

          {/* APR */}
          <div>
            <span className='text-xs font-medium text-green-400 tabular-nums'>
              {position.apr}
            </span>
          </div>

          {/* PRICE PNL */}
          <div>
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                isPricePnlPositive ? 'text-green-400' : 'text-red-400'
              )}>
              {position.pricePnl}
            </span>
          </div>

          {/* FUNDING PNL */}
          <div className='flex flex-col gap-0'>
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                isFundingPnlPositive ? 'text-green-400' : 'text-red-400'
              )}>
              {position.fundingPnl.current}
            </span>
            <span className='text-[10px] text-text-muted-60 tabular-nums leading-tight'>
              {position.fundingPnl.estimated}
            </span>
          </div>

          {/* TOTAL PNL */}
          <div>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                isTotalPnlPositive ? 'text-green-400' : 'text-red-400'
              )}>
              {position.totalPnl}
            </span>
          </div>

          {/* CLOSE BUTTON */}
          <div className='flex items-center justify-end'>
            <button
              onClick={() =>
                onClose?.(`${position.asset}-${position.leverage}`)
              }
              className='p-1 rounded-md text-text-muted-60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200'>
              <X className='h-3.5 w-3.5' />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
