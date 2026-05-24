'use client';

import { useAtomValue, useAtom } from 'jotai';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PositionControlsSection } from './trading-dashboard';
import { cn } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/ui/connect-wallet-button';
import { PositionSizeSection } from './position-controls/position-size-section';
import { LeverageSection } from './position-controls/leverage-section';
import { PositionDetailsSection } from './position-controls/position-details-section';
import { TradeDetailsSection } from './position-controls/trade-details-section';
import { AssetPriceHeader } from './position-controls/asset-price-header';
import { HedgeExecutionProgress } from './position-controls/hedge-execution-progress';
import { isLoggedInAtom } from '@/lib/turnkey/store';
import {
  marginAtom,
  leverageAtom,
  selectedAssetAtom,
  marginValidationAtom,
} from './position-controls/store';
import { useHedgeIntent } from '@/lib/hedge-intent';
import { useBestPair } from '@/hooks/use-best-pair';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { marketFeedDataAtom } from '@/lib/stores/market-feed.store';
import { PositionControlsSkeleton } from '@/components/ui/skeletons';

interface PositionControlsSectionContentProps {
  className?: string;
  onConnectWallet?: () => void;
  onOpenPosition?: () => void;
}

export function PositionControlsSectionContent({
  className,
  onConnectWallet,
  onOpenPosition,
}: PositionControlsSectionContentProps) {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const [selectedAsset] = useAtom(selectedAssetAtom);
  const marginValidation = useAtomValue(marginValidationAtom);

  useExchangeBalances();

  const {
    openHedge,
    isExecuting,
    phase,
    statusMessage,
    currentAction,
    detail,
  } = useHedgeIntent();
  const { getBestPairForAsset } = useBestPair();

  const handleOpenPosition = async () => {
    if (onOpenPosition) {
      onOpenPosition();
      return;
    }

    if (!selectedAsset) {
      toast.error('Please select an asset');
      return;
    }

    if (!margin || parseFloat(margin) <= 0) {
      toast.error('Please enter a valid margin amount');
      return;
    }

    if (!isLoggedIn) {
      toast.error('Please connect your wallet first');
      return;
    }

    const assetItem = marketFeedData.find((a) => a.asset === selectedAsset) ?? null;
    const bestPair = getBestPairForAsset(assetItem);
    await openHedge({
      asset: selectedAsset,
      marginUsd: parseFloat(margin),
      leverage,
      longExchange: bestPair.long,
      shortExchange: bestPair.short,
    });
  };

  const canExecute =
    isLoggedIn &&
    selectedAsset &&
    margin &&
    parseFloat(margin) > 0 &&
    marginValidation.isValid &&
    !isExecuting;

  const isComplete = phase === 'complete';
  const isFailed = phase === 'failed';

  const [progressDismissed, setProgressDismissed] = useState(false);

  if (isExecuting && progressDismissed) {
    setProgressDismissed(false);
  }

  useEffect(() => {
    if (!isComplete && !isFailed) return;
    const timer = setTimeout(() => setProgressDismissed(true), 2000);
    return () => clearTimeout(timer);
  }, [isComplete, isFailed]);

  const showProgress = (isExecuting || isComplete || isFailed) && !progressDismissed;

  const getButtonText = (): string => {
    if (!isExecuting) {
      if (isComplete) return 'Position open';
      return 'Open hedged position';
    }
    switch (phase) {
      case 'creating':
        return 'Creating intent...';
      case 'bridging':
        return 'Bridging funds...';
      case 'depositing':
        return 'Depositing...';
      case 'opening':
        return 'Opening positions...';
      case 'closing':
        return 'Safety mode...';
      default:
        return 'Executing...';
    }
  };

  if (marketFeedData.length === 0) {
    return <PositionControlsSkeleton className={className} />;
  }

  return (
    <PositionControlsSection className={cn('h-full min-h-0', className)}>
      <div className="flex flex-col h-full min-h-0">
        <AssetPriceHeader />

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 md:px-5 space-y-5">
          <PositionSizeSection />
          <LeverageSection />
          <PositionDetailsSection />
          <TradeDetailsSection />
        </div>

        {showProgress && (
          <HedgeExecutionProgress
            detail={detail}
            phase={phase}
            statusMessage={statusMessage}
            currentAction={currentAction}
          />
        )}

        <div className="shrink-0 px-4 pb-4 pt-3 md:px-5 border-t border-border-white-10 bg-card/50">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={handleOpenPosition}
              disabled={!canExecute || isExecuting}
              className={cn(
                'w-full h-11 rounded-sm text-sm font-semibold transition-all duration-150 cursor-pointer',
                canExecute && !isExecuting
                  ? 'bg-green text-black hover:bg-green/90 active:scale-[0.99]'
                  : isComplete
                    ? 'bg-green-dim text-green border border-green/30'
                    : 'bg-secondary border border-border-white-10 text-text-muted-60 cursor-not-allowed'
              )}
            >
              {getButtonText()}
            </button>
          ) : (
            <ConnectWalletButton
              onClick={onConnectWallet}
              size="md"
              fullWidth
              variant="primary"
            />
          )}
        </div>
      </div>
    </PositionControlsSection>
  );
}
