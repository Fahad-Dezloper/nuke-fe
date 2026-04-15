/**
 * Best Pair Override Store
 *
 * Allows the user to pick an alternative long/short pair per asset
 * (e.g. 2nd or 3rd best spread) from the UI.
 *
 * If no override exists for an asset, we fall back to spread APR best pair
 * and then live funding fallback logic.
 */

'use client';

import { atom } from 'jotai';
import type { BestPairResult } from '@/hooks/use-best-pair';

export type BestPairOverrideMap = Partial<Record<string, BestPairResult>>;

export const bestPairOverrideAtom = atom<BestPairOverrideMap>({});

