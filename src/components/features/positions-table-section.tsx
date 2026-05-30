'use client';

/**
 * Positions Table Section Component
 * Shows positions and closed tabs
 */

import { PositionsTableSection } from './trading-dashboard';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PositionsTable } from './positions/positions-table';
import { ClosedPositionsTable } from './positions/closed-positions-table';
import { usePositions } from '@/hooks';
import { useClosePosition } from '@/hooks/use-close-position';
import { PositionsTableSkeleton } from '@/components/ui/skeletons';
import { ClosePositionModal } from '@/components/ui/close-position-modal';
import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import type { PositionApiResponse } from '@/lib/api/services/positions.service';
import { transformPositionData } from '@/lib/api/services/positions.service';
import { enrichPositionsWithFundingApr } from '@/lib/positions/enrich-positions';
import type { ClosePositionResult } from '@/hooks/use-close-position';
import { phoenixService } from '@/lib/services/phoenix';
import React from 'react';

const MOCK_RAW_POSITIONS: PositionApiResponse[] = [
  {
    symbol: 'SOL',
    opened_at: Date.now() - 36 * 60 * 60 * 1000,
    hyperliquid: {
      symbol: 'SOL',
      size: '12.5000',
      side: 'Long',
      pnl: '45.20',
      funding: '7.10',
      margin: '308.41',
      leverage: 3,
      liquidationPrice: '120.50',
    },
    backpack: {
      symbol: 'SOL',
      size: '12.5000',
      side: 'Short',
      pnl: '10.00',
      funding: '5.35',
      margin: '308.42',
      leverage: 3,
      liquidationPrice: '235.00',
    },
    pacifica: null,
    lighter: null,
    phoenix: null,
  },
  {
    symbol: 'BTC',
    opened_at: Date.now() - 12 * 60 * 60 * 1000,
    hyperliquid: {
      symbol: 'BTC',
      size: '0.0500',
      side: 'Short',
      pnl: '-17.70',
      funding: '13.65',
      margin: '342.50',
      leverage: 5,
      liquidationPrice: '82000.00',
    },
    phoenix: {
      symbol: 'BTC',
      size: '0.0500',
      side: 'Long',
      pnl: '5.40',
      funding: '10.50',
      margin: '342.50',
      leverage: 5,
      liquidationPrice: '55000.00',
    },
    pacifica: null,
    backpack: null,
    lighter: null,
  },
  {
    symbol: 'ETH',
    opened_at: Date.now() - 72 * 60 * 60 * 1000,
    pacifica: {
      symbol: 'ETH',
      size: '1.2000',
      side: 'Short',
      pnl: '-5.00',
      funding: '-2.00',
      margin: '824.00',
      leverage: 2.5,
      liquidationPrice: '58000.00',
    },
    lighter: {
      symbol: 'ETH',
      size: '1.2000',
      side: 'Long',
      pnl: '-3.50',
      funding: '-1.20',
      margin: '824.00',
      leverage: 2.5,
      liquidationPrice: '22000.00',
    },
    hyperliquid: null,
    backpack: null,
    phoenix: null,
  },
];

interface PositionsTableSectionContentProps {
  className?: string;
}

export function PositionsTableSectionContent({ className }: PositionsTableSectionContentProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'closed'>('positions');

  // Close modal state
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedRawPosition, setSelectedRawPosition] = useState<PositionApiResponse | null>(null);

  // Get wallet addresses from Turnkey
  const { state } = useTurnkey();
  const evmAddress = getEVMAddress(state.userWallets) || '';
  const solanaAddress = getSolanaAddress(state.userWallets) || '';
  const organizationId = state.turnkeySubOrgId || '';

  // Fetch positions
  const { positions, rawPositions, loading, error, refetch } = usePositions({
    evmAddress: evmAddress || undefined,
    solanaAddress: solanaAddress || undefined,
    enabled: state.isLoggedIn && !!evmAddress && !!solanaAddress,
  });

  const hasActivePositions = positions.length > 0;

  // Fallback to mock data if no positions are fetched
  const displayPositions = hasActivePositions
    ? positions
    : enrichPositionsWithFundingApr(
        MOCK_RAW_POSITIONS,
        MOCK_RAW_POSITIONS.map(transformPositionData)
      );

  const displayRawPositions = hasActivePositions ? rawPositions : MOCK_RAW_POSITIONS;

  // Close position hook
  const { closePosition } = useClosePosition({
    evmAddress,
    solanaAddress,
    organizationId,
    onSuccess: () => {
      refetch();
    },
  });

  // Open the close-position modal
  const handleClosePosition = useCallback(
    async (asset: string) => {
      const assetSymbol = asset.split('-')[0];
      const rawPosition = displayRawPositions.find((p) => p.symbol === assetSymbol);
      if (!rawPosition) {
        console.error(`[close-position] No raw position found for asset: ${assetSymbol}`);
        return;
      }

      let positionForClose: PositionApiResponse = rawPosition;

      // Aggregated API often omits Phoenix; hydrate from Rise so modal + close include it.
      if (hasActivePositions && !rawPosition.phoenix && solanaAddress) {
        const phxLeg = await phoenixService.fetchOpenPositionLeg(solanaAddress, assetSymbol);
        if (phxLeg) {
          positionForClose = { ...rawPosition, phoenix: phxLeg };
        }
      }

      setSelectedRawPosition(positionForClose);
      setIsCloseModalOpen(true);
    },
    [displayRawPositions, hasActivePositions, solanaAddress]
  );

  // Execute the close from the modal's confirm
  const handleConfirmClose = useCallback(
    async (position: PositionApiResponse): Promise<ClosePositionResult> => {
      if (!hasActivePositions) {
        // Mock successful close process with a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          status: 'success',
          legs: [],
        };
      }
      return closePosition(position);
    },
    [closePosition, hasActivePositions]
  );

  const handleCloseModal = useCallback(() => {
    setIsCloseModalOpen(false);
    setSelectedRawPosition(null);
  }, []);

  const isInitialLoad = loading && positions.length === 0;
  if (isInitialLoad) {
    return <PositionsTableSkeleton className={className} rows={2} />;
  }

  return (
    <>
      <PositionsTableSection className={className}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Tabs and Actions */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 shrink-0 bg-[#121315]/40">
            <div className="flex items-center bg-[#17181C] p-0.5 rounded-lg border border-white/[0.04]">
              <button
                onClick={() => setActiveTab('positions')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer',
                  activeTab === 'positions'
                    ? 'bg-white/[0.06] text-white shadow-xs shadow-black/25'
                    : 'text-white/40 hover:text-white/80'
                )}
              >
                Positions ({displayPositions.length})
              </button>
              <button
                onClick={() => setActiveTab('closed')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer',
                  activeTab === 'closed'
                    ? 'bg-white/[0.06] text-white shadow-xs shadow-black/25'
                    : 'text-white/40 hover:text-white/80'
                )}
              >
                Closed (3)
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 border border-white/[0.06] bg-[#101113]/40 rounded-xl overflow-hidden shadow-2xl">
            {activeTab === 'positions' ? (
              <>
                {error && (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-red-400 text-sm">Error loading positions: {error.message}</p>
                  </div>
                )}
                {!error && (
                  <PositionsTable
                    positions={displayPositions}
                    onClosePosition={handleClosePosition}
                  />
                )}
              </>
            ) : (
              <ClosedPositionsTable />
            )}
          </div>
        </div>
      </PositionsTableSection>

      {/* Close Position Modal */}
      <ClosePositionModal
        isOpen={isCloseModalOpen}
        onClose={handleCloseModal}
        position={selectedRawPosition}
        onConfirmClose={handleConfirmClose}
      />
    </>
  );
}
