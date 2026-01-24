export { PacificaService, pacificaService } from './pacifica.service';
export type {
  CreateMarketOrderRequest,
  CreateLimitOrderRequest,
  CreateOrderResponse,
  PacificaApiResponse,
  SigningData,
  TradingOperationState,
} from './types';

// Export Jotai store atoms
export {
  pacificaTradingStateAtom,
  isPacificaTradingLoadingAtom,
  pacificaTradingErrorAtom,
  lastPacificaTradingActionAtom,
  isPacificaSigningInProgressAtom,
  updatePacificaTradingStateAtom,
  clearPacificaTradingStateAtom,
} from './store';
