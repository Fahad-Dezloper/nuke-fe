import { atom } from 'jotai';
import type { TradingOperationState } from './types';

const initialTradingState: TradingOperationState = {
  isLoading: false,
  error: null,
  lastAction: null,
  signingInProgress: false,
};

export const tradingStateAtom = atom<TradingOperationState>(initialTradingState);

export const isTradingLoadingAtom = atom((get) => get(tradingStateAtom).isLoading);
export const tradingErrorAtom = atom((get) => get(tradingStateAtom).error);
export const lastTradingActionAtom = atom((get) => get(tradingStateAtom).lastAction);
export const isSigningInProgressAtom = atom((get) => get(tradingStateAtom).signingInProgress);

export const updateTradingStateAtom = atom(
  null,
  (_get, set, update: Partial<TradingOperationState>) => {
    set(tradingStateAtom, (prev) => ({ ...prev, ...update }));
  }
);

export const clearTradingStateAtom = atom(null, (_get, set) => {
  set(tradingStateAtom, initialTradingState);
});
