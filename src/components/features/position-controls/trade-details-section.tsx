'use client';

/**
 * Trade Details Section Component
 * Displays trade information like fees, position size, margin, liquidation price, etc.
 * Collapsible dropdown with basic info shown by default
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TradeDetailRow } from '@/components/ui/trade-detail-row';
import { mockTradeDetails } from '@/lib/mocks';
import type { TradeDetails } from '@/types/positions';

interface TradeDetailsSectionProps {
  className?: string;
  tradeData?: TradeDetails;
}

export function TradeDetailsSection({
  className,
  tradeData = mockTradeDetails,
}: TradeDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

