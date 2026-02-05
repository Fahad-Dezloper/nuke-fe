'use client';

/**
 * Trade Details Section Component
 * Displays trade information like fees, position size, margin, liquidation price, etc.
 * Collapsible dropdown with basic info shown by default
 */

import { useState, useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TradeDetailRow } from '@/components/ui/trade-detail-row';
import { marginAtom, leverageAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { formatPrice, formatPercentWithSign } from '@/lib/utils';

interface TradeDetailsSectionProps {
  className?: string;
}

export function TradeDetailsSection({ className }: TradeDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);

  // Calculate trade details from selected asset, margin, and leverage
  const tradeDetails = useMemo(() => {
    const marginValue = parseFloat(margin) || 0;
    const price = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

    // Determine best pair
    const getBestPair = () => {
      if (!selectedAsset) {
        return { long: 'hyperliquid', short: 'pacifica' };
      }
      const hyperliquidRate = selectedAsset.hyperliquidFundingRate;
      const pacificaRate = selectedAsset.pacificaFundingRate;
      const isHyperliquidLower = hyperliquidRate < pacificaRate;
      return {
        long: isHyperliquidLower ? 'hyperliquid' : 'pacifica',
        short: isHyperliquidLower ? 'pacifica' : 'hyperliquid',
      };
    };

    const bestPair = getBestPair();
    const longProtocol = selectedAsset?.protocols?.[bestPair.long];
    const shortProtocol = selectedAsset?.protocols?.[bestPair.short];

    // Position size = margin * leverage
    const positionSize = marginValue * leverage;

    // Entry prices (use mark prices from protocols)
    const entryLong = longProtocol?.markPx || price;
    const entryShort = shortProtocol?.markPx || price;

    // Funding rates
    const fundingLong =
      longProtocol?.fundingRateYearly || selectedAsset?.hyperliquidFundingRate || 0;
    const fundingShort =
      shortProtocol?.fundingRateYearly || selectedAsset?.pacificaFundingRate || 0;

    // Estimated APR (Net APR from selected asset)
    const estimatedAPR = selectedAsset?.netAPR || 0;

    // Liquidation prices (simplified calculation: entry * (1 - 1/leverage))
    const liqLong = entryLong * (1 - 1 / leverage);
    const liqShort = entryShort * (1 + 1 / leverage);

    return {
      positionSize: formatPrice(positionSize, 'USD', 'en-US', 2, 2),
      margin: formatPrice(marginValue, 'USD', 'en-US', 2, 2),
      estimatedFees: formatPrice(marginValue * 0.001, 'USD', 'en-US', 2, 2), // 0.1% fee estimate
      entryPrice: {
        long: formatPrice(entryLong, 'USD', 'en-US', 2, 4),
        short: formatPrice(entryShort, 'USD', 'en-US', 2, 4),
      },
      liquidationPrice: {
        long: formatPrice(liqLong, 'USD', 'en-US', 2, 4),
        short: formatPrice(liqShort, 'USD', 'en-US', 2, 4),
      },
      fundingRate: {
        long: formatPercentWithSign(fundingLong),
        short: formatPercentWithSign(fundingShort),
      },
      estimatedAPR: formatPercentWithSign(estimatedAPR),
      maxDrawdown: formatPercentWithSign(100 / leverage), // Simplified: 100% / leverage
    };
  }, [margin, leverage, selectedAsset]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-xs text-text-muted-60 uppercase tracking-wide">TRADE DETAILS</label>
      <div className="bg-gradient-to-br from-card/60 via-card/40 to-card/30 border border-border-white-10/50 rounded-xl overflow-hidden backdrop-blur-md shadow-lg shadow-black/20">
        {/* Basic Info - Always Visible */}
        <div className="px-3 py-2.5 space-y-0">
          <TradeDetailRow label="Position Size" value={tradeDetails.positionSize} />
          <TradeDetailRow label="Margin" value={tradeDetails.margin} />
        </div>

        {/* Expandable Section */}
        {isExpanded && (
          <div className="px-3 pb-2 space-y-0 border-t border-border-white-5">
            <div className="pt-2 space-y-0">
              <TradeDetailRow
                label="Est. Fees"
                value={tradeDetails.estimatedFees}
                valueColor="muted"
              />
              <TradeDetailRow label="Entry (Long)" value={tradeDetails.entryPrice.long} />
              <TradeDetailRow label="Entry (Short)" value={tradeDetails.entryPrice.short} />
              <TradeDetailRow
                label="Liq. (Long)"
                value={tradeDetails.liquidationPrice.long}
                valueColor="red"
              />
              <TradeDetailRow
                label="Liq. (Short)"
                value={tradeDetails.liquidationPrice.short}
                valueColor="red"
              />
              <TradeDetailRow
                label="Funding (Long)"
                value={tradeDetails.fundingRate.long}
                valueColor="green"
              />
              <TradeDetailRow
                label="Funding (Short)"
                value={tradeDetails.fundingRate.short}
                valueColor="green"
              />
              <TradeDetailRow
                label="Est. APR"
                value={tradeDetails.estimatedAPR}
                valueColor="green"
              />
              <TradeDetailRow
                label="Max Drawdown"
                value={tradeDetails.maxDrawdown}
                valueColor="red"
              />
            </div>
          </div>
        )}

        {/* View More / View Less Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-border-white-10 text-xs text-text-muted-60 hover:text-text-primary transition-colors"
        >
          {isExpanded ? (
            <>
              <span>View Less</span>
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              <span>View More</span>
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
