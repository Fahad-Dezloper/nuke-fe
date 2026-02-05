'use client';

/**
 * Position Details Section Component
 * Cards showing LONG and SHORT position details
 * Calculates values based on user input (margin, leverage, price)
 */

import { useAtom, useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { PositionDetailsCard } from '@/components/ui/position-details-card';
import { BridgeStatusModal } from '@/components/ui/bridge-status-modal';
import { useBridge } from '@/lib/bridge';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { marginAtom, leverageAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { formatPrice } from '@/lib/utils';

interface PositionDetailsSectionProps {
  className?: string;
}

export function PositionDetailsSection({ className }: PositionDetailsSectionProps) {
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const { state: turnkeyState } = useTurnkey();
  const [isBridging, setIsBridging] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<'hyperliquid' | 'pacifica'>(
    'hyperliquid'
  );
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const {
    status: bridgeStatus,
    error: bridgeErrorState,
    bridge,
  } = useBridge({
    onSuccess: () => {
      // Auto-close after a short delay on success
      setTimeout(() => {
        setIsBridging(false);
        setBridgeError(null);
      }, 2000);
    },
    onError: (error) => {
      setBridgeError(error.message);
      // Keep modal open to show error, user can close manually
    },
  });

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
      if (assetSize >= 0.01) return assetSize.toFixed(6);
      return assetSize.toFixed(8);
    }

    function formatMargin(amount: number): string {
      if (amount === 0) return '$0.00';
      return formatPrice(amount, 'USD', 'en-US', 2, 2);
    }

    function getBestPair() {
      if (!selectedAsset) return { long: 'HYPERLIQUID', short: 'PACIFICA' };
      const hyperliquidRate = selectedAsset.hyperliquidFundingRate ?? 0;
      const pacificaRate = selectedAsset.pacificaFundingRate ?? 0;
      const isHyperliquidLower = hyperliquidRate < pacificaRate;
      return {
        long: isHyperliquidLower ? 'HYPERLIQUID' : 'PACIFICA',
        short: isHyperliquidLower ? 'PACIFICA' : 'HYPERLIQUID',
      };
    }

    const { long: longProtocolName, short: shortProtocolName } = getBestPair();

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
  }, [margin, leverage, price, selectedAsset]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className="text-xs text-text-muted-60 uppercase tracking-wide">POSITION DETAILS</label>
      <div className="grid grid-cols-2 gap-3">
        {positionDetails.map((card) => {
          const buttonGradientClass =
            card.gradientColor === 'long'
              ? 'bg-gradient-to-br from-[var(--chart-hyperliquid)]/10 via-[var(--chart-hyperliquid)]/5 to-[var(--chart-hyperliquid)]/3'
              : 'bg-gradient-to-br from-[var(--chart-pink)]/10 via-[var(--chart-pink)]/5 to-[var(--chart-pink)]/3';

          // Determine protocol from platform name
          const protocol =
            card.platform.toLowerCase() === 'hyperliquid' ? 'hyperliquid' : 'pacifica';

          // Calculate the margin amount for this leg (half of total margin)
          const marginValue = Number(margin) || 0;
          const legMargin = marginValue / 2;

          const handleFundClick = async () => {
            if (legMargin <= 0) {
              return;
            }

            setSelectedProtocol(protocol);
            setBridgeError(null);
            setIsBridging(true);

            // Convert margin to smallest unit (USDC has 6 decimals)
            const amountInSmallestUnit = BigInt(Math.floor(legMargin * 1_000_000)).toString();

            try {
              const feePayerAddress = process.env.NEXT_PUBLIC_HYPERLIQUID_FEEPAYER_ADDRESS;

              // Get Solana address for Pacifica bridge
              let solanaRecipient: string | undefined;
              if (protocol === 'pacifica') {
                const wallets = turnkeyState.userWallets;
                if (wallets && wallets.length > 0) {
                  solanaRecipient = getSolanaAddress(wallets);
                  if (!solanaRecipient) {
                    throw new Error(
                      'No Solana wallet address found. Please ensure you have a Solana wallet connected.'
                    );
                  }
                }
              }

              await bridge(amountInSmallestUnit, protocol, feePayerAddress, solanaRecipient);
            } catch (err) {
              // Error is handled by useBridge onError callback
              console.error('Bridge error:', err);
            }
          };

          return (
            <div key={card.label} className="flex flex-col gap-2">
              <PositionDetailsCard {...card} />
              <button
                onClick={handleFundClick}
                disabled={isBridging || legMargin <= 0}
                className={cn(
                  'w-full py-2 px-3 rounded-xl border border-border-white-10/50',
                  'backdrop-blur-md',
                  'text-xs font-medium text-text-primary',
                  'hover:border-border-white-20 hover:bg-opacity-80',
                  'transition-all duration-200',
                  'shadow-sm shadow-black/10',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  buttonGradientClass
                )}
              >
                {isBridging ? 'Funding...' : 'Fund leg'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bridge Status Modal */}
      <BridgeStatusModal
        isOpen={isBridging}
        status={bridgeStatus}
        protocol={selectedProtocol}
        error={bridgeError || bridgeErrorState?.message || null}
        onClose={() => {
          setIsBridging(false);
          setBridgeError(null);
        }}
      />
    </div>
  );
}
