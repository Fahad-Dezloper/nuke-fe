'use client';

/**
 * Position Controls Section Component
 * Right side panel with position controls
 */

import { ChevronRight } from 'lucide-react';
import { PositionControlsSection } from './trading-dashboard';
import { cn } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/ui/connect-wallet-button';
import { PositionSizeSection } from './position-controls/position-size-section';
import { LeverageSection } from './position-controls/leverage-section';
import { PositionDetailsSection } from './position-controls/position-details-section';
import { TradeDetailsSection } from './position-controls/trade-details-section';
import { AssetPriceHeader } from './position-controls/asset-price-header';

interface PositionControlsSectionContentProps {
  className?: string;
  onConnectWallet?: () => void;
}

export function PositionControlsSectionContent({
  className,
  onConnectWallet,
}: PositionControlsSectionContentProps) {
  // Mock effective APR calculation
  const effectiveAPR = 257.1;

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
        <AssetPriceHeader
          asset='HYPE-PERP'
          assetLogo='/tokens/hype.png'
          currentPrice={43.67}
        />

        {/* Content */}
        <div className='flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6'>
          {/* Position Size Section */}
          <PositionSizeSection />

          {/* Leverage Section */}
          <LeverageSection />

          {/* Position Details Section */}
          <PositionDetailsSection />

          {/* Trade Details Section */}
          <TradeDetailsSection />
        </div>

        {/* Footer - Wallet Connection */}
        <div className='px-4 md:px-6 pb-4 pt-3 border-t border-border-white-10/50 space-y-3 bg-gradient-to-t from-card/40 to-transparent backdrop-blur-sm rounded-b-xl'>
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-green-500' />
            <span className='text-xs text-text-muted-60'>
              Connect your wallet to start trading
            </span>
          </div>
          <ConnectWalletButton
            onClick={onConnectWallet}
            size='md'
            fullWidth
          />
        </div>
      </div>
    </PositionControlsSection>
  );
}
