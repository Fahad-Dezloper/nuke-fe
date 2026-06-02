'use client';

/**
 * Position Controls Section Component
 * Right side panel with position controls.
 *
 * Now wired to the Hedge Intent system:
 * - "OPEN HEDGED POSITION" creates a backend-orchestrated intent
 * - Progress stepper shows bridge → deposit → open flow
 * - Auto-resumes on page reload
 */

import { useAtomValue, useAtom } from 'jotai';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  hedgeExitRangeAtom,
  hedgeExitRangeEnabledAtom,
  exitRangeValidationAtom,
} from './position-controls/store';
import {
  ExitRangeSection,
  ExitRangeValidationBanner,
} from './position-controls/exit-range-section';
import { useHedgeIntent } from '@/lib/hedge-intent';
import { useBestPair } from '@/hooks/use-best-pair';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { usePositions } from '@/hooks/use-positions';
import { marketFeedDataAtom } from '@/lib/stores/market-feed.store';
import { PositionControlsSkeleton } from '@/components/ui/skeletons';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { PacificaService } from '@/lib/services/pacifica';
import {
  assetHasOpenHedge,
  existingPositionError,
  isMinVenueNotionalMet,
} from '@/lib/trading/open-hedge-validation';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateTradingBalances } from '@/lib/trading/invalidate-trading-balances';

interface PositionControlsSectionContentProps {
  className?: string;
  onConnectWallet?: () => void;
  onOpenPosition?: () => void;
  /** Mobile trade tab: scrollable flat panel without fixed height clipping */
  embedded?: boolean;
}

const pacificaService = new PacificaService();

export function PositionControlsSectionContent({
  className,
  onConnectWallet,
  onOpenPosition,
  embedded,
}: PositionControlsSectionContentProps) {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const [selectedAsset] = useAtom(selectedAssetAtom);
  const marginValidation = useAtomValue(marginValidationAtom);
  const exitRangeValidation = useAtomValue(exitRangeValidationAtom);
  const exitRange = useAtomValue(hedgeExitRangeAtom);
  const exitRangeEnabled = useAtomValue(hedgeExitRangeEnabledAtom);
  const { state: turnkeyState } = useTurnkey();
  const queryClient = useQueryClient();

  const evmAddress = turnkeyState.userWallets?.length
    ? getEVMAddress(turnkeyState.userWallets)
    : null;
  const solanaAddress = turnkeyState.userWallets?.length
    ? getSolanaAddress(turnkeyState.userWallets)
    : null;

  useExchangeBalances();

  const { rawPositions, refetch: refetchPositions } = usePositions({
    evmAddress: evmAddress ?? undefined,
    solanaAddress: solanaAddress ?? undefined,
    enabled: isLoggedIn && !!evmAddress && !!solanaAddress,
  });

  const openSymbols = useMemo(() => rawPositions.map((p) => p.symbol), [rawPositions]);

  const hasExistingPosition = selectedAsset ? assetHasOpenHedge(selectedAsset, openSymbols) : false;

  const { openHedge, isExecuting, phase, statusMessage, currentAction, detail, safetyExposure } =
    useHedgeIntent();
  const { getBestPairForAsset } = useBestPair();

  const handleOpenPosition = useCallback(async () => {
    if (onOpenPosition) {
      onOpenPosition();
      return;
    }

    if (!selectedAsset) {
      toast.error('Please select an asset');
      return;
    }

    const marginNum = parseFloat(margin);
    if (!margin || !Number.isFinite(marginNum) || marginNum <= 0) {
      toast.error('Please enter a valid margin amount');
      return;
    }

    if (!isMinVenueNotionalMet(marginNum, leverage)) {
      toast.error('Position size too small per venue', {
        description: marginValidation.error ?? undefined,
        duration: 8000,
      });
      return;
    }

    if (!marginValidation.isValid) {
      toast.error('Cannot open hedge', {
        description: marginValidation.error ?? 'Check margin and balances.',
        duration: 8000,
      });
      return;
    }

    if (exitRangeEnabled && !exitRangeValidation.isValid) {
      toast.error('Cannot open hedge', {
        description: exitRangeValidation.error ?? 'Adjust exit limits.',
        duration: 8000,
      });
      return;
    }

    if (exitRangeEnabled && !exitRange) {
      toast.error('Set exit limits before opening.');
      return;
    }

    if (!isLoggedIn) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (hasExistingPosition) {
      toast.error('Position already open', {
        description: existingPositionError(selectedAsset),
        duration: 8000,
      });
      return;
    }

    const assetItem = marketFeedData.find((a) => a.asset === selectedAsset) ?? null;
    const bestPair = getBestPairForAsset(assetItem);

    const needsPacifica = bestPair.long === 'pacifica' || bestPair.short === 'pacifica';

    if (needsPacifica && solanaAddress) {
      try {
        const approved = await pacificaService.checkBuilderCodeApproval(solanaAddress);
        if (!approved) {
          toast.message('Pacifica builder approval required', {
            description:
              'Confirm the Pacifica builder approval in your wallet when prompted during setup.',
            duration: 8000,
          });
        }
      } catch {
        /* non-blocking — executor will retry */
      }
    }

    await openHedge({
      asset: selectedAsset,
      marginUsd: marginNum,
      leverage,
      longExchange: bestPair.long,
      shortExchange: bestPair.short,
      exitRange: exitRangeEnabled ? exitRange ?? undefined : undefined,
    });

    if (evmAddress && solanaAddress) {
      void invalidateTradingBalances(queryClient, { evmAddress, solanaAddress });
    }
    void refetchPositions();
  }, [
    onOpenPosition,
    selectedAsset,
    margin,
    leverage,
    marginValidation,
    exitRangeEnabled,
    exitRangeValidation,
    exitRange,
    isLoggedIn,
    hasExistingPosition,
    marketFeedData,
    getBestPairForAsset,
    solanaAddress,
    openHedge,
    evmAddress,
    queryClient,
    refetchPositions,
  ]);

  const canExecute =
    isLoggedIn &&
    selectedAsset &&
    margin &&
    parseFloat(margin) > 0 &&
    marginValidation.isValid &&
    exitRangeValidation.isValid &&
    (!exitRangeEnabled || !!exitRange) &&
    !hasExistingPosition &&
    !isExecuting;

  const isComplete = phase === 'complete';
  const isFailed = phase === 'failed' || phase === 'safety_failed';

  const [progressDismissed, setProgressDismissed] = useState(false);

  useEffect(() => {
    if (isExecuting) setProgressDismissed(false);
  }, [isExecuting]);

  useEffect(() => {
    if (!isComplete && !isFailed) return;
    const timer = setTimeout(() => setProgressDismissed(true), 2000);
    return () => clearTimeout(timer);
  }, [isComplete, isFailed]);

  const showProgress = (isExecuting || isComplete || isFailed) && !progressDismissed;

  const getButtonText = (): string => {
    if (!isExecuting) {
      if (isComplete) return 'HEDGE LIVE ✓';
      if (phase === 'safety_failed') return 'OPEN HEDGED POSITION';
      if (isFailed) return 'OPEN HEDGED POSITION';
      return 'OPEN HEDGED POSITION';
    }
    switch (phase) {
      case 'creating':
        return 'CREATING INTENT...';
      case 'bridging':
        return 'BRIDGING FUNDS...';
      case 'depositing':
        return 'DEPOSITING...';
      case 'pacifica_access':
        return 'PACIFICA ACCESS...';
      case 'opening':
        return 'OPENING POSITIONS...';
      case 'closing':
        return 'SAFETY MODE...';
      default:
        return 'EXECUTING...';
    }
  };

  if (marketFeedData.length === 0) {
    return <PositionControlsSkeleton className={className} />;
  }

  return (
    <PositionControlsSection
      embedded={embedded}
      className={cn(
        embedded ? 'h-auto min-h-full' : 'h-full overflow-hidden lg:w-[400px] xl:w-[450px] lg:shrink-0',
        className
      )}
    >
      <div className={cn('flex flex-col', embedded ? 'min-h-full' : 'h-full')}>
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3 border-b border-border-white-10/70 bg-card/25 rounded-t-lg">
          <h2 className="text-sm font-medium text-text-primary">POSITION PANEL</h2>
        </div>

        {!embedded && <AssetPriceHeader />}

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
          <PositionSizeSection />

          <LeverageSection />

          <ExitRangeSection />
          <ExitRangeValidationBanner />

          {hasExistingPosition && selectedAsset && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                {existingPositionError(selectedAsset)}
              </p>
            </div>
          )}

          <PositionDetailsSection />

          <TradeDetailsSection />
        </div>

        {showProgress && (
          <HedgeExecutionProgress
            detail={detail}
            phase={phase}
            statusMessage={statusMessage}
            currentAction={currentAction}
            safetyExposure={safetyExposure}
          />
        )}

        <div className="px-4 md:px-6 pb-4 pt-3 border-t border-border-white-10/50 space-y-3 bg-gradient-to-t from-card/40 to-transparent backdrop-blur-sm rounded-b-md">
          {isLoggedIn ? (
            <ConnectWalletButton
              onClick={handleOpenPosition}
              size="md"
              fullWidth
              text={getButtonText()}
              disabled={!canExecute || isExecuting}
            />
          ) : (
            <ConnectWalletButton onClick={onConnectWallet} size="md" fullWidth />
          )}
        </div>
      </div>
    </PositionControlsSection>
  );
}
