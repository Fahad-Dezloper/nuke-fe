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
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { formatPrice } from '@/lib/utils';

interface PositionDetailsSectionProps {
  className?: string;
}

export function PositionDetailsSection({
  className,
}: PositionDetailsSectionProps) {
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const [selectedPair] = useAtom(selectedArbitragePairAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);

  // Get price from selected asset (use hyperliquid mark price as primary)
  const price = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

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

      // Determine best pair based on funding rates
    // Long on lower funding rate, Short on higher funding rate
    const getBestPair = () => {
      if (!selectedAsset) {
        return { long: 'HYPERLIQUID', short: 'PACIFICA' };
      }
      
      const hyperliquidRate = selectedAsset.hyperliquidFundingRate;
      const pacificaRate = selectedAsset.pacificaFundingRate;
      const isHyperliquidLower = hyperliquidRate < pacificaRate;
      
      return {
        long: isHyperliquidLower ? 'HYPERLIQUID' : 'PACIFICA',
        short: isHyperliquidLower ? 'PACIFICA' : 'HYPERLIQUID',
      };
    };

    const bestPair = getBestPair();
    const longProtocolName = bestPair.long;
    const shortProtocolName = bestPair.short;

    return [
      {
        label: 'LONG',
        platform: longProtocolName,
        gradientColor: 'long' as const,
        margin: formatMargin(halfMargin),
        size: calculateSize(halfMargin),
      },
      {
        label: 'SHORT',
        platform: shortProtocolName,
        gradientColor: 'short' as const,
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
