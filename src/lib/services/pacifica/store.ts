import { atom } from 'jotai';
import type { TradingOperationState } from './types';

const initialTradingState: TradingOperationState = {
  isLoading: false,
  error: null,
  lastAction: null,
  signingInProgress: false,
};

export const pacificaTradingStateAtom = atom<TradingOperationState>(initialTradingState);

export const isPacificaTradingLoadingAtom = atom((get) => get(pacificaTradingStateAtom).isLoading);

export const pacificaTradingErrorAtom = atom((get) => get(pacificaTradingStateAtom).error);

export const lastPacificaTradingActionAtom = atom(
  (get) => get(pacificaTradingStateAtom).lastAction
);

export const isPacificaSigningInProgressAtom = atom(
  (get) => get(pacificaTradingStateAtom).signingInProgress
);

export const updatePacificaTradingStateAtom = atom(
  null,
  (_get, set, update: Partial<TradingOperationState>) => {
    set(pacificaTradingStateAtom, (prev) => ({ ...prev, ...update }));
  }
);

export const clearPacificaTradingStateAtom = atom(null, (_get, set) => {
  set(pacificaTradingStateAtom, initialTradingState);
});
