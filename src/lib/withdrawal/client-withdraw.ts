/**
 * Client-orchestrated withdrawals (mirror of useFundExchange).
 * Hyperliquid → Solana uses Relay direct bridge (chain 1337 → 792703809), not withdraw3 + Arbitrum.
 */

import {
  buildHyperliquidToSolanaQuoteRequest,
  getRelayQuoteV2,
} from '@/lib/bridge/relay-quote';
import { pollBridgeStatus } from '@/lib/bridge/poll-bridge-status';
import {
  executeRelayBridgeQuote,
  type RelayBridgeWalletContext,
} from '@/lib/bridge/relay-bridge-executor';
import { PacificaService } from '@/lib/services/pacifica/pacifica.service';
import { PhoenixService } from '@/lib/services/phoenix/phoenix.service';

const pacificaService = new PacificaService();
const phoenixService = new PhoenixService();

export type WithdrawWalletContext = RelayBridgeWalletContext;

export interface WithdrawResumeState {
  exchange: 'hyperliquid';
  step: 'bridging';
  amountUsd: number;
  bridgeRequestId?: string;
}

const RESUME_LS_KEY = 'nuke_withdraw_resume';

function formatUsdAmount(amountUsd: number): string {
  const rounded = Math.round(amountUsd * 1_000_000) / 1_000_000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(6).replace(/\.?0+$/, '');
}

export function loadWithdrawResumeState(): WithdrawResumeState | null {
  try {
    const raw = localStorage.getItem(RESUME_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.exchange !== 'hyperliquid') return null;
    const amountUsd = typeof parsed.amountUsd === 'number' ? parsed.amountUsd : 0;
    if (parsed.step === 'waiting-arbitrum' || parsed.arbBaselineMicros) {
      return {
        exchange: 'hyperliquid',
        step: 'bridging',
        amountUsd,
        bridgeRequestId:
          typeof parsed.bridgeRequestId === 'string' ? parsed.bridgeRequestId : undefined,
      };
    }
    return {
      exchange: 'hyperliquid',
      step: 'bridging',
      amountUsd,
      bridgeRequestId:
        typeof parsed.bridgeRequestId === 'string' ? parsed.bridgeRequestId : undefined,
    };
  } catch {
    return null;
  }
}

export function storeWithdrawResumeState(state: WithdrawResumeState): void {
  try {
    localStorage.setItem(RESUME_LS_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export function clearWithdrawResumeState(): void {
  try {
    localStorage.removeItem(RESUME_LS_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Bridge Hyperliquid perps USDC → Solana via Relay (~seconds, no Arbitrum leg).
 * @see https://docs.relay.link/references/api/get-quote-v2
 */
export async function bridgeHyperliquidToSolana(
  ctx: WithdrawWalletContext,
  amountUsd: number,
  existingRequestId?: string
): Promise<string> {
  if (existingRequestId) {
    await pollBridgeStatus(existingRequestId);
    return existingRequestId;
  }

  const quoteRequest = buildHyperliquidToSolanaQuoteRequest(
    ctx.evmAddress,
    ctx.solanaAddress,
    amountUsd
  );

  const quote = await getRelayQuoteV2(quoteRequest);
  return executeRelayBridgeQuote(quote, ctx);
}

/**
 * Pacifica signed withdraw → Solana USDC (direct).
 */
export async function withdrawFromPacifica(
  ctx: WithdrawWalletContext,
  amountUsd: number
): Promise<string> {
  const amount = formatUsdAmount(amountUsd);
  const result = await pacificaService.requestWithdrawal(
    amount,
    ctx.solanaAddress,
    ctx.organizationId
  );

  if (!result.success) {
    throw new Error(result.error || 'Pacifica withdrawal failed');
  }

  return 'pacifica-withdraw-submitted';
}

/**
 * Phoenix Rise withdraw → Solana USDC (direct).
 */
export async function withdrawFromPhoenix(
  ctx: WithdrawWalletContext,
  amountUsd: number
): Promise<string> {
  const amountMicros = BigInt(Math.floor(amountUsd * 1_000_000));
  return phoenixService.withdrawUsdc(ctx.solanaAddress, ctx.organizationId, amountMicros);
}
