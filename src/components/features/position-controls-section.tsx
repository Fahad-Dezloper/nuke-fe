'use client';

/**
 * Position Controls Section Component
 * Right side panel with position controls
 */

import { useAtomValue, useAtom } from 'jotai';
import { ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PositionControlsSection } from './trading-dashboard';
import { cn } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/ui/connect-wallet-button';
import { PositionSizeSection } from './position-controls/position-size-section';
import { LeverageSection } from './position-controls/leverage-section';
import { PositionDetailsSection } from './position-controls/position-details-section';
import { TradeDetailsSection } from './position-controls/trade-details-section';
import { AssetPriceHeader } from './position-controls/asset-price-header';
import { ArbitragePairSelector } from './position-controls/arbitrage-pair-selector';
import { mockAssetPrice } from '@/lib/mocks';
import {
  isLoggedInAtom,
  loginWithEVMWalletAtom,
  loginWithSolanaWalletAtom,
} from '@/lib/turnkey/store';
import {
  marginAtom,
  leverageAtom,
  selectedArbitragePairAtom,
  selectedAssetAtom,
} from './position-controls/store';
import { useArbitrageExecution } from '@/hooks/use-arbitrage-execution';
import { useState } from 'react';

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
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const [selectedPair] = useAtom(selectedArbitragePairAtom);
  const [selectedAsset] = useAtom(selectedAssetAtom);
  const [showSuccess, setShowSuccess] = useState(false);

  const { executeArbitrage, isExecuting, error, result } =
    useArbitrageExecution();

  const loginWithEVM = useAtomValue(loginWithEVMWalletAtom);

  const handleConnectWallet = async () => {
    if (onConnectWallet) {
      onConnectWallet();
      return;
    }

    // Default: Try EVM wallet first
    // await loginWithEVM();
  };

  const handleOpenPosition = async () => {
    if (onOpenPosition) {
      onOpenPosition();
      return;
    }

    // Validate inputs
    if (!selectedPair) {
      alert('Please select an arbitrage pair');
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

    // Execute arbitrage
    const executionResult = await executeArbitrage({
      pairId: selectedPair.id,
      margin,
      leverage,
    });

    if (executionResult.success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const canExecute =
    isLoggedIn &&
    selectedPair &&
    margin &&
    parseFloat(margin) > 0 &&
    !isExecuting;

  return (
    <PositionControlsSection
      className={cn(
        'ml-4 lg:w-[400px] xl:w-[450px] lg:shrink-0 h-full overflow-hidden mt-4',
        className
      )}>
      <div className='flex flex-col h-full'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 md:px-6 pt-4 pb-3 border-b border-border-white-10/50 bg-gradient-to-r from-card/60 via-card/50 to-card/60 backdrop-blur-md rounded-t-xl shadow-lg shadow-black/20'>
          <h2 className='text-sm font-medium text-text-primary'>
            POSITION PANEL
          </h2>
          <ChevronRight className='h-4 w-4 text-text-muted-60' />
        </div>

        {/* Asset Price Header */}
        <AssetPriceHeader data={mockAssetPrice} />

        {/* Content */}
        <div className='flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6'>
          {/* Arbitrage Pair Selector */}
          {/* <ArbitragePairSelector /> */}

          {/* Position Size Section */}
          <PositionSizeSection />

          {/* Leverage Section */}
          <LeverageSection />

          {/* Position Details Section */}
          <PositionDetailsSection currentPrice={mockAssetPrice.currentPrice} />

          {/* Trade Details Section */}
          <TradeDetailsSection />

          {/* Error Message */}
          {error && (
            <div className='flex items-start gap-2 p-3 rounded-xl bg-red-900/20 border border-red-500/30'>
              <AlertCircle className='h-4 w-4 text-red-400 mt-0.5 flex-shrink-0' />
              <div className='flex-1'>
                <p className='text-xs font-medium text-red-400'>Error</p>
                <p className='text-xs text-red-300 mt-0.5'>{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {showSuccess && result?.success && (
            <div className='flex items-start gap-2 p-3 rounded-xl bg-green-900/20 border border-green-500/30'>
              <CheckCircle2 className='h-4 w-4 text-green-400 mt-0.5 flex-shrink-0' />
              <div className='flex-1'>
                <p className='text-xs font-medium text-green-400'>Success</p>
                <p className='text-xs text-green-300 mt-0.5'>
                  {result.message || 'Arbitrage position opened successfully'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Wallet Connection / Open Position */}
        <div className='px-4 md:px-6 pb-4 pt-3 border-t border-border-white-10/50 space-y-3 bg-gradient-to-t from-card/40 to-transparent backdrop-blur-sm rounded-b-xl'>
          {isLoggedIn ? (
            <>
              <div className='flex items-center gap-2'>
                <div className='h-2 w-2 rounded-full bg-green-500' />
                <span className='text-xs text-text-muted-60'>
                  Wallet connected
                </span>
              </div>
              <ConnectWalletButton
                onClick={handleOpenPosition}
                size='md'
                fullWidth
                text={isExecuting ? 'EXECUTING...' : 'OPEN POSITION'}
                disabled={!canExecute || isExecuting}
              />
            </>
          ) : (
            <>
              <div className='flex items-center gap-2'>
                <div className='h-2 w-2 rounded-full bg-green-500' />
                <span className='text-xs text-text-muted-60'>
                  Connect your wallet to start trading
                </span>
              </div>
              <ConnectWalletButton
                onClick={handleConnectWallet}
                size='md'
                fullWidth
              />
            </>
          )}
        </div>
      </div>
    </PositionControlsSection>
  );
}
