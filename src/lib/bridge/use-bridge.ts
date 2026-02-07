/**
 * Bridge Hook
 * React hook for managing bridge operations
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { bridgeService } from './bridge.service';
import { depositService } from './deposit.service';
import { pacificaDepositService } from './pacifica-deposit.service';
import { signPermitWithTurnkey } from './signing';
import { signTransferWithAuthorizationWithTurnkey } from './solana-signing';
import {
  getUSDCBalanceOnBase,
  formatUSDCBalance,
  getUSDCBalanceOnArbitrum,
  formatUSDCBalanceArbitrum,
} from './balance';
import {
  getUSDCBalanceOnSolana,
  formatUSDCBalanceSolana,
  signAndSubmitPacificaDeposit,
} from './solana-utils';
import { createUsdcPermit, signUsdcPermit } from './usdc-permit';
import type {
  BridgeStatus,
  BridgeError,
  QuoteRequest,
  PermitData,
  TransferWithAuthorizationData,
  RelayStatus,
} from './types';
import { CHAIN_IDS, MIN_DEPOSIT_AMOUNT, PACIFICA_GAS_REIMBURSEMENT } from './types';
import { HYPERLIQUID_ROUTER_CONTRACT } from '@/constants';

interface UseBridgeOptions {
  onSuccess?: (result: unknown) => void;
  onError?: (error: BridgeError) => void;
  protocol?: 'hyperliquid' | 'pacifica'; // Protocol to deposit to after bridge
  feePayerAddress?: string; // Fee payer address for deposit (required if protocol is provided)
  solanaRecipient?: string; // Solana recipient address (required for Solana bridge)
}

interface UseBridgeReturn {
  status: BridgeStatus;
  error: BridgeError | null;
  bridge: (
    amount: string,
    protocol?: 'hyperliquid' | 'pacifica',
    feePayerAddress?: string,
    solanaRecipient?: string
  ) => Promise<void>;
  checkBalance: (address: string) => Promise<string>;
  isLoading: boolean;
}

/**
 * Hook for bridge operations
 */
/**
 * Map Relay status to our bridge status
 */
function mapRelayStatusToBridgeStatus(relayStatus: RelayStatus): BridgeStatus {
  switch (relayStatus) {
    case 'waiting':
      return 'waiting-finality';
    case 'pending':
      return 'waiting-finality';
    case 'submitted':
      return 'waiting-finality';
    case 'success':
      return 'success';
    case 'delayed':
      return 'waiting-finality';
    case 'refunded':
      return 'error';
    case 'failure':
      return 'error';
    default:
      return 'waiting-finality';
  }
}

export function useBridge(options?: UseBridgeOptions): UseBridgeReturn {
  const { state: turnkeyState } = useTurnkey();
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [error, setError] = useState<BridgeError | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const isLoading = status !== 'idle' && status !== 'success' && status !== 'error';

  /**
   * Poll bridge status until completion
   */
  const pollBridgeStatus = useCallback(
    async (requestId: string) => {
      const pollInterval = 3000; // Poll every 3 seconds
      const maxPollTime = 300000; // Max 5 minutes
      const startTime = Date.now();

      const poll = async (): Promise<void> => {
        try {
          // Check timeout
          if (Date.now() - startTime >= maxPollTime) {
            const bridgeError: BridgeError = {
              message: 'Bridge status check timed out',
            };
            setError(bridgeError);
            setStatus('error');
            if (options?.onError) {
              options.onError(bridgeError);
            }
            return;
          }

          const statusResponse = await bridgeService.getStatus(requestId);
          const bridgeStatus = mapRelayStatusToBridgeStatus(statusResponse.status);

          setStatus(bridgeStatus);

          if (bridgeStatus === 'success') {
            // Bridge completed successfully - return to continue with deposit flow
            return;
          }

          if (bridgeStatus === 'error') {
            // Stop polling on error
            const bridgeError: BridgeError = {
              message: statusResponse.details || 'Bridge transaction failed',
              details: statusResponse,
            };
            setError(bridgeError);
            if (options?.onError) {
              options.onError(bridgeError);
            }
            return;
          }

          // Continue polling - wait and call again
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          await poll();
        } catch (err) {
          // On error, continue polling (might be temporary network issue)
          console.error('Error polling bridge status:', err);

          // Check timeout before continuing
          if (Date.now() - startTime >= maxPollTime) {
            const bridgeError: BridgeError = {
              message: err instanceof Error ? err.message : 'Failed to check bridge status',
              details: err,
            };
            setError(bridgeError);
            setStatus('error');
            if (options?.onError) {
              options.onError(bridgeError);
            }
            return;
          }

          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          await poll();
        }
      };

      // Start polling
      await poll();
    },
    [options]
  );

  /**
   * Check USDC balance on Base
   */
  const checkBalance = useCallback(async (address: string): Promise<string> => {
    try {
      const balance = await getUSDCBalanceOnBase(address as `0x${string}`);
      return formatUSDCBalance(balance);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check balance';
      throw new Error(errorMessage);
    }
  }, []);

  /**
   * Execute bridge operation
   */
  const bridge = useCallback(
    async (
      amount: string,
      protocol?: 'hyperliquid' | 'pacifica',
      feePayerAddress?: string,
      solanaRecipient?: string
    ) => {
      try {
        setError(null);
        setStatus('checking-balance');

        // Validate Turnkey state
        if (!turnkeyState.isLoggedIn) {
          throw new Error('Please connect your wallet first');
        }

        if (!turnkeyState.turnkeySubOrgId) {
          throw new Error('Turnkey organization not found');
        }

        const wallets = turnkeyState.userWallets;
        if (!wallets || wallets.length === 0) {
          throw new Error('No wallets found');
        }

        // Get the first EVM wallet address
        const walletAddress = getEVMAddress(wallets);
        if (!walletAddress) {
          throw new Error('No EVM wallet address found');
        }

        // // Get Solana address if bridging to Solana
        const isSolanaBridge = protocol === 'pacifica';
        let solanaRecipientAddress: string | undefined;
        if (isSolanaBridge) {
          solanaRecipientAddress =
            solanaRecipient || options?.solanaRecipient || getSolanaAddress(wallets);
          if (!solanaRecipientAddress) {
            throw new Error(
              'No Solana wallet address found. Please ensure you have a Solana wallet connected.'
            );
          }
        }

        // Check balance
        const balance = await getUSDCBalanceOnBase(walletAddress as `0x${string}`);
        const amountBigInt = BigInt(amount);

        if (balance < amountBigInt) {
          throw new Error('Insufficient USDC balance on Base');
        }

        // Determine destination chain based on protocol
        // Hyperliquid uses Arbitrum, Pacifica uses Solana
        const destinationChainId = isSolanaBridge ? CHAIN_IDS.SOLANA : CHAIN_IDS.ARBITRUM;
        const recipient = isSolanaBridge ? solanaRecipientAddress! : walletAddress;

        // Step 1: Get Quote
        setStatus('getting-quote');
        const quoteRequest: QuoteRequest = {
          user: walletAddress,
          destinationChainId: destinationChainId,
          amount: amount,
          tradeType: 'EXACT_INPUT',
          usePermit: true,
          recipient: recipient,
        };

        const quoteResponse = await bridgeService.getQuote(quoteRequest);

        // Step 2: Find signature step
        const signatureStep = quoteResponse.steps.find((step) => step.kind === 'signature');

        if (!signatureStep) {
          throw new Error('No signature step found in quote response');
        }

        const requestId = signatureStep.requestId;

        // Step 3: Sign based on destination chain
        setStatus('signing-permit');
        let signature: string;

        // Extract execute parameters from post.body in quote response
        const postBody = signatureStep.items[0]?.data?.post?.body;
        const executeKind = postBody?.kind || (isSolanaBridge ? 'eip3009' : 'PERMIT');
        const executeApi = postBody?.api || (isSolanaBridge ? 'swap' : 'relay');

        if (isSolanaBridge) {

          debugger;
          // Solana uses EIP-3009 TransferWithAuthorization
          // Signature data is nested in data.sign
          const signData = signatureStep.items[0]?.data?.sign as TransferWithAuthorizationData;

          if (!signData) {
            throw new Error('TransferWithAuthorization data not found in signature step');
          }

          signature = await signTransferWithAuthorizationWithTurnkey(
            signData,
            walletAddress,
            turnkeyState.turnkeySubOrgId
          );
        } else {
          // Arbitrum uses EIP-2612 Permit
          const permitData = signatureStep.items[0]?.data as PermitData;

          if (!permitData) {
            throw new Error('Permit data not found in signature step');
          }

          signature = await signPermitWithTurnkey(
            permitData,
            walletAddress,
            turnkeyState.turnkeySubOrgId
          );
        }

        // Step 4: Execute Permit/Authorization
        setStatus('executing-permit');
        await bridgeService.executePermit({
          signature,
          kind: executeKind,
          requestId,
          api: executeApi,
        });

        // Store requestId for status polling
        requestIdRef.current = requestId;

        // Step 5: Start polling for bridge status
        setStatus('waiting-finality');
        await pollBridgeStatus(requestId);

        // Step 6: Handle protocol-specific deposit
        const depositProtocol = protocol || options?.protocol;

        if (depositProtocol === 'hyperliquid') {
          // Hyperliquid deposit flow (Base → Arbitrum → Hyperliquid)
          try {
            setStatus('depositing');
            const arbitrumBalance = await getUSDCBalanceOnArbitrum(walletAddress as `0x${string}`);

            // Check minimum deposit amount
            if (arbitrumBalance < BigInt(MIN_DEPOSIT_AMOUNT)) {
              throw new Error(
                `Insufficient balance for deposit. Minimum is ${MIN_DEPOSIT_AMOUNT / 1_000_000} USDC, but balance is ${formatUSDCBalanceArbitrum(arbitrumBalance)} USDC`
              );
            }

            // Convert balance to USDC amount string for permit
            const balanceInUSDC = formatUSDCBalanceArbitrum(arbitrumBalance);
            const spenderAddress = HYPERLIQUID_ROUTER_CONTRACT;

            // Create permit data
            const permitResult = await createUsdcPermit(
              balanceInUSDC,
              walletAddress,
              spenderAddress
            );

            if (!permitResult.success || !permitResult.typedData) {
              throw new Error(permitResult.error || 'Failed to create USDC permit');
            }

            // Sign permit
            const signatureResult = await signUsdcPermit(
              permitResult.typedData,
              walletAddress,
              turnkeyState.turnkeySubOrgId
            );

            if (!signatureResult.success || !signatureResult.signature) {
              throw new Error(signatureResult.error || 'Failed to sign USDC permit');
            }

            // Submit deposit to Hyperliquid
            const txHash = await depositService.deposit({
              amount: arbitrumBalance.toString(),
              userAddress: walletAddress,
              permit: signatureResult.signature,
            });

            // Deposit successful
            setStatus('success');
            if (options?.onSuccess) {
              options.onSuccess({ txHash, bridgeRequestId: requestId, protocol: 'hyperliquid' });
            }
          } catch (depositError) {
            const bridgeError: BridgeError = {
              message:
                depositError instanceof Error ? depositError.message : 'Hyperliquid deposit failed',
              details: depositError,
            };
            setError(bridgeError);
            setStatus('error');
            if (options?.onError) {
              options.onError(bridgeError);
            }
          }
        } else if (depositProtocol === 'pacifica') {
          // Pacifica deposit flow (Base → Solana → Pacifica)
          try {
            setStatus('depositing');

            // Get user's Solana wallet address
            const userSolanaAddress = solanaRecipientAddress!;

            // Fetch USDC balance on Solana
            const solanaBalance = await getUSDCBalanceOnSolana(userSolanaAddress);

            // Check minimum deposit amount (must cover gas reimbursement + minimum deposit)
            const minRequired = BigInt(MIN_DEPOSIT_AMOUNT) + BigInt(PACIFICA_GAS_REIMBURSEMENT);
            if (solanaBalance < minRequired) {
              throw new Error(
                `Insufficient balance for Pacifica deposit. Need at least ${formatUSDCBalanceSolana(minRequired)} USDC (including 0.2 USDC gas reimbursement), but balance is ${formatUSDCBalanceSolana(solanaBalance)} USDC`
              );
            }

            // Get partially signed transaction from backend
            const partiallySignedTx = await pacificaDepositService.getPartiallySignedTransaction({
              user_address: userSolanaAddress,
              amount: solanaBalance.toString(),
            });

            // Sign with user's wallet and submit to Solana
            const txSignature = await signAndSubmitPacificaDeposit(
              partiallySignedTx,
              userSolanaAddress,
              turnkeyState.turnkeySubOrgId
            );

            // Deposit successful
            setStatus('success');
            if (options?.onSuccess) {
              options.onSuccess({
                txHash: txSignature,
                bridgeRequestId: requestId,
                protocol: 'pacifica',
              });
            }
          } catch (depositError) {
            const bridgeError: BridgeError = {
              message:
                depositError instanceof Error ? depositError.message : 'Pacifica deposit failed',
              details: depositError,
            };
            setError(bridgeError);
            setStatus('error');
            if (options?.onError) {
              options.onError(bridgeError);
            }
          }
        } else {
          // No deposit needed, bridge completed successfully
          setStatus('success');
          if (options?.onSuccess) {
            options.onSuccess({ bridgeRequestId: requestId });
          }
        }
      } catch (err) {
        const bridgeError: BridgeError = {
          message: err instanceof Error ? err.message : 'Bridge operation failed',
          details: err,
        };

        setError(bridgeError);
        setStatus('error');

        if (options?.onError) {
          options.onError(bridgeError);
        }
      }
    },
    [turnkeyState, options, pollBridgeStatus]
  );

  return {
    status,
    error,
    bridge,
    checkBalance,
    isLoading,
  };
}
