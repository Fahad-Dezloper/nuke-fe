'use client';

import { useState, useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TradeDetailRow } from '@/components/ui/trade-detail-row';
import { marginAtom, leverageAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { bridgeFeesAtom, bridgeFeesLoadingAtom } from '@/lib/stores/bridge-fees.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { formatPrice, formatPercentWithSign } from '@/lib/utils';

interface TradeDetailsSectionProps {
  className?: string;
}

export function TradeDetailsSection({ className }: TradeDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const { getBestPairForAsset } = useBestPair();
  const bridgeFees = useAtomValue(bridgeFeesAtom);
  const bridgeFeesLoading = useAtomValue(bridgeFeesLoadingAtom);

  const tradeDetails = useMemo(() => {
    const marginValue = parseFloat(margin) || 0;
    const price = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;
    const bestPair = getBestPairForAsset(selectedAsset);
    const longProtocol = selectedAsset?.protocols?.[bestPair.long];
    const shortProtocol = selectedAsset?.protocols?.[bestPair.short];
    const positionSize = marginValue * leverage;
    const entryLong = longProtocol?.markPx || price;
    const entryShort = shortProtocol?.markPx || price;
    const fundingLong = longProtocol?.fundingRateYearly || selectedAsset?.hyperliquidFundingRate || 0;
    const fundingShort = shortProtocol?.fundingRateYearly || selectedAsset?.pacificaFundingRate || 0;
    const estimatedAPR = selectedAsset?.netAPR || 0;
    const liqLong = entryLong * (1 - 1 / leverage);
    const liqShort = entryShort * (1 + 1 / leverage);
    const totalFees = bridgeFees?.totalFeeUsd ?? 0;

    return {
      positionSize: formatPrice(positionSize, 'USD', 'en-US', 2, 2),
      margin: formatPrice(marginValue, 'USD', 'en-US', 2, 2),
      estimatedFees: totalFees > 0 ? formatPrice(totalFees, 'USD', 'en-US', 2, 2) : '—',
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
    };
  }, [margin, leverage, selectedAsset, getBestPairForAsset, bridgeFees]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-[10px] text-text-muted-40 uppercase tracking-wider">Trade Details</label>
      <div className="border border-border-white-10 rounded-sm overflow-hidden bg-background">
        <div className="px-3 py-2 space-y-0">
          <TradeDetailRow label="Position Size" value={tradeDetails.positionSize} />
          <TradeDetailRow label="Margin" value={tradeDetails.margin} />
        </div>

        {isExpanded && (
          <div className="px-3 pb-2 space-y-0 border-t border-border-white-10">
            <div className="pt-2 space-y-0">
              <TradeDetailRow
                label="Est. Fees"
                value={bridgeFeesLoading ? '...' : tradeDetails.estimatedFees}
                valueColor="muted"
              />
              <TradeDetailRow label="Entry (Long)" value={tradeDetails.entryPrice.long} />
              <TradeDetailRow label="Entry (Short)" value={tradeDetails.entryPrice.short} />
              <TradeDetailRow label="Liq. (Long)" value={tradeDetails.liquidationPrice.long} valueColor="red" />
              <TradeDetailRow label="Liq. (Short)" value={tradeDetails.liquidationPrice.short} valueColor="red" />
              <TradeDetailRow label="Funding (Long)" value={tradeDetails.fundingRate.long} valueColor="green" />
              <TradeDetailRow label="Funding (Short)" value={tradeDetails.fundingRate.short} valueColor="green" />
              <TradeDetailRow label="Est. APR" value={tradeDetails.estimatedAPR} valueColor="green" />
            </div>
          </div>
        )}

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 py-1.5 border-t border-border-white-10 text-[10px] text-text-muted-40 hover:text-text-primary transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <><span>Less</span><ChevronUp className="h-3 w-3" /></>
          ) : (
            <><span>More</span><ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      </div>
    </div>
  );
}
