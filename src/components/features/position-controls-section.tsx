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
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { PositionControlsSection } from './trading-dashboard';
import { cn } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/ui/connect-wallet-button';
import { PositionSizeSection } from './position-controls/position-size-section';
import { LeverageSection } from './position-controls/leverage-section';
import { PositionDetailsSection } from './position-controls/position-details-section';
import { TradeDetailsSection } from './position-controls/trade-details-section';
import { AssetPriceHeader } from './position-controls/asset-price-header';
import { HedgeExecutionProgress } from './position-controls/hedge-execution-progress';
import {
  isLoggedInAtom,
} from '@/lib/turnkey/store';
import {
  marginAtom,
  leverageAtom,
  selectedAssetAtom,
} from './position-controls/store';
import { useHedgeIntent } from '@/lib/hedge-intent';
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

  // ── Hedge Intent Hook ──────────────────────────────────────
  const {
    openHedge,
    isExecuting,
    phase,
    statusMessage,
    currentAction,
    detail,
    error,
  } = useHedgeIntent();

  // ── Handlers ───────────────────────────────────────────────
  const handleConnectWallet = async () => {
    if (onConnectWallet) {
      onConnectWallet();
      return;
    }
  };

  const handleOpenPosition = async () => {
    if (onOpenPosition) {
      onOpenPosition();
      return;
    }

    // Validate inputs
    if (!selectedAsset) {
      alert('Please select an asset');
      return;
    }

    if (!margin || parseFloat(margin) <= 0) {
      alert('Please enter a valid margin amount');
      return;
    }

    if (!isLoggedIn) {
      alert('Please connect your wallet first');
      return;
    }

    // Open hedged position via intent system
    await openHedge({
      asset: selectedAsset,
      marginUsd: parseFloat(margin),
      leverage,
    });
  };

  // ── Derived state ──────────────────────────────────────────
  const canExecute =
    isLoggedIn &&
    selectedAsset &&
    margin &&
    parseFloat(margin) > 0 &&
    !isExecuting;

  const isComplete = phase === 'complete';
  const isFailed = phase === 'failed';
  const showProgress = isExecuting || isComplete || isFailed;

  // Button text based on phase
  const getButtonText = (): string => {
    if (!isExecuting) {
      if (isComplete) return 'HEDGE LIVE ✓';
      return 'OPEN HEDGED POSITION';
    }
    switch (phase) {
      case 'creating':
        return 'CREATING INTENT...';
      case 'bridging':
        return 'BRIDGING FUNDS...';
      case 'depositing':
        return 'DEPOSITING...';
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
      className={cn(
        'ml-4 lg:w-[400px] xl:w-[450px] lg:shrink-0 h-full overflow-hidden mt-4',
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3 border-b border-border-white-10/50 bg-gradient-to-r from-card/60 via-card/50 to-card/60 backdrop-blur-md rounded-t-xl shadow-lg shadow-black/20">
          <h2 className="text-sm font-medium text-text-primary">POSITION PANEL</h2>
        </div>

        {/* Asset Price Header */}
        <AssetPriceHeader />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
          {/* Position Size Section */}
          <PositionSizeSection />

          {/* Leverage Section */}
          <LeverageSection />

          {/* Position Details Section */}
          <PositionDetailsSection />

          {/* Trade Details Section */}
          <TradeDetailsSection />

          {/* ── Hedge Execution Progress ──────────────────────── */}
          {showProgress && (
            <HedgeExecutionProgress
              detail={detail}
              phase={phase}
              statusMessage={statusMessage}
              currentAction={currentAction}
              error={error}
            />
          )}

          {/* Error (only shown when not in progress — progress has its own error) */}
          {error && !showProgress && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-900/20 border border-red-500/30">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-400">Error</p>
                <p className="text-xs text-red-300 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {isComplete && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-green-900/20 border border-green-500/30">
              <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-green-400">Hedge Active</p>
                <p className="text-xs text-green-300 mt-0.5">
                  Your delta-neutral hedge is live on both protocols.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Wallet Connection / Open Position */}
        <div className="px-4 md:px-6 pb-4 pt-3 border-t border-border-white-10/50 space-y-3 bg-gradient-to-t from-card/40 to-transparent backdrop-blur-sm rounded-b-xl">
          {isLoggedIn ? (
            <>
              <ConnectWalletButton
                onClick={handleOpenPosition}
                size="md"
                fullWidth
                text={getButtonText()}
                disabled={!canExecute || isExecuting}
              />
            </>
          ) : (
            <>
              <ConnectWalletButton onClick={handleConnectWallet} size="md" fullWidth />
            </>
          )}
        </div>
      </div>
    </PositionControlsSection>
  );
}
