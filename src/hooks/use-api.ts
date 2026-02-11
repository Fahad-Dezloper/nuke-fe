/**
 * Generic API Hook
 *
 * @deprecated Prefer using React Query's useQuery/useMutation directly.
 * This hook is kept for backward compatibility but should be migrated away from.
 *
 * Improvements over the original:
 * - Properly typed args (no `unknown[]`)
 * - Stable callback reference (options are not in useCallback deps)
 * - AbortController is not needed here since individual API calls
 *   should use React Query which handles cancellation.
 */

import { useState, useCallback, useRef } from 'react';
import type { ApiError } from '@/types';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}

interface UseApiReturn<T, TArgs extends unknown[]> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  execute: (...args: TArgs) => Promise<T | null>;
  reset: () => void;
}

/**
 * @deprecated Use React Query's useQuery/useMutation instead.
 */
export function useApi<T = unknown, TArgs extends unknown[] = unknown[]>(
  apiCall: (...args: TArgs) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T, TArgs> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Store options in a ref to avoid recreating the callback on every render
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(
    async (...args: TArgs): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiCall(...args);
        setData(result);
        optionsRef.current.onSuccess?.(result);
        return result;
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError);
        optionsRef.current.onError?.(apiError);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
