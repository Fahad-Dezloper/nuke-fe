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
import { bridgeFeesAtom, bridgeFeesLoadingAtom } from '@/lib/stores/bridge-fees.store';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import {
  bestPairMetricAtom,
  selectedExchangesAtom,
  selectedVenuesList,
} from '@/lib/stores/arbitrage-table-filters.store';
import { getBestPair } from '@/hooks/use-best-pair';
import { fundingSpreadAprYearly } from '@/lib/arbitrage/asset-table-pairs';
import {
  estimateIsolatedLiquidationPriceForExchange,
  hedgePositionSizeFromMargin,
} from '@/lib/hedge-intent/hedge-liquidation-estimate';
import { formatPrice, formatPercentWithSign } from '@/lib/utils';

interface TradeDetailsSectionProps {
  className?: string;
}

export function TradeDetailsSection({ className }: TradeDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const spreadAprData = useAtomValue(spreadAprDataAtom);
  const overrides = useAtomValue(bestPairOverrideAtom);
  const selectedMap = useAtomValue(selectedExchangesAtom);
  const metric = useAtomValue(bestPairMetricAtom);
  const bridgeFees = useAtomValue(bridgeFeesAtom);
  const bridgeFeesLoading = useAtomValue(bridgeFeesLoadingAtom);

  const selectedList = useMemo(() => selectedVenuesList(selectedMap), [selectedMap]);

  const bestPair = useMemo(
    () =>
      getBestPair(
        selectedAsset,
        spreadAprData,
        selectedAsset ? overrides[selectedAsset.asset] ?? null : null,
        { selectedExchanges: selectedList, metric }
      ),
    [selectedAsset, spreadAprData, overrides, selectedList, metric]
  );

  const marginValue = parseFloat(margin) || 0;

  // Calculate trade details from selected asset, margin, and leverage
  const tradeDetails = useMemo(() => {
    const price = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

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

    const estimatedAPR = fundingSpreadAprYearly(fundingLong, fundingShort);

    let liqLong = entryLong * (1 - 1 / leverage);
    let liqShort = entryShort * (1 + 1 / leverage);

    if (marginValue > 0 && price > 0 && leverage > 0) {
      const positionSizeCoins = hedgePositionSizeFromMargin({
        marginUsd: marginValue,
        leverage,
        markPrice: price,
      });
      if (positionSizeCoins != null) {
        const longMax = longProtocol?.maxLeverage ?? 20;
        const shortMax = shortProtocol?.maxLeverage ?? 20;
        const estLong = estimateIsolatedLiquidationPriceForExchange({
          exchange: bestPair.long,
          markPrice: price,
          marginUsd: marginValue,
          positionSize: positionSizeCoins,
          leverage,
          maxLeverage: longMax,
          side: 'long',
        });
        const estShort = estimateIsolatedLiquidationPriceForExchange({
          exchange: bestPair.short,
          markPrice: price,
          marginUsd: marginValue,
          positionSize: positionSizeCoins,
          leverage,
          maxLeverage: shortMax,
          side: 'short',
        });
        if (estLong != null && Number.isFinite(estLong)) liqLong = estLong;
        if (estShort != null && Number.isFinite(estShort)) liqShort = estShort;
      }
    }

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
      maxDrawdown: formatPercentWithSign(100 / leverage),
    };
  }, [marginValue, leverage, selectedAsset, bestPair.long, bestPair.short, bridgeFees]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-xs text-text-muted-60 uppercase tracking-wide">TRADE DETAILS</label>
      <div className="bg-gradient-to-br from-card/60 via-card/40 to-card/30 border border-border-white-10/50 rounded-md overflow-hidden backdrop-blur-md shadow-lg shadow-black/20">
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
                value={bridgeFeesLoading ? '...' : tradeDetails.estimatedFees}
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
            </div>
          </div>
        )}

        {/* View More / View Less Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 border-t cursor-pointer border-border-white-10 text-xs text-text-muted-60 hover:text-text-primary transition-colors"
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
