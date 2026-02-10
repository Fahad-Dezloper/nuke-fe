/**
 * Arbitrage Execution Hook
 * Handles executing arbitrage pairs with wallet integration
 */

'use client';

import { useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { arbitrageService } from '@/lib/arbitrage';
import { userWalletsAtom, turnkeySubOrgIdAtom } from '@/lib/turnkey/store';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import type { ArbitrageExecutionResult } from '@/lib/arbitrage';

export interface UseArbitrageExecutionResult {
  executeArbitrage: (params: {
    pairId: string;
    margin: string;
    leverage: number;
    price?: string;
  }) => Promise<ArbitrageExecutionResult>;
  isExecuting: boolean;
  error: string | null;
  result: ArbitrageExecutionResult | null;
}

export function useArbitrageExecution(): UseArbitrageExecutionResult {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArbitrageExecutionResult | null>(null);

  const wallets = useAtomValue(userWalletsAtom);
  const organizationId = useAtomValue(turnkeySubOrgIdAtom);

  const executeArbitrage = useCallback(
    async (params: {
      pairId: string;
      margin: string;
      leverage: number;
      price?: string;
    }): Promise<ArbitrageExecutionResult> => {
      setIsExecuting(true);
      setError(null);
      setResult(null);

      try {
        // Validate wallets
        if (!wallets || wallets.length === 0) {
          throw new Error('No wallets found. Please connect your wallet.');
        }

        if (!organizationId) {
          throw new Error('No organization ID found. Please reconnect your wallet.');
        }

        // Get wallet addresses
        const evmAddress = getEVMAddress(wallets);
        const solanaAddress = getSolanaAddress(wallets);

        if (!evmAddress) {
          throw new Error(
            'Ethereum wallet not found. Please ensure you have an Ethereum wallet connected.'
          );
        }

        if (!solanaAddress) {
          throw new Error(
            'Solana wallet not found. Please ensure you have a Solana wallet connected.'
          );
        }

        // Get the pair to determine which wallet goes where
        const pair = arbitrageService.getPair(params.pairId);
        if (!pair) {
          throw new Error(`Arbitrage pair not found: ${params.pairId}`);
        }

        // Get protocol adapters to determine wallet types
        const longAdapter = arbitrageService.getProtocolRegistry().getAdapter(pair.longProtocol);
        const shortAdapter = arbitrageService.getProtocolRegistry().getAdapter(pair.shortProtocol);

        if (!longAdapter || !shortAdapter) {
          throw new Error('Protocol adapters not found');
        }

        // Determine wallet addresses based on protocol requirements
        const longWalletType = longAdapter.getRequiredWalletType();
        const shortWalletType = shortAdapter.getRequiredWalletType();

        const longWalletAddress = longWalletType === 'ethereum' ? evmAddress : solanaAddress;
        const shortWalletAddress = shortWalletType === 'ethereum' ? evmAddress : solanaAddress;

        // Execute arbitrage
        const executionResult = await arbitrageService.executePair({
          pairId: params.pairId,
          margin: params.margin,
          leverage: params.leverage,
          longWalletAddress,
          shortWalletAddress,
          organizationId,
          price: params.price,
          isMarket: true,
        });

        setResult(executionResult);
        setIsExecuting(false);

        if (!executionResult.success) {
          setError(executionResult.error || 'Arbitrage execution failed');
        }

        return executionResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setIsExecuting(false);

        const errorResult: ArbitrageExecutionResult = {
          success: false,
          pairId: params.pairId,
          error: errorMessage,
        };

        setResult(errorResult);
        return errorResult;
      }
    },
    [wallets, organizationId]
  );

  return {
    executeArbitrage,
    isExecuting,
    error,
    result,
  };
}
