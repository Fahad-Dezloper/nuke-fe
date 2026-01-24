'use client';

/**
 * Position Details Section Component
 * Cards showing LONG and SHORT position details
 * Calculates values based on user input (margin, leverage, price)
 */

import { useAtom, useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PositionDetailsCard } from '@/components/ui/position-details-card';
import {
  marginAtom,
  leverageAtom,
  selectedArbitragePairAtom,
} from './store';
import { mockAssetPrice } from '@/lib/mocks';
import { formatPrice } from '@/lib/utils';

interface PositionDetailsSectionProps {
  className?: string;
  currentPrice?: number; // Optional price override
}

export function PositionDetailsSection({
  className,
  currentPrice,
}: PositionDetailsSectionProps) {
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const [selectedPair] = useAtom(selectedArbitragePairAtom);

  // Use provided price or fall back to mock price
  const price = currentPrice ?? mockAssetPrice.currentPrice;

  // Calculate position details
  const positionDetails = useMemo(() => {
    const marginValue = parseFloat(margin) || 0;
    const halfMargin = marginValue / 2;

    // Calculate size: (margin * leverage) / price
    // Size represents the amount of asset units
    const calculateSize = (marginAmount: number): string => {
      if (!marginAmount || !price || price <= 0) {
        return '-';
      }
      const usdSize = marginAmount * leverage;
      const assetSize = usdSize / price;
      // Format with appropriate decimals based on asset size
      if (assetSize >= 1) {
        return assetSize.toFixed(4);
      } else if (assetSize >= 0.01) {
        return assetSize.toFixed(6);
      } else {
        return assetSize.toFixed(8);
      }
    };

    // Format margin as currency
    const formatMargin = (amount: number): string => {
      if (amount === 0) {
        return '$0.00';
      }
      return formatPrice(amount, 'USD', 'en-US', 2, 2);
    };

    // Determine protocol names based on selected pair
    // Default to HyperLiquid for LONG and Pacifica for SHORT if no pair selected
    const longProtocol = selectedPair?.longProtocol === 'hyperliquid' 
      ? 'HYPERLIQUID' 
      : selectedPair?.longProtocol === 'pacifica'
      ? 'PACIFICA'
      : 'HYPERLIQUID'; // Default
    const shortProtocol = selectedPair?.shortProtocol === 'hyperliquid'
      ? 'HYPERLIQUID'
      : selectedPair?.shortProtocol === 'pacifica'
      ? 'PACIFICA'
      : 'PACIFICA'; // Default

    return [
      {
        label: 'LONG',
        platform: longProtocol,
        gradientColor: (selectedPair?.longProtocol === 'hyperliquid' 
          ? 'hyperliquid' 
          : 'pacifica') as 'hyperliquid' | 'pacifica',
        margin: formatMargin(halfMargin),
        size: calculateSize(halfMargin),
      },
      {
        label: 'SHORT',
        platform: shortProtocol,
        gradientColor: (selectedPair?.shortProtocol === 'hyperliquid'
          ? 'hyperliquid'
          : 'pacifica') as 'hyperliquid' | 'pacifica',
        margin: formatMargin(halfMargin),
        size: calculateSize(halfMargin),
      },
    ];
  }, [margin, leverage, price, selectedPair]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
        POSITION DETAILS
      </label>
      <div className='grid grid-cols-2 gap-3'>
        {positionDetails.map((card) => (
          <PositionDetailsCard
            key={card.label}
            {...card}
          />
        ))}
      </div>
    </div>
  );
}
