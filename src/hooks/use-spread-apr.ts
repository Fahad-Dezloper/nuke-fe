/**
 * Spread APR Hook
 * Fetches 7-day spread APR data once on mount and stores in global state
 * No polling needed - backend CRON updates daily
 */

import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import {
  spreadAprDataAtom,
  spreadAprLoadingAtom,
  spreadAprErrorAtom,
} from '@/lib/stores/spread-apr.store';
import { aprService } from '@/lib/api/services/apr.service';

/**
 * Hook to fetch spread APR data once
 * Should be called in a provider component high in the tree
 */
export function useSpreadApr() {
  const setSpreadAprData = useSetAtom(spreadAprDataAtom);
  const setLoading = useSetAtom(spreadAprLoadingAtom);
  const setError = useSetAtom(spreadAprErrorAtom);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once per session
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchApr = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await aprService.getAverageApr();
        setSpreadAprData(data);
      } catch (error) {
        console.error('Error fetching spread APR:', error);
        setError(error instanceof Error ? error : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchApr();
  }, []); // Empty deps - fetch once on mount
}
