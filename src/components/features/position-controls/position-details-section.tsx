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
import {
  marginAtom,
  leverageAtom,
  hlBalanceAtom,
  pacBalanceAtom,
  phxBalanceAtom,
  bpBalanceAtom,
  ltBalanceAtom,
  baseBalanceAtom,
} from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { useBestPair, type Protocol } from '@/hooks/use-best-pair';
import { formatPrice } from '@/lib/utils';
import type { FundExchange } from '@/hooks/use-fund-exchange';
import { toast } from 'sonner';
import { isPhoenixTradingEnabled } from '@/lib/phoenix/env';

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
  const phxBalance = useAtomValue(phxBalanceAtom);
  const bpBalance = useAtomValue(bpBalanceAtom);
  const ltBalance = useAtomValue(ltBalanceAtom);
  const baseBalance = useAtomValue(baseBalanceAtom);
  const { getBestPairForAsset } = useBestPair();

  // ── Add Margin state ──────────────────────────────────────────
  const [addMarginOpen, setAddMarginOpen] = useState(false);
  const [addMarginExchange, setAddMarginExchange] = useState<FundExchange>('hyperliquid');

  const { fund, reset, step, isExecuting, statusMessage, error } = useFundExchange();

  const handleOpenAddMargin = useCallback((exchange: FundExchange) => {
    if (exchange === 'phoenix' && !isPhoenixTradingEnabled()) {
      toast.error('Phoenix trading is disabled', {
        description: 'Set NEXT_PUBLIC_PHOENIX_TRADING_ENABLED=true in .env and restart the dev server.',
        duration: 6000,
      });
      return;
    }
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

    function getExistingBalance(protocol: Protocol): number {
      if (protocol === 'hyperliquid') return hlBalance;
      if (protocol === 'pacifica') return pacBalance;
      if (protocol === 'phoenix') return phxBalance;
      if (protocol === 'backpack') return bpBalance;
      if (protocol === 'lighter') return ltBalance;
      return 0;
    }

    function fundTarget(protocol: Protocol): FundExchange | null {
      if (protocol === 'backpack') return null;
      if (
        protocol === 'hyperliquid' ||
        protocol === 'pacifica' ||
        protocol === 'phoenix' ||
        protocol === 'lighter'
      ) {
        return protocol;
      }
      return null;
    }

    function legCard(
      label: 'LONG' | 'SHORT',
      protocol: Protocol,
      gradientColor: 'long' | 'short'
    ) {
      const bal = getExistingBalance(protocol);
      return {
        label,
        platform: protocol.toUpperCase(),
        fundTarget: fundTarget(protocol),
        gradientColor,
        margin: formatMargin(halfMargin),
        size: calculateSize(halfMargin),
        existingBalanceNum: bal,
        existingBalance: bal > 0 ? `$${bal.toFixed(2)}` : '$0.00',
      };
    }

    return [
      legCard('LONG', bestPair.long, 'long'),
      legCard('SHORT', bestPair.short, 'short'),
    ];
  }, [
    margin,
    leverage,
    price,
    selectedAsset,
    getBestPairForAsset,
    hlBalance,
    pacBalance,
    phxBalance,
    bpBalance,
    ltBalance,
  ]);

  // Derive context for the currently-selected exchange's modal
  const selectedCard = positionDetails.find((c) => c.fundTarget === addMarginExchange);
  const otherCard = positionDetails.find((c) => c !== selectedCard);

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
              addMarginDisabled={card.fundTarget === null}
              onAddMargin={
                card.fundTarget ? () => handleOpenAddMargin(card.fundTarget as FundExchange) : undefined
              }
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
