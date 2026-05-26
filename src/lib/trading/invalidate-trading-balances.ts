/**
 * Refetch exchange + wallet balances and open positions across the UI.
 */

import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export interface TradingWalletAddresses {
  evmAddress: string;
  solanaAddress: string;
}

/**
 * Invalidate all caches that drive margin inputs, position table, and funding wallet display.
 */
export async function invalidateTradingBalances(
  queryClient: QueryClient,
  wallet: TradingWalletAddresses
): Promise<void> {
  const { evmAddress, solanaAddress } = wallet;

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.positions.all }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.positions.open(evmAddress, solanaAddress),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.balance.exchangeHlPac(evmAddress, solanaAddress),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.balance.usdcSolana(solanaAddress),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.balance.usdcBase(evmAddress),
    }),
  ]);
}
