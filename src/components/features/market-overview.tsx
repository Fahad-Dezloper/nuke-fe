'use client';

/**
 * Market Overview Component
 * Displays asset name, current price, funding rates, and estimated APY
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface MarketOverviewProps {
  asset?: string;
  currentPrice?: number;
  longFundingRate?: number;
  shortFundingRate?: number;
  estimatedAPY?: number;
  className?: string;
}

export function MarketOverview({
  asset = 'BTC-PERP',
  currentPrice = 90612.3,
  longFundingRate = 10.95,
  shortFundingRate = 11.39,
  estimatedAPY = 0.44,
  className,
}: MarketOverviewProps) {
  const [displayPrice, setDisplayPrice] = useState(currentPrice);
  const [priceKey, setPriceKey] = useState(0);

  // Animate price changes
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate small price fluctuations
      const change = (Math.random() - 0.5) * 20;
      setDisplayPrice((prev) => {
        const newPrice = prev + change;
        setPriceKey((k) => k + 1);
        return newPrice;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn(
        'bg-gradient-to-r from-background via-background/98 to-background',
        'border-b-[0.5px] border-l-[0.5px] border-r-[0.5px] border-border-white-10',
        'relative overflow-hidden',
        className
      )}>
      {/* Subtle gradient overlay */}
      <div className='absolute inset-0 bg-gradient-to-r from-[var(--chart-hyperliquid)]/5 via-transparent to-[var(--chart-pink)]/5 pointer-events-none' />

      <div className='mx-auto px-3 md:px-4 lg:px-5 py-0 relative z-10'>
        <div className='flex flex-wrap items-center gap-6 md:gap-8'>
          {/* Asset Selector */}
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-2 px-3 py-1.5 rounded-md   transition-all cursor-pointer group'>
              <div className='w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm'>
                <span className='text-white text-xs font-bold'>₿</span>
              </div>
              <span className=' font-semibold text-text-primary'>{asset}</span>
              <ChevronDown className='h-3.5 w-3.5 text-text-muted-60 group-hover:text-text-primary transition-colors' />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className='flex flex-wrap items-center gap-6 md:gap-8 flex-1 '>
            {/* Current Price */}
            <MetricItem label='Current Price'>
              <AnimatePresence mode='wait'>
                <motion.span
                  key={priceKey}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.3 }}
                  className='text-base font-semibold text-text-primary tabular-nums'>
                  {formatPrice(displayPrice)}
                </motion.span>
              </AnimatePresence>
            </MetricItem>

            {/* Long Funding Rate */}
            <MetricItem label='LONG FUNDING RATE'>
              <div className='flex items-center gap-1.5'>
                <div className='p-1 rounded bg-[var(--chart-hyperliquid)]/20'>
                  <ArrowUp className='h-3 w-3 text-[var(--chart-hyperliquid)]' />
                </div>
                <span className='text-sm font-semibold text-[var(--chart-hyperliquid)] tabular-nums'>
                  {formatPercent(longFundingRate)}
                </span>
              </div>
            </MetricItem>

            {/* Short Funding Rate */}
            <MetricItem label='SHORT FUNDING RATE'>
              <div className='flex items-center gap-1.5'>
                <div className='p-1 rounded bg-[var(--chart-pink)]/20'>
                  <ArrowDown className='h-3 w-3 text-[var(--chart-pink)]' />
                </div>
                <span className='text-sm font-semibold text-[var(--chart-pink)] tabular-nums'>
                  {formatPercent(shortFundingRate)}
                </span>
              </div>
            </MetricItem>

            {/* Estimated APY */}
            <MetricItem label='EST. APY'>
              <div className='flex items-center gap-1.5'>
                <div className='px-2 py-0.5 rounded bg-green-900/30 '>
                  <span className='text-sm font-semibold text-green-400 tabular-nums'>
                    {formatPercent(estimatedAPY)}
                  </span>
                </div>
              </div>
            </MetricItem>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface MetricItemProps {
  label: string;
  children: React.ReactNode;
}

function MetricItem({ label, children }: MetricItemProps) {
  return (
    <div className='flex flex-col gap-1.5 border-l-[0.5px] border-l-border-white-10 pl-8 py-4 w-[180px] relative group'>
      {/* Subtle hover effect */}
      <div className='absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />

      <span className='text-xs text-text-muted-60 uppercase tracking-wide font-medium'>
        {label}
      </span>
      <div className='flex items-center'>{children}</div>
    </div>
  );
}
