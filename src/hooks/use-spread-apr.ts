/**
 * Spread APR Hook
 *
 * Fetches 7-day spread APR data using React Query.
 * No polling needed — backend CRON updates daily.
 * Syncs into Jotai atoms for global consumption.
 */

'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import {
  spreadAprDataAtom,
  spreadAprLoadingAtom,
  spreadAprErrorAtom,
} from '@/lib/stores/spread-apr.store';
import { aprService } from '@/lib/api/services/apr.service';
import { queryKeys } from '@/lib/query-keys';

/**
 * Hook to fetch spread APR data once per session.
 * Should be called in a provider component high in the tree.
 */
export function useSpreadApr() {
  const setSpreadAprData = useSetAtom(spreadAprDataAtom);
  const setLoading = useSetAtom(spreadAprLoadingAtom);
  const setError = useSetAtom(spreadAprErrorAtom);

  const query = useQuery({
    queryKey: queryKeys.spreadApr.average,
    queryFn: () => aprService.getAverageApr(),
    // APR data is updated daily — keep it fresh for 1 hour
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  // Sync React Query state → Jotai atoms
  useEffect(() => {
    if (query.data) {
      setSpreadAprData(query.data);
    }
  }, [query.data, setSpreadAprData]);

  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  useEffect(() => {
    setError(query.error ?? null);
  }, [query.error, setError]);
}
