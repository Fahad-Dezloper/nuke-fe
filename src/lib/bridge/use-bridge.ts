/**
 * Bridge Hook
 * React hook for managing bridge operations
 *
 * Uses the DepositHandler pattern for protocol-specific logic.
 * Adding a new protocol requires only creating a new DepositHandler
 * and registering it — no changes to this file.
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { bridgeService } from './bridge.service';
import { signPermitWithTurnkey } from './signing';
import {
  getUSDCBalanceOnBase,
  formatUSDCBalance,
} from './balance';
import { createDefaultDepositHandlerRegistry } from './deposit-handlers';
import type { BridgeSignResult } from './deposit-handlers';
import type {
  BridgeStatus,
  BridgeError,
  BridgeStep,
  QuoteRequest,
  PermitData,
  RelayStatus,
} from './types';
import { CHAIN_IDS } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseBridgeOptions {
  onSuccess?: (result: unknown) => void;
  onError?: (error: BridgeError) => void;
  protocol?: string; // Protocol to deposit to after bridge
  feePayerAddress?: string; // Fee payer address for deposit (if applicable)
  solanaRecipient?: string; // Solana recipient address (for Solana-based protocols)
}

interface UseBridgeReturn {
  status: BridgeStatus;
  error: BridgeError | null;
  bridge: (
    amount: string,
    protocol?: string,
    feePayerAddress?: string,
    solanaRecipient?: string
  ) => Promise<void>;
  checkBalance: (address: string) => Promise<string>;
  isLoading: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map Relay status to our bridge status
 */
function mapRelayStatusToBridgeStatus(relayStatus: RelayStatus): BridgeStatus {
  switch (relayStatus) {
    case 'waiting':
    case 'pending':
    case 'submitted':
    case 'delayed':
      return 'waiting-finality';
    case 'success':
      return 'success';
    case 'refunded':
    case 'failure':
      return 'error';
    default:
      return 'waiting-finality';
  }
}

/**
 * Default bridge signing for when no deposit handler is registered.
 * Uses EIP-2612 Permit (standard Arbitrum bridge).
 */
async function signBridgeDefault(
  signatureStep: BridgeStep,
  walletAddress: string,
  organizationId: string
): Promise<BridgeSignResult> {
  const postBody = signatureStep.items[0]?.data?.post?.body;
  const executeKind = postBody?.kind || 'PERMIT';
  const executeApi = postBody?.api || 'relay';

  const permitData = signatureStep.items[0]?.data as PermitData;
  if (!permitData) {
    throw new Error('Permit data not found in signature step');
  }

  const signature = await signPermitWithTurnkey(
    permitData,
    walletAddress,
    organizationId
  );

  return { signature, executeKind, executeApi };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook for bridge operations
 *
 * Orchestrates the fund-leg flow:
 * 1. Validate wallet state
 * 2. Check USDC balance on Base
 * 3. Get bridge quote
 * 4. Sign bridge transaction (protocol-specific via DepositHandler)
 * 5. Execute bridge permit
 * 6. Poll for bridge completion
 * 7. Execute protocol-specific deposit (via DepositHandler)
 */
export function useBridge(options?: UseBridgeOptions): UseBridgeReturn {
  const { state: turnkeyState } = useTurnkey();
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [error, setError] = useState<BridgeError | null>(null);
  const requestIdRef = useRef<string | null>(null);

  // Create registry once (stable across renders)
  const depositHandlerRegistry = useMemo(() => createDefaultDepositHandlerRegistry(), []);

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
   *
   * This is the main orchestrator function. Protocol-specific logic
   * is delegated to the appropriate DepositHandler.
   */
  const bridge = useCallback(
    async (
      amount: string,
      protocol?: string,
      feePayerAddress?: string,
      solanaRecipient?: string
    ) => {
      try {
        setError(null);
        setStatus('checking-balance');

        // ── Step 1: Validate Turnkey state ──────────────────────────────
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

        // ── Step 2: Get wallet addresses ────────────────────────────────
        const walletAddress = getEVMAddress(wallets);
        if (!walletAddress) {
          throw new Error('No EVM wallet address found');
        }

        // Resolve Solana address (used by Solana-based protocols)
        const solanaRecipientAddress =
          solanaRecipient || options?.solanaRecipient || getSolanaAddress(wallets);

        // ── Step 3: Resolve deposit handler ─────────────────────────────
        const depositProtocol = protocol || options?.protocol;
        const handler = depositProtocol
          ? depositHandlerRegistry.get(depositProtocol)
          : null;

        // ── Step 4: Resolve bridge destination & recipient ──────────────
        let destinationChainId: number;
        let recipient: string;

        if (handler) {
          destinationChainId = handler.destinationChainId;
          recipient = handler.resolveRecipient({
            walletAddress,
            solanaRecipientAddress,
          });
        } else {
          // Default: bridge to Arbitrum, recipient is EVM address
          destinationChainId = CHAIN_IDS.ARBITRUM;
          recipient = walletAddress;
        }

        // ── Step 5: Check balance on Base ───────────────────────────────
        const balance = await getUSDCBalanceOnBase(walletAddress as `0x${string}`);
        const amountBigInt = BigInt(amount);

        if (balance < amountBigInt) {
          throw new Error('Insufficient USDC balance on Base');
        }

        // ── Step 6: Get bridge quote ────────────────────────────────────
        setStatus('getting-quote');
        const quoteRequest: QuoteRequest = {
          user: walletAddress,
          destinationChainId,
          amount,
          tradeType: 'EXACT_INPUT',
          usePermit: true,
          recipient,
        };

        const quoteResponse = await bridgeService.getQuote(quoteRequest);

        // ── Step 7: Find signature step ─────────────────────────────────
        const signatureStep = quoteResponse.steps.find(
          (step) => step.kind === 'signature'
        );

        if (!signatureStep) {
          throw new Error('No signature step found in quote response');
        }

        const requestId = signatureStep.requestId;

        // ── Step 8: Sign bridge transaction ─────────────────────────────
        setStatus('signing-permit');
        let signResult: BridgeSignResult;

        if (handler) {
          // Protocol-specific signing via handler
          signResult = await handler.signBridgeTransaction(
            signatureStep,
            walletAddress,
            turnkeyState.turnkeySubOrgId
          );
        } else {
          // Default: EIP-2612 Permit signing
          signResult = await signBridgeDefault(
            signatureStep,
            walletAddress,
            turnkeyState.turnkeySubOrgId
          );
        }

        // ── Step 9: Execute permit ──────────────────────────────────────
        setStatus('executing-permit');
        await bridgeService.executePermit({
          signature: signResult.signature,
          kind: signResult.executeKind,
          requestId,
          api: signResult.executeApi,
        });

        // Store requestId for status polling
        requestIdRef.current = requestId;

        // ── Step 10: Poll bridge status ─────────────────────────────────
        setStatus('waiting-finality');
        await pollBridgeStatus(requestId);

        // ── Step 11: Execute protocol-specific deposit ──────────────────
        if (handler) {
          try {
            setStatus('depositing');
            const depositResult = await handler.executeDeposit({
              walletAddress,
              organizationId: turnkeyState.turnkeySubOrgId,
              bridgeRequestId: requestId,
              solanaRecipientAddress,
            });

            setStatus('success');
            if (options?.onSuccess) {
              options.onSuccess(depositResult);
            }
          } catch (depositError) {
            const bridgeError: BridgeError = {
              message:
                depositError instanceof Error
                  ? depositError.message
                  : `${depositProtocol} deposit failed`,
              details: depositError,
            };
            setError(bridgeError);
            setStatus('error');
            if (options?.onError) {
              options.onError(bridgeError);
            }
          }
        } else {
          // No deposit handler — bridge-only completed successfully
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
    [turnkeyState, options, pollBridgeStatus, depositHandlerRegistry]
  );

  return {
    status,
    error,
    bridge,
    checkBalance,
    isLoading,
  };
}
