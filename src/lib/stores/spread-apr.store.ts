/**
 * Spread APR Store
 * Global Jotai store for 7-day spread APR data
 * This data is fetched once per session (backend CRON updates daily)
 */

import { atom } from 'jotai';
import type { SpreadAprMap } from '@/lib/api/services/apr.service';

/**
 * Spread APR data atom
 * Maps asset symbol -> { longPlatform, shortPlatform, totalSpread, sevenDayApr }
 */
export const spreadAprDataAtom = atom<SpreadAprMap>({});

/**
 * Spread APR loading state atom
 */
export const spreadAprLoadingAtom = atom<boolean>(false);

/**
 * Spread APR error state atom
 */
export const spreadAprErrorAtom = atom<Error | null>(null);
