'use client';

/**
 * Positions Table Section Component
 * Shows positions and closed tabs
 */

import { PositionsTableSection } from './trading-dashboard';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PositionsTable } from './positions/positions-table';
import { usePositions } from '@/hooks';
import { useClosePosition } from '@/hooks/use-close-position';
import { PositionsTableSkeleton } from '@/components/ui/skeletons';
import { ClosePositionModal } from '@/components/ui/close-position-modal';
import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import type { PositionApiResponse } from '@/lib/api/services/positions.service';
import type { ClosePositionResult } from '@/hooks/use-close-position';

interface PositionsTableSectionContentProps {
  className?: string;
}

export function PositionsTableSectionContent({
  className,
}: PositionsTableSectionContentProps) {
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
    (asset: string) => {
      const assetSymbol = asset.split('-')[0];
      const rawPosition = rawPositions.find((p) => p.symbol === assetSymbol);
      if (!rawPosition) {
        console.error(`[close-position] No raw position found for asset: ${assetSymbol}`);
        return;
      }
      setSelectedRawPosition(rawPosition);
      setIsCloseModalOpen(true);
    },
    [rawPositions]
  );

  // Execute the close from the modal's confirm
  const handleConfirmClose = useCallback(
    async (position: PositionApiResponse): Promise<ClosePositionResult> => {
      return closePosition(position);
    },
    [closePosition]
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
        <div className="flex flex-col h-full overflow-hidden py-4">
          {/* Tabs and Actions */}
          <div className="flex items-center justify-between border-b border-border-white-10 px-3 md:px-4 lg:px-5 shrink-0">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveTab('positions')}
                className={cn(
                  'pb-3 text-sm font-medium transition-colors relative',
                  activeTab === 'positions'
                    ? 'text-text-primary'
                    : 'text-text-muted-60 hover:text-text-primary'
                )}
              >
                POSITIONS ({positions.length})
                {activeTab === 'positions' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('closed')}
                className={cn(
                  'pb-3 text-sm font-medium transition-colors relative',
                  activeTab === 'closed'
                    ? 'text-text-primary'
                    : 'text-text-muted-60 hover:text-text-primary'
                )}
              >
                CLOSED
                {activeTab === 'closed' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent" />
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'positions' ? (
              <>
                {error && (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-red-400 text-sm">Error loading positions: {error.message}</p>
                  </div>
                )}
                {!error && (
                  <PositionsTable
                    positions={positions}
                    onClosePosition={handleClosePosition}
                  />
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-text-muted-60 text-sm">No closed positions</p>
              </div>
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
