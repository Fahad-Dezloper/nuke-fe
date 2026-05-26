'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePositions } from '@/hooks';
import { useClosePosition } from '@/hooks/use-close-position';
import { PositionsTableSkeleton } from '@/components/ui/skeletons';
import { ClosePositionModal } from '@/components/ui/close-position-modal';
import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import type { PositionApiResponse } from '@/lib/api/services/positions.service';
import type { ClosePositionResult } from '@/hooks/use-close-position';
import { phoenixService } from '@/lib/services/phoenix';
import { MobilePositionsList } from './mobile-positions-list';

export function MobilePositionsPanel() {
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
    onSuccess: () => void refetch(),
  });

  const handleClosePosition = useCallback(
    async (asset: string) => {
      const assetSymbol = asset.split('-')[0];
      const rawPosition = rawPositions.find((p) => p.symbol === assetSymbol);
      if (!rawPosition) return;

      let positionForClose: PositionApiResponse = rawPosition;
      if (!rawPosition.phoenix && solanaAddress) {
        const phxLeg = await phoenixService.fetchOpenPositionLeg(solanaAddress, assetSymbol);
        if (phxLeg) positionForClose = { ...rawPosition, phoenix: phxLeg };
      }

      setSelectedRawPosition(positionForClose);
      setIsCloseModalOpen(true);
    },
    [rawPositions, solanaAddress]
  );

  const handleConfirmClose = useCallback(
    async (position: PositionApiResponse): Promise<ClosePositionResult> => closePosition(position),
    [closePosition]
  );

  if (loading && positions.length === 0) {
    return <PositionsTableSkeleton className="h-full" rows={2} />;
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 border-b border-border-white-10">
          {(['positions', 'closed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide touch-manipulation',
                activeTab === tab
                  ? 'border-b-2 border-accent text-text-primary'
                  : 'text-text-muted-60'
              )}
            >
              {tab === 'positions' ? `Open (${positions.length})` : 'Closed'}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {error && (
            <p className="p-4 text-center text-sm text-red-400">Error: {error.message}</p>
          )}
          {!error && activeTab === 'positions' && (
            <MobilePositionsList positions={positions} onClosePosition={handleClosePosition} />
          )}
          {!error && activeTab === 'closed' && (
            <div className="flex flex-1 items-center justify-center p-8">
              <p className="text-sm text-text-muted-60">No closed positions</p>
            </div>
          )}
        </div>
      </div>

      <ClosePositionModal
        isOpen={isCloseModalOpen}
        onClose={() => {
          setIsCloseModalOpen(false);
          setSelectedRawPosition(null);
        }}
        position={selectedRawPosition}
        onConfirmClose={handleConfirmClose}
      />
    </>
  );
}
