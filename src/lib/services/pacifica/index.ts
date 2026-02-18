export { PacificaService, pacificaService } from './pacifica.service';
export { BUILDER_CODE, BUILDER_MAX_FEE_RATE, EXPIRY_WINDOW } from '@/constants';

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
