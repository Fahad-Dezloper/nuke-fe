'use client';

/**
 * Market Overview Component
 * Displays asset name, current price, funding rates, and estimated APY
 */

import { motion } from 'framer-motion';
import { ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { MetricItem } from '@/components/ui/metric-item';
import { formatPrice, formatPercentWithSign } from '@/lib/utils';
import { mockMarketOverview } from '@/lib/mocks';
import type { MarketOverviewData } from '@/types/positions';
import Image from 'next/image';

interface MarketOverviewProps {
  data?: MarketOverviewData;
  className?: string;
}

export function MarketOverview({
  data = mockMarketOverview,
  className,
}: MarketOverviewProps) {
  const { asset, currentPrice, longFundingRate, shortFundingRate, estimatedAPY } = data;
  const [displayPrice, setDisplayPrice] = useState(currentPrice);

  // Animate price changes
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate small price fluctuations
      const change = (Math.random() - 0.5) * 2;
      setDisplayPrice((prev) => prev + change);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const priceFormatter = (val: number) => formatPrice(val, 'USD', 'en-US', 4, 4);

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
            <div className='flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card/40 backdrop-blur-sm border border-border-white-10/50 shadow-md shadow-black/10 transition-all cursor-pointer group hover:bg-card/60 hover:border-border-white-20'>
              <Image
                src={'/tokens/hype.png'}
                alt='HYPE'
                width={20}
                height={20}
              />
              <span className=' font-semibold text-text-primary'>{asset}</span>
              <ChevronDown className='h-3.5 w-3.5 text-text-muted-60 group-hover:text-text-primary transition-colors' />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className='flex flex-wrap items-center gap-6 md:gap-8 flex-1 '>
            {/* Current Price */}
            <MetricItem label='Current Price'>
              <AnimatedNumber
                value={displayPrice}
                formatter={priceFormatter}
                duration={300}
                className='text-base font-semibold'
              />
            </MetricItem>

            {/* Long Funding Rate */}
            <MetricItem label='LONG FUNDING RATE'>
              <div className='flex items-center gap-1.5'>
                <div className='p-1 rounded bg-[var(--chart-hyperliquid)]/20'>
                  <ArrowUp className='h-3 w-3 text-[var(--chart-hyperliquid)]' />
                </div>
                <span className='text-sm font-semibold text-[var(--chart-hyperliquid)] tabular-nums'>
                  {formatPercentWithSign(longFundingRate)}
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
                  {formatPercentWithSign(shortFundingRate)}
                </span>
              </div>
            </MetricItem>

            {/* Estimated APY */}
            <MetricItem label='EST. APY'>
              <div className='flex items-center gap-1.5'>
                <div className='px-2 py-0.5 rounded-lg bg-green-900/30 backdrop-blur-sm border border-green-500/20 shadow-sm'>
                  <span className='text-sm font-semibold text-green-400 tabular-nums'>
                    {formatPercentWithSign(estimatedAPY)}
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
