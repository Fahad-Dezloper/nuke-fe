/**
 * Bridge Hook
 * React hook for managing bridge operations.
 *
 * Uses the DepositHandler pattern for protocol-specific logic.
 * Uses shared pollBridgeStatus utility (while loop, not recursion).
 * Uses shared wallet validation utility.
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getWalletContext } from '@/lib/wallet-context';
import { getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { bridgeService } from './bridge.service';
import { signPermitWithTurnkey } from './signing';
import { getUSDCBalanceOnBase } from './balance-api';
import { formatUSDCBalance } from './balance';
import { createDefaultDepositHandlerRegistry } from './deposit-handlers';
import { pollBridgeStatus } from './poll-bridge-status';
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
  protocol?: string;
  feePayerAddress?: string;
  solanaRecipient?: string;
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

  const signature = await signPermitWithTurnkey(permitData, walletAddress, organizationId);

  return { signature, executeKind, executeApi };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBridge(options?: UseBridgeOptions): UseBridgeReturn {
  const { state: turnkeyState } = useTurnkey();
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [error, setError] = useState<BridgeError | null>(null);
  const requestIdRef = useRef<string | null>(null);

  // Create registry once (stable across renders)
  const depositHandlerRegistry = useMemo(() => createDefaultDepositHandlerRegistry(), []);

  const isLoading = status !== 'idle' && status !== 'success' && status !== 'error';

  /**
   * Check USDC balance on Base
   */
  const checkBalance = useCallback(async (address: string): Promise<string> => {
    const balance = await getUSDCBalanceOnBase(address as `0x${string}`);
    return formatUSDCBalance(balance);
  }, []);

  /**
   * Execute bridge operation
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

        // ── Step 1: Validate wallet state (shared utility) ────────
        const { evmAddress, organizationId } = getWalletContext(turnkeyState);

        // Resolve Solana address (used by Solana-based protocols)
        const solanaRecipientAddress =
          solanaRecipient || options?.solanaRecipient || getSolanaAddress(turnkeyState.userWallets);

        // ── Step 2: Resolve deposit handler ───────────────────────
        const depositProtocol = protocol || options?.protocol;
        const handler = depositProtocol ? depositHandlerRegistry.get(depositProtocol) : null;

        // ── Step 3: Resolve bridge destination & recipient ────────
        let destinationChainId: number;
        let recipient: string;

        if (handler) {
          destinationChainId = handler.destinationChainId;
          recipient = handler.resolveRecipient({
            walletAddress: evmAddress,
            solanaRecipientAddress,
          });
        } else {
          destinationChainId = CHAIN_IDS.ARBITRUM;
          recipient = evmAddress;
        }

        // ── Step 4: Check balance on Base ─────────────────────────
        const balance = await getUSDCBalanceOnBase(evmAddress as `0x${string}`);
        const amountBigInt = BigInt(amount);

        if (balance < amountBigInt) {
          throw new Error('Insufficient USDC balance on Base');
        }

        // ── Step 5: Get bridge quote ──────────────────────────────
        setStatus('getting-quote');
        const quoteRequest: QuoteRequest = {
          user: evmAddress,
          destinationChainId,
          amount,
          tradeType: 'EXACT_INPUT',
          usePermit: true,
          recipient,
        };

        const quoteResponse = await bridgeService.getQuote(quoteRequest);

        // ── Step 6: Find signature step ───────────────────────────
        const signatureStep = quoteResponse.steps.find((step) => step.kind === 'signature');

        if (!signatureStep) {
          throw new Error('No signature step found in quote response');
        }

        const requestId = signatureStep.requestId;

        // ── Step 7: Sign bridge transaction ───────────────────────
        setStatus('signing-permit');
        let signResult: BridgeSignResult;

        if (handler) {
          signResult = await handler.signBridgeTransaction(
            signatureStep,
            evmAddress,
            organizationId
          );
        } else {
          signResult = await signBridgeDefault(signatureStep, evmAddress, organizationId);
        }

        // ── Step 8: Execute permit ────────────────────────────────
        setStatus('executing-permit');
        await bridgeService.executePermit({
          signature: signResult.signature,
          kind: signResult.executeKind,
          requestId,
          api: signResult.executeApi,
        });

        requestIdRef.current = requestId;

        // ── Step 9: Poll bridge status (shared utility, while loop) ──
        setStatus('waiting-finality');
        await pollBridgeStatus(requestId, {
          onStatusChange: (relayStatus) => {
            const bridgeStatus = mapRelayStatusToBridgeStatus(relayStatus as RelayStatus);
            setStatus(bridgeStatus);
          },
        });

        // ── Step 10: Execute protocol-specific deposit ────────────
        if (handler) {
          try {
            setStatus('depositing');
            const depositResult = await handler.executeDeposit({
              walletAddress: evmAddress,
              organizationId,
              bridgeRequestId: requestId,
              solanaRecipientAddress,
            });

            setStatus('success');
            options?.onSuccess?.(depositResult);
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
            options?.onError?.(bridgeError);
          }
        } else {
          setStatus('success');
          options?.onSuccess?.({ bridgeRequestId: requestId });
        }
      } catch (err) {
        const bridgeError: BridgeError = {
          message: err instanceof Error ? err.message : 'Bridge operation failed',
          details: err,
        };

        setError(bridgeError);
        setStatus('error');
        options?.onError?.(bridgeError);
      }
    },
    [turnkeyState, options, depositHandlerRegistry]
  );

  return {
    status,
    error,
    bridge,
    checkBalance,
    isLoading,
  };
}
