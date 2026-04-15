/**
 * useFundExchange — Bridge + deposit (or direct Solana deposit) per exchange
 *
 * - Hyperliquid: Solana USDC → bridge to Arbitrum → HL deposit API
 * - Pacifica: Solana USDC → bridge to Solana (relay) → Pacifica deposit tx
 * - Backpack: Solana USDC → SPL transfer to Backpack deposit address (no bridge)
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getWalletContext } from '@/lib/wallet-context';
import { bridgeService } from '@/lib/bridge/bridge.service';
import { pollBridgeStatus } from '@/lib/bridge/poll-bridge-status';
import { HyperliquidDepositHandler } from '@/lib/bridge/deposit-handlers/hyperliquid.handler';
import { PacificaDepositHandler } from '@/lib/bridge/deposit-handlers/pacifica.handler';
// Backpack funding disabled (display-only demo).
// import { BackpackDepositHandler } from '@/lib/bridge/deposit-handlers/backpack.handler';
import { CHAIN_IDS } from '@/lib/bridge/types';
import type { QuoteRequest } from '@/lib/bridge/types';
import { queryKeys } from '@/lib/query-keys';
import {
  trackBridgeStarted,
  trackBridgeCompleted,
  trackDepositStarted,
  trackDepositCompleted,
  trackDepositFailed,
} from '@/lib/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FundExchange = 'hyperliquid' | 'pacifica';

export type FundStep =
  | 'idle'
  | 'getting-quote'
  | 'signing'
  | 'bridging'
  | 'waiting-bridge'
  | 'depositing'
  | 'success'
  | 'error';

export interface FundExchangeState {
  /** Current step in the funding flow */
  step: FundStep;
  /** Whether the flow is currently running */
  isExecuting: boolean;
  /** Human-readable status message */
  statusMessage: string;
  /** Error message (null if no error) */
  error: string | null;
}

export interface UseFundExchangeReturn extends FundExchangeState {
  /** Start the bridge + deposit flow for a specific exchange */
  fund: (exchange: FundExchange, amountUsd: number) => Promise<void>;
  /** Reset state back to idle */
  reset: () => void;
}

// ─── Handlers (singleton instances) ───────────────────────────────────────────

const hlHandler = new HyperliquidDepositHandler();
const pacHandler = new PacificaDepositHandler();

function getHandler(exchange: FundExchange) {
  if (exchange === 'hyperliquid') return hlHandler;
  return pacHandler;
}

function getExchangeLabel(exchange: FundExchange): string {
  if (exchange === 'hyperliquid') return 'HyperLiquid';
  return 'Pacifica';
}

function getDestinationChainId(exchange: FundExchange): number {
  if (exchange === 'hyperliquid') return CHAIN_IDS.ARBITRUM;
  return CHAIN_IDS.SOLANA;
}

function getChainLabel(exchange: FundExchange): string {
  return exchange === 'hyperliquid' ? 'Arbitrum' : 'Solana';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFundExchange(): UseFundExchangeReturn {
  const { state: turnkeyState } = useTurnkey();
  const queryClient = useQueryClient();
  const isRunningRef = useRef(false);

  const [step, setStep] = useState<FundStep>('idle');
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setIsExecuting(false);
    setStatusMessage('');
    setError(null);
    isRunningRef.current = false;
  }, []);

  const fund = useCallback(
    async (exchange: FundExchange, amountUsd: number) => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      const label = getExchangeLabel(exchange);
      const chainLabel = getChainLabel(exchange);
      const handler = getHandler(exchange);

      setError(null);
      setIsExecuting(true);

      try {
        const wallet = getWalletContext(turnkeyState);
        const recipient =
          exchange === 'hyperliquid' ? wallet.evmAddress : wallet.solanaAddress;

        // Backpack funding disabled (display-only demo).

        // ── Step 1: Get bridge quote ──────────────────────────────
        trackBridgeStarted(exchange, String(amountUsd));
        setStep('getting-quote');
        setStatusMessage(`Getting bridge quote to ${chainLabel}...`);

        const amountSmallestUnit = Math.floor(amountUsd * 1_000_000).toString();

        const quoteRequest: QuoteRequest = {
          destinationChainId: getDestinationChainId(exchange),
          amount: amountSmallestUnit,
          tradeType: 'EXACT_INPUT',
          usePermit: true,
          recipient,
        };

        const quoteResponse = await bridgeService.getQuote(quoteRequest);

        const signatureStep = quoteResponse.steps.find((s) => s.kind === 'signature');
        if (!signatureStep) {
          throw new Error(`No signature step found in bridge quote for ${chainLabel}`);
        }

        const requestId = signatureStep.requestId;

        // ── Step 2: Sign bridge transaction ───────────────────────
        setStep('signing');
        setStatusMessage(`Signing bridge transaction...`);

        const signResult = await handler.signBridgeTransaction(
          signatureStep,
          wallet.evmAddress,
          wallet.organizationId
        );

        // ── Step 3: Execute permit (submit to relay) ──────────────
        setStep('bridging');
        setStatusMessage(`Bridging USDC to ${chainLabel}...`);

        await bridgeService.executePermit({
          signature: signResult.signature,
          kind: signResult.executeKind,
          requestId,
          api: signResult.executeApi,
        });

        // ── Step 4: Wait for bridge finality ──────────────────────
        setStep('waiting-bridge');
        setStatusMessage(`Waiting for bridge confirmation...`);

        await pollBridgeStatus(requestId);

        // ── Step 5: Deposit into exchange ─────────────────────────
        trackBridgeCompleted(exchange, requestId);
        trackDepositStarted(exchange);
        setStep('depositing');
        setStatusMessage(`Depositing USDC into ${label}...`);

        await handler.executeDeposit({
          walletAddress: wallet.evmAddress,
          organizationId: wallet.organizationId,
          bridgeRequestId: requestId,
          solanaRecipientAddress: wallet.solanaAddress,
        });

        // ── Done ──────────────────────────────────────────────────
        trackDepositCompleted(exchange);
        setStep('success');
        setStatusMessage(`Successfully funded ${label}!`);

        await queryClient.invalidateQueries({
          queryKey: queryKeys.balance.exchangeHlPac(wallet.evmAddress, wallet.solanaAddress),
        });

        toast.success(`${label} Funded`, {
          description: `$${amountUsd.toFixed(2)} USDC deposited to ${label}.`,
          duration: 5000,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        trackDepositFailed(exchange, errMsg);
        setStep('error');
        setError(errMsg);
        setStatusMessage(`Failed to fund ${label}`);

        toast.error(`Funding Failed`, {
          description: errMsg,
          duration: 8000,
        });
      } finally {
        setIsExecuting(false);
        isRunningRef.current = false;
      }
    },
    [turnkeyState, queryClient]
  );

  return {
    fund,
    reset,
    step,
    isExecuting,
    statusMessage,
    error,
  };
}
