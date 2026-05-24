'use client';

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

export function PositionsTableSectionContent({ className }: PositionsTableSectionContentProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'closed'>('positions');

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedRawPosition, setSelectedRawPosition] = useState<PositionApiResponse | null>(null);

  const { state } = useTurnkey();
  const evmAddress = getEVMAddress(state.userWallets) || '';
  const solanaAddress = getSolanaAddress(state.userWallets) || '';
  const organizationId = state.turnkeySubOrgId || '';

  const { positions, rawPositions, loading, error, refetch } = usePositions({
    evmAddress: evmAddress || undefined,
    solanaAddress: solanaAddress || undefined,
    enabled: state.isLoggedIn && !!evmAddress && !!solanaAddress,
  });

  const { closePosition } = useClosePosition({
    evmAddress,
    solanaAddress,
    organizationId,
    onSuccess: () => {
      refetch();
    },
  });

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
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-1 panel-header shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('positions')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                activeTab === 'positions'
                  ? 'bg-secondary text-text-primary'
                  : 'text-text-muted-60 hover:text-text-primary'
              )}
            >
              Positions ({positions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('closed')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                activeTab === 'closed'
                  ? 'bg-secondary text-text-primary'
                  : 'text-text-muted-60 hover:text-text-primary'
              )}
            >
              Closed
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'positions' ? (
              <>
                {error && (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-red text-sm">Error loading positions: {error.message}</p>
                  </div>
                )}
                {!error && (
                  <PositionsTable positions={positions} onClosePosition={handleClosePosition} />
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

      <ClosePositionModal
        isOpen={isCloseModalOpen}
        onClose={handleCloseModal}
        position={selectedRawPosition}
        onConfirmClose={handleConfirmClose}
      />
    </>
  );
}
