/**
 * Arbitrage Execution Hook
 *
 * Uses React Query useMutation for proper state management
 * and automatic cleanup of executing state.
 */

'use client';

import { useMutation } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { arbitrageService } from '@/lib/arbitrage';
import { turnkeyStateAtom } from '@/lib/turnkey/store';
import { getWalletContext } from '@/lib/wallet-context';
import type { ArbitrageExecutionResult } from '@/lib/arbitrage';

interface ExecuteArbitrageParams {
  pairId: string;
  margin: string;
  leverage: number;
  price?: string;
}

export interface UseArbitrageExecutionResult {
  executeArbitrage: (params: ExecuteArbitrageParams) => Promise<ArbitrageExecutionResult>;
  isExecuting: boolean;
  error: string | null;
  result: ArbitrageExecutionResult | null;
}

export function useArbitrageExecution(): UseArbitrageExecutionResult {
  const turnkeyState = useAtomValue(turnkeyStateAtom);

  const mutation = useMutation({
    mutationFn: async (params: ExecuteArbitrageParams): Promise<ArbitrageExecutionResult> => {
      // Validate wallet context (shared utility — no more duplication)
      const { evmAddress, solanaAddress, organizationId } = getWalletContext(turnkeyState);

      // Get the pair to determine which wallet goes where
      const pair = arbitrageService.getPair(params.pairId);
      if (!pair) {
        throw new Error(`Arbitrage pair not found: ${params.pairId}`);
      }

      // Get protocol adapters to determine wallet types
      const longAdapter = arbitrageService.getProtocolRegistry().get(pair.longProtocol);
      const shortAdapter = arbitrageService.getProtocolRegistry().get(pair.shortProtocol);

      // Determine wallet addresses based on protocol requirements
      const longWalletType = longAdapter.getRequiredWalletType();
      const shortWalletType = shortAdapter.getRequiredWalletType();
      const longWalletAddress = longWalletType === 'ethereum' ? evmAddress : solanaAddress;
      const shortWalletAddress = shortWalletType === 'ethereum' ? evmAddress : solanaAddress;

      // Execute arbitrage
      return await arbitrageService.executePair({
        pairId: params.pairId,
        margin: params.margin,
        leverage: params.leverage,
        longWalletAddress,
        shortWalletAddress,
        organizationId,
        price: params.price,
        isMarket: true,
      });
    },
  });

  const executeArbitrage = async (params: ExecuteArbitrageParams): Promise<ArbitrageExecutionResult> => {
    try {
      return await mutation.mutateAsync(params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      return {
        success: false,
        pairId: params.pairId,
        error: errorMessage,
      } as ArbitrageExecutionResult;
    }
  };

  return {
    executeArbitrage,
    isExecuting: mutation.isPending,
    error: mutation.error ? (mutation.error instanceof Error ? mutation.error.message : 'Unknown error') : null,
    result: mutation.data ?? null,
  };
}
