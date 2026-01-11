'use client';

/**
 * Position Row Component
 * Individual position row in the positions table
 */

import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className='border-b border-border-white-10/30 last:border-0 hover:bg-card/20 hover:backdrop-blur-sm transition-all rounded-lg mx-2 my-1'>
      <div className='px-4 md:px-6 py-3'>
        <div className='grid grid-cols-7 gap-4 items-center'>
          {/* ASSET */}
          <div className='flex items-center gap-2'>
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                position.asset.includes('BTC')
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600'
              )}>
              <span className='text-white text-xs font-bold'>
                {position.assetLogo}
              </span>
            </div>
            <div className='flex flex-col'>
              <span className='text-sm font-semibold text-text-primary'>
                {position.asset}
              </span>
              <span className='text-xs text-text-muted-60'>
                {position.leverage}
              </span>
            </div>
          </div>

          {/* LONG / SHORT */}
          <div className='flex flex-col gap-1'>
            <div className='flex items-center gap-1.5'>
              <ArrowUp className='h-3 w-3 text-[var(--chart-hyperliquid)]' />
              <span className='text-sm text-text-primary'>
                {position.long.platform}
              </span>
            </div>
            <div className='flex items-center gap-1.5'>
              <ArrowDown className='h-3 w-3 text-[var(--chart-pink)]' />
              <span className='text-sm text-text-primary'>
                {position.short.platform}
              </span>
            </div>
          </div>

          {/* SIZE */}
          <div>
            <span className='text-sm font-medium text-text-primary tabular-nums'>
              {position.size}
            </span>
          </div>

          {/* APR */}
          <div>
            <span className='text-sm font-medium text-green-400 tabular-nums'>
              {position.apr}
            </span>
          </div>

          {/* PRICE PNL */}
          <div>
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                isPricePnlPositive ? 'text-green-400' : 'text-red-400'
              )}>
              {position.pricePnl}
            </span>
          </div>

          {/* FUNDING PNL */}
          <div className='flex flex-col gap-0.5'>
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                isFundingPnlPositive ? 'text-green-400' : 'text-red-400'
              )}>
              {position.fundingPnl.current}
            </span>
            <span className='text-xs text-text-muted-60 tabular-nums'>
              {position.fundingPnl.estimated}
            </span>
          </div>

          {/* TOTAL PNL */}
          <div>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                isTotalPnlPositive ? 'text-green-400' : 'text-red-400'
              )}>
              {position.totalPnl}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
