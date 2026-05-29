/**
 * Withdrawal module — client-orchestrated (mirrors useFundExchange).
 */

export type {
  WithdrawalExchange,
  WithdrawPhase,
  StartWithdrawalParams,
} from './types';

export { bridgeHyperliquidToSolana, withdrawFromPacifica, withdrawFromPhoenix } from './client-withdraw';

export { useWithdrawal } from './use-withdrawal';
export type { UseWithdrawalReturn } from './use-withdrawal';
