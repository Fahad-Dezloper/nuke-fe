/**
 * Position Controls Store
 * Jotai atoms for managing position control state (leverage, margin, etc.)
 */

import { atom } from 'jotai';

// Leverage state (1-5x)
export const leverageAtom = atom<number>(3);

// Margin/Position size state (in USD)
export const marginAtom = atom<string>('');

// Currency selection for margin
export const marginCurrencyAtom = atom<string>('USD');
