/**
 * useFundExchange — Bridge + deposit (or direct Solana deposit) per exchange
 *
 * - Hyperliquid: Solana USDC → bridge to Arbitrum → HL deposit API
 * - Phoenix: direct Solana USDC → Phoenix deposit (Rise `buildDepositIxs`, Turnkey-signed)
 * - Lighter: Solana USDC → bridge to **Ethereum mainnet** → `POST /lighter/deposit` (see
 *   LIGHTER_DEPOSIT_FE_INTEGRATION.md) → then poll for L2 account + WASM + L1 `changePubKey` when keys missing.
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
import { PhoenixDepositHandler } from '@/lib/bridge/deposit-handlers/phoenix.handler';
import { LighterDepositHandler } from '@/lib/bridge/deposit-handlers/lighter.handler';
import { getLighterL2Credentials } from '@/lib/services/lighter/lighter-credentials';
import { finalizeLighterL2KeysAfterDeposit } from '@/lib/services/lighter/lighter-onboarding';
// Backpack funding disabled (display-only demo).
// import { BackpackDepositHandler } from '@/lib/bridge/deposit-handlers/backpack.handler';
import { CHAIN_IDS } from '@/lib/bridge/types';
import type { QuoteRequest } from '@/lib/bridge/types';
import { signAndSubmitRelaySolanaTransaction } from '@/lib/bridge/solana-utils';
import { getUSDCBalanceOnSolana } from '@/lib/bridge/balance-api';
import { formatUSDCBalanceSolana } from '@/lib/bridge/solana-utils';
import {
  ensurePhoenixReadyForDeposit,
  ensurePacificaBuilderForDeposit,
  assertPhoenixTradingConfigured,
} from '@/lib/bridge/solana-direct-deposit';
import { SOLANA_DIRECT_MIN_DEPOSIT_MICROS } from '@/constants';
import { PACIFICA_GAS_REIMBURSEMENT } from '@/lib/bridge/types';
import { invalidateTradingBalances } from '@/lib/trading/invalidate-trading-balances';
import {
  trackBridgeStarted,
  trackBridgeCompleted,
  trackDepositStarted,
  trackDepositCompleted,
  trackDepositFailed,
} from '@/lib/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FundExchange = 'hyperliquid' | 'pacifica' | 'phoenix' | 'lighter';

export type FundStep =
  | 'idle'
  | 'getting-quote'
  | 'signing'
  | 'bridging'
  | 'waiting-bridge'
  | 'phoenix-onboarding'
  | 'pacifica-access'
  | 'depositing'
  | 'lighter-api-keys'
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
const phxHandler = new PhoenixDepositHandler();
const ltHandler = new LighterDepositHandler();

function getHandler(exchange: FundExchange) {
  if (exchange === 'hyperliquid') return hlHandler;
  if (exchange === 'lighter') return ltHandler;
  if (exchange === 'phoenix') return phxHandler;
  return pacHandler;
}

function getExchangeLabel(exchange: FundExchange): string {
  if (exchange === 'hyperliquid') return 'HyperLiquid';
  if (exchange === 'lighter') return 'Lighter';
  if (exchange === 'phoenix') return 'Phoenix';
  return 'Pacifica';
}

function getDestinationChainId(exchange: FundExchange): number {
  if (exchange === 'lighter') return CHAIN_IDS.ETHEREUM;
  if (exchange === 'hyperliquid') return CHAIN_IDS.ARBITRUM;
  return CHAIN_IDS.SOLANA;
}

function getChainLabel(exchange: FundExchange): string {
  if (exchange === 'pacifica' || exchange === 'phoenix') return 'Solana';
  if (exchange === 'lighter') return 'Ethereum';
  return 'Arbitrum';
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

        // Pacifica / Phoenix: USDC on Solana → exchange margin (no relay bridge).
        if (exchange === 'pacifica' || exchange === 'phoenix') {
          const depositAmountMicros = BigInt(Math.floor(amountUsd * 1_000_000));
          if (depositAmountMicros < BigInt(SOLANA_DIRECT_MIN_DEPOSIT_MICROS)) {
            throw new Error(
              `Minimum deposit is ${formatUSDCBalanceSolana(BigInt(SOLANA_DIRECT_MIN_DEPOSIT_MICROS))} USDC`
            );
          }

          const gasBuffer = BigInt(PACIFICA_GAS_REIMBURSEMENT);
          const solanaBalance = await getUSDCBalanceOnSolana(wallet.solanaAddress);
          const required = depositAmountMicros + gasBuffer;
          if (solanaBalance < required) {
            throw new Error(
              `Insufficient Solana USDC. Need ${formatUSDCBalanceSolana(required)} (deposit + gas buffer), have ${formatUSDCBalanceSolana(solanaBalance)}`
            );
          }

          if (exchange === 'phoenix') {
            assertPhoenixTradingConfigured();
            setStep('phoenix-onboarding');
            setStatusMessage('Preparing Phoenix account (register if needed)...');
            await ensurePhoenixReadyForDeposit(
              wallet.solanaAddress,
              wallet.organizationId
            );
          }

          if (exchange === 'pacifica') {
            setStep('pacifica-access');
            setStatusMessage('Confirming Pacifica builder access...');
            await ensurePacificaBuilderForDeposit(
              wallet.solanaAddress,
              wallet.organizationId
            );
          }

          trackDepositStarted(exchange);
          setStep('depositing');
          setStatusMessage(`Depositing $${amountUsd.toFixed(2)} USDC into ${label}...`);

          const depositResult = await handler.executeDeposit({
            walletAddress: wallet.evmAddress,
            organizationId: wallet.organizationId,
            bridgeRequestId: `direct-solana-${exchange}-${Date.now()}`,
            solanaRecipientAddress: wallet.solanaAddress,
            depositAmountMicros,
          });

          if (!depositResult?.txHash) {
            throw new Error(`${label} deposit completed without a transaction signature`);
          }

          trackDepositCompleted(exchange, depositResult.txHash);
          setStep('success');
          setStatusMessage(`Successfully funded ${label}!`);

          await invalidateTradingBalances(queryClient, {
            evmAddress: wallet.evmAddress,
            solanaAddress: wallet.solanaAddress,
          });

          toast.success(`${label} Funded`, {
            description: `$${amountUsd.toFixed(2)} USDC deposited to ${label} margin.`,
            duration: 5000,
          });
          return;
        }

        const recipient = wallet.evmAddress;

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

        const txStep = quoteResponse.steps.find((s) => s.kind === 'transaction');
        const signatureStep = quoteResponse.steps.find((s) => s.kind === 'signature');

        const requestId = (txStep ?? signatureStep)?.requestId;
        if (!requestId) {
          throw new Error(`No executable step found in bridge quote for ${chainLabel}`);
        }

        // ── Step 2: Execute bridge (new Solana tx step OR legacy signature step) ──
        setStep('signing');
        setStatusMessage(`Signing bridge transaction...`);

        if (txStep) {
          setStep('bridging');
          setStatusMessage(`Confirming Solana transaction...`);

          const data = txStep.items?.[0]?.data as
            | {
                addressLookupTableAddresses?: string[];
                instructions?: Array<{
                  programId: string;
                  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
                  data: string;
                }>;
                sponsoredTransaction?: string;
              }
            | undefined;

          if (!data?.sponsoredTransaction && !data?.instructions?.length) {
            throw new Error(`Bridge quote transaction step missing Solana instructions`);
          }

          await signAndSubmitRelaySolanaTransaction(
            {
              addressLookupTableAddresses: data.addressLookupTableAddresses,
              instructions: data.instructions,
              sponsoredTransaction: data.sponsoredTransaction,
            },
            wallet.solanaAddress,
            wallet.organizationId
          );
        } else {
          if (!signatureStep) {
            throw new Error(`No signature step found in bridge quote for ${chainLabel}`);
          }

          const signResult = await handler.signBridgeTransaction(
            signatureStep,
            wallet.evmAddress,
            wallet.organizationId
          );

          setStep('bridging');
          setStatusMessage(`Bridging USDC to ${chainLabel}...`);

          await bridgeService.executePermit({
            signature: signResult.signature,
            kind: signResult.executeKind,
            requestId,
            api: signResult.executeApi,
          });
        }

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

        if (exchange === 'lighter' && !getLighterL2Credentials()) {
          setStep('lighter-api-keys');
          setStatusMessage('Linking Lighter trading keys (waits for your account after deposit)...');
          await finalizeLighterL2KeysAfterDeposit({
            evmAddress: wallet.evmAddress,
            organizationId: wallet.organizationId,
          });
        }

        // ── Done ──────────────────────────────────────────────────
        trackDepositCompleted(exchange);
        setStep('success');
        setStatusMessage(`Successfully funded ${label}!`);

        await invalidateTradingBalances(queryClient, {
          evmAddress: wallet.evmAddress,
          solanaAddress: wallet.solanaAddress,
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
