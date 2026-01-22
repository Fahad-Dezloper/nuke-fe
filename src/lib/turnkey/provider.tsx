/**
 * Turnkey Provider
 * Initializes Turnkey and syncs state with Jotai atoms
 * This replaces the old Context-based provider
 */

'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { initializeTurnkeyAtom } from './store';

export function TurnkeyProvider({ children }: { children: React.ReactNode }) {
  const initialize = useSetAtom(initializeTurnkeyAtom);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      cleanup = await initialize();
    };

    init();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [initialize]);

  return <>{children}</>;
}
