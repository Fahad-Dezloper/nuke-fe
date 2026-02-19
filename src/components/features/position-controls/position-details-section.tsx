'use client';

/**
 * Position Details Section Component
 * Cards showing LONG and SHORT position details with "Add Margin" buttons.
 * Calculates values based on user input (margin, leverage, price).
 */

import { useAtom, useAtomValue } from 'jotai';
import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PositionDetailsCard } from '@/components/ui/position-details-card';
import { AddMarginModal } from '@/components/ui/add-margin-modal';
import { isLoggedInAtom } from '@/lib/turnkey/store';
import { useFundExchange } from '@/hooks/use-fund-exchange';
import { marginAtom, leverageAtom, hlBalanceAtom, pacBalanceAtom, baseBalanceAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { formatPrice } from '@/lib/utils';
import type { FundExchange } from '@/hooks/use-fund-exchange';

interface PositionDetailsSectionProps {
  className?: string;
}

export function PositionDetailsSection({ className }: PositionDetailsSectionProps) {
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const hlBalance = useAtomValue(hlBalanceAtom);
  const pacBalance = useAtomValue(pacBalanceAtom);
  const baseBalance = useAtomValue(baseBalanceAtom);
  const { getBestPairForAsset } = useBestPair();

  // ── Add Margin state ──────────────────────────────────────────
  const [addMarginOpen, setAddMarginOpen] = useState(false);
  const [addMarginExchange, setAddMarginExchange] = useState<FundExchange>('hyperliquid');

  const { fund, reset, step, isExecuting, statusMessage, error } = useFundExchange();

  const handleOpenAddMargin = useCallback((exchange: FundExchange) => {
    setAddMarginExchange(exchange);
    setAddMarginOpen(true);
  }, []);

  const handleCloseAddMargin = useCallback(() => {
    if (isExecuting) return;
    setAddMarginOpen(false);
  }, [isExecuting]);

  const handleSubmitAddMargin = useCallback(
    (amountUsd: number) => {
      fund(addMarginExchange, amountUsd);
    },
    [fund, addMarginExchange]
  );

  // Get price from selected asset (use hyperliquid mark price as primary)
  const price = selectedAsset?.markPx || selectedAsset?.hyperliquidMarkPx || 0;

  // Calculate position details
  const positionDetails = useMemo(() => {
    const marginValue = Number(margin) || 0;
    const halfMargin = marginValue / 2;

    function calculateSize(marginAmount: number): string {
      if (!marginAmount || !price || price <= 0) return '-';
      const usdSize = marginAmount * leverage;
      const assetSize = usdSize / price;
      if (assetSize >= 1) return assetSize.toFixed(4);
      if (assetSize >= 0.01) return assetSize.toFixed(4);
      return assetSize.toFixed(4);
    }

    function formatMargin(amount: number): string {
      if (amount === 0) return '$0.00';
      return formatPrice(amount, 'USD', 'en-US', 2, 2);
    }

    const bestPair = getBestPairForAsset(selectedAsset);
    const longProtocolName = bestPair.long.toUpperCase();
    const shortProtocolName = bestPair.short.toUpperCase();

    function getExistingBalance(protocol: string): number {
      return protocol === 'HYPERLIQUID' ? hlBalance : pacBalance;
    }

    function getProtocolId(protocol: string): FundExchange {
      return protocol === 'HYPERLIQUID' ? 'hyperliquid' : 'pacifica';
    }

    return [
      {
        label: 'LONG',
        platform: longProtocolName,
        protocolId: getProtocolId(longProtocolName),
        gradientColor: 'long' as const,
        margin: formatMargin(halfMargin),
        size: calculateSize(halfMargin),
        existingBalanceNum: getExistingBalance(longProtocolName),
        existingBalance:
          getExistingBalance(longProtocolName) > 0
            ? `$${getExistingBalance(longProtocolName).toFixed(2)}`
            : '$0.00',
      },
      {
        label: 'SHORT',
        platform: shortProtocolName,
        protocolId: getProtocolId(shortProtocolName),
        gradientColor: 'short' as const,
        margin: formatMargin(halfMargin),
        size: calculateSize(halfMargin),
        existingBalanceNum: getExistingBalance(shortProtocolName),
        existingBalance:
          getExistingBalance(shortProtocolName) > 0
            ? `$${getExistingBalance(shortProtocolName).toFixed(2)}`
            : '$0.00',
      },
    ];
  }, [margin, leverage, price, selectedAsset, getBestPairForAsset, hlBalance, pacBalance]);

  // Derive context for the currently-selected exchange's modal
  const selectedCard = positionDetails.find((c) => c.protocolId === addMarginExchange);
  const otherCard = positionDetails.find((c) => c.protocolId !== addMarginExchange);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className="text-xs text-text-muted-60 uppercase tracking-wide">POSITION DETAILS</label>
      <div className="grid grid-cols-2 gap-3">
        {positionDetails.map((card) => (
          <div key={card.label} className="flex flex-col gap-2">
            <PositionDetailsCard
              label={card.label}
              platform={card.platform}
              gradientColor={card.gradientColor}
              margin={card.margin}
              size={card.size}
              existingBalance={card.existingBalance}
              showAddMargin={isLoggedIn && baseBalance > 0}
              onAddMargin={() => handleOpenAddMargin(card.protocolId)}
            />
          </div>
        ))}
      </div>

      {/* Add Margin Modal */}
      <AddMarginModal
        isOpen={addMarginOpen}
        onClose={handleCloseAddMargin}
        exchange={addMarginExchange}
        baseBalance={baseBalance}
        existingMargin={selectedCard?.existingBalanceNum ?? 0}
        otherExchangeMargin={otherCard?.existingBalanceNum ?? 0}
        otherExchangeName={otherCard?.platform ?? ''}
        fundStep={step}
        isExecuting={isExecuting}
        statusMessage={statusMessage}
        error={error}
        onSubmit={handleSubmitAddMargin}
        onReset={reset}
      />
    </div>
  );
}
