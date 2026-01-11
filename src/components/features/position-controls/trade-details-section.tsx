'use client';

/**
 * Trade Details Section Component
 * Displays trade information like fees, position size, margin, liquidation price, etc.
 * Collapsible dropdown with basic info shown by default
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradeDetailsSectionProps {
  className?: string;
}

interface TradeDetailRowProps {
  label: string;
  value: string | React.ReactNode;
  valueColor?: 'default' | 'green' | 'red' | 'muted';
}

function TradeDetailRow({
  label,
  value,
  valueColor = 'default',
}: TradeDetailRowProps) {
  const valueClass = {
    default: 'text-text-primary',
    green: 'text-green-400',
    red: 'text-red-400',
    muted: 'text-text-muted-40',
  }[valueColor];

  return (
    <div className='flex items-center justify-between py-1.5'>
      <span className='text-xs text-text-muted-60'>{label}</span>
      <span
        className={cn('text-xs font-medium tabular-nums', valueClass)}>
        {value}
      </span>
    </div>
  );
}

export function TradeDetailsSection({
  className,
}: TradeDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Mock trade data - in real app, this would come from props or state
  const tradeData = {
    positionSize: '$10,000.00',
    margin: '$3,333.33',
    estimatedFees: '$2.50',
    liquidationPrice: {
      long: '$85,234.56',
      short: '$95,678.90',
    },
    entryPrice: {
      long: '$90,612.30',
      short: '$90,612.30',
    },
    fundingRate: {
      long: '+0.1095%',
      short: '+0.1139%',
    },
    estimatedAPR: '+257.1%',
    maxDrawdown: '-5.2%',
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className='text-xs text-text-muted-60 uppercase tracking-wide'>
        TRADE DETAILS
      </label>
      <div className='bg-gradient-to-br from-card/60 via-card/40 to-card/30 border border-border-white-10/50 rounded-xl overflow-hidden backdrop-blur-md shadow-lg shadow-black/20'>
        {/* Basic Info - Always Visible */}
        <div className='px-3 py-2.5 space-y-0'>
          <TradeDetailRow
            label='Position Size'
            value={tradeData.positionSize}
          />
          <TradeDetailRow label='Margin' value={tradeData.margin} />
        </div>

        {/* Expandable Section */}
        {isExpanded && (
          <div className='px-3 pb-2 space-y-0 border-t border-border-white-5'>
            <div className='pt-2 space-y-0'>
              <TradeDetailRow
                label='Est. Fees'
                value={tradeData.estimatedFees}
                valueColor='muted'
              />
              <TradeDetailRow
                label='Entry (Long)'
                value={tradeData.entryPrice.long}
              />
              <TradeDetailRow
                label='Entry (Short)'
                value={tradeData.entryPrice.short}
              />
              <TradeDetailRow
                label='Liq. (Long)'
                value={tradeData.liquidationPrice.long}
                valueColor='red'
              />
              <TradeDetailRow
                label='Liq. (Short)'
                value={tradeData.liquidationPrice.short}
                valueColor='red'
              />
              <TradeDetailRow
                label='Funding (Long)'
                value={tradeData.fundingRate.long}
                valueColor='green'
              />
              <TradeDetailRow
                label='Funding (Short)'
                value={tradeData.fundingRate.short}
                valueColor='green'
              />
              <TradeDetailRow
                label='Est. APR'
                value={tradeData.estimatedAPR}
                valueColor='green'
              />
              <TradeDetailRow
                label='Max Drawdown'
                value={tradeData.maxDrawdown}
                valueColor='red'
              />
            </div>
          </div>
        )}

        {/* View More / View Less Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className='w-full flex items-center justify-center gap-1.5 py-2 border-t border-border-white-10 text-xs text-text-muted-60 hover:text-text-primary transition-colors'>
          {isExpanded ? (
            <>
              <span>View Less</span>
              <ChevronUp className='h-3 w-3' />
            </>
          ) : (
            <>
              <span>View More</span>
              <ChevronDown className='h-3 w-3' />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

