'use client';

/**
 * Loading Overlay Component
 * Shows loading modals based on Turnkey state
 */

import { useTurnkey } from '@/lib/turnkey';
import { LoadingModal } from '@/components/ui/loading-modal';

export function LoadingOverlay() {
  const { state } = useTurnkey();

  return (
    <>
      {state.isLoggingIn && <LoadingModal isOpen={true} type="login" />}
      {state.isCreatingWallet && <LoadingModal isOpen={true} type="wallet-creation" />}
    </>
  );
}
