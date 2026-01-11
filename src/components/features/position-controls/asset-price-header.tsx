'use client';

/**
 * Asset Price Header Component
 * Displays asset name, logo, and real-time price in a compact card style
 */

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';

interface AssetPriceHeaderProps {
  asset?: string;
  assetLogo?: string;
  currentPrice?: number;
  className?: string;
}

export function AssetPriceHeader({
  asset = 'BTC',
  assetLogo = '₿',
  currentPrice = 90875.0,
  className,
}: AssetPriceHeaderProps) {
  const [displayPrice, setDisplayPrice] = useState(currentPrice);
  const [priceKey, setPriceKey] = useState(0);
  const [priceChange, setPriceChange] = useState(-0.02);

  // Animate price changes in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate small price fluctuations
      const change = (Math.random() - 0.5) * 0.1;
      const newPrice = displayPrice + (displayPrice * change) / 100;
      setDisplayPrice(newPrice);
      setPriceChange(change);
      setPriceKey((k) => k + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, [displayPrice]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(price);
  };

  const priceFormatter = (val: number) => formatPrice(val);

  const formatChange = (change: number) => {
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  };

  const isPositive = priceChange >= 0;

  return (
    <div
      className={cn(
        'mx-4 mt-3 mb-4 px-4 py-3.5 relative',
        'bg-gradient-to-br from-card/60 via-card/40 to-card/30',
        'backdrop-blur-xl border border-border-white-10/50',
        'rounded-xl shadow-2xl shadow-black/40',
        'hover:border-border-white-30 hover:shadow-black/50',
        'hover:backdrop-blur-2xl hover:from-card/70 hover:via-card/50 hover:to-card/40',
        'transition-all duration-300',
        'overflow-hidden',
        className
      )}>
      {/* Glassmorphism overlay */}
      <div className='absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl' />

      {/* Content */}
      <div className='relative z-10 flex items-center justify-between'>
        {/* Asset Info */}
        <div className='flex items-center gap-3'>
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
              'shadow-md ring-2 ring-offset-2 ring-offset-background',
              asset.includes('BTC')
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 ring-orange-500/20'
                : asset.includes('ETH')
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 ring-blue-500/20'
                : 'bg-gradient-to-br from-purple-500 to-purple-600 ring-purple-500/20'
            )}>
            <span className='text-white text-sm font-bold'>{assetLogo}</span>
          </div>
          <div className='flex flex-col gap-0.5'>
            <span className='text-base font-bold text-text-primary leading-tight'>
              {asset} - PERP
            </span>
            {/* <span className='text-xs text-text-muted-60 uppercase tracking-wide'>
              {asset}USD
            </span> */}
          </div>
        </div>

        {/* Price and Change */}
        <div className='flex flex-col items-end gap-1'>
          <div className='flex items-center gap-2'>
            <AnimatedNumber
              value={displayPrice}
              formatter={priceFormatter}
              duration={300}
              className='text-base font-bold'
            />
          </div>
          <motion.div
            key={`change-${priceKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              'flex items-center gap-1 text-xs font-medium tabular-nums',
              isPositive ? 'text-green-400' : 'text-red-400'
            )}>
            {isPositive ? (
              <TrendingUp className='h-3 w-3' />
            ) : (
              <TrendingDown className='h-3 w-3' />
            )}
            <span>{formatChange(priceChange)}</span>
            <span className='text-text-muted-60'>(24H)</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
