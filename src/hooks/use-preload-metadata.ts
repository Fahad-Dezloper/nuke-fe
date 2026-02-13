'use client';

/**
 * usePreloadMetadata
 *
 * Pre-warms the in-memory metadata caches for Hyperliquid and Pacifica
 * on first render. These APIs return static data (asset metadata, tick sizes,
 * lot sizes, etc.) that never changes during a session, so we fetch once and
 * cache forever.
 *
 * Call this hook once near the root of the app (e.g. in layout or a provider).
 */

import { useEffect, useRef } from 'react';
import { preloadHyperliquidMeta } from '@/dex/hyperliquid/utils/get-meta';
import { preloadPacificaMeta } from '@/dex/pacifica/utils/get-meta';

export function usePreloadMetadata() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    // Fire all three fetches in parallel — they cache themselves
    Promise.all([
      preloadHyperliquidMeta(),
      preloadPacificaMeta(),
    ]).catch((err) => {
      console.warn('[usePreloadMetadata] Failed to preload metadata:', err);
    });
  }, []);
}
