/**
 * Relay.link quote v2 (used for Hyperliquid ↔ Solana and other routes).
 * @see https://docs.relay.link/references/api/get-quote-v2
 */

import type { BridgeStep, QuoteResponse } from './types';
import { CHAIN_IDS, TOKEN_ADDRESSES } from './types';

const RELAY_API_URL = process.env.NEXT_PUBLIC_RELAY_API_URL || 'https://api.relay.link';

/** Relay chain id for Hyperliquid perps USDC (hypevm). */
export const RELAY_HYPERLIQUID_CHAIN_ID = 1337;

/** HL perps USDC uses 8 decimals on Relay. */
export const HYPERLIQUID_USDC_DECIMALS = 8;

export const RELAY_CURRENCY = {
  HYPERLIQUID_USDC: '0x00000000000000000000000000000000',
  SOLANA_USDC: TOKEN_ADDRESSES.SOLANA_USDC,
  ARBITRUM_USDC: TOKEN_ADDRESSES.ARBITRUM_USDC,
} as const;

export interface RelayQuoteV2Request {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
  recipient: string;
  /** Refund address on origin chain (Relay UI sets this to the HL EVM wallet). */
  refundTo?: string;
  useDepositAddress?: boolean;
  topupGas?: boolean;
  referrer?: string;
  /** Do not set for HL→Solana — Relay v2 uses nonce-mapping + sendAsset, not permits. */
  usePermit?: boolean;
}

type RelayQuoteV2Step = {
  id: string;
  action: string;
  description: string;
  kind: 'transaction' | 'signature';
  requestId?: string;
  items: BridgeStep['items'];
};

type RelayQuoteV2Response = {
  steps: RelayQuoteV2Step[];
  fees?: {
    gas?: { amountUsd?: string };
    relayer?: { amountUsd?: string };
    relayerService?: { amountUsd?: string };
  };
  details?: {
    timeEstimate?: number;
    currencyIn?: { amountUsd?: string };
    currencyOut?: { amountUsd?: string };
  };
  breakdown?: { timeEstimate?: number };
};

function parseFeeUsd(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRelayQuote(raw: RelayQuoteV2Response): QuoteResponse {
  const steps: BridgeStep[] = (raw.steps ?? []).map((step) => {
    let requestId = step.requestId ?? '';
    if (!requestId) {
      const checkEndpoint = step.items?.[0]?.check?.endpoint;
      if (typeof checkEndpoint === 'string') {
        const match = checkEndpoint.match(/requestId=([^&]+)/);
        if (match?.[1]) requestId = match[1];
      }
      const postRequestId = (step.items?.[0]?.data as { post?: { body?: { requestId?: string } } })
        ?.post?.body?.requestId;
      if (postRequestId) requestId = postRequestId;
    }

    return {
      id: step.id,
      action: step.action,
      description: step.description,
      kind: step.kind,
      requestId,
      items: step.items ?? [],
    };
  });

  const timeEstimate = raw.details?.timeEstimate ?? raw.breakdown?.timeEstimate ?? 0;

  return {
    steps,
    timeEstimate,
    amountIn: raw.details?.currencyIn?.amountUsd ?? '0',
    amountOut: raw.details?.currencyOut?.amountUsd ?? '0',
    minimumReceived: raw.details?.currencyOut?.amountUsd ?? '0',
    rate: '0',
    gasFeeUsd: String(parseFeeUsd(raw.fees?.gas?.amountUsd)),
    relayFeeUsd: String(
      parseFeeUsd(raw.fees?.relayer?.amountUsd) + parseFeeUsd(raw.fees?.relayerService?.amountUsd)
    ),
    protocolFees: '0',
  };
}

export async function getRelayQuoteV2(request: RelayQuoteV2Request): Promise<QuoteResponse> {
  const body: Record<string, unknown> = { ...request };
  if (request.usePermit === undefined) {
    delete body.usePermit;
  }

  const response = await fetch(`${RELAY_API_URL}/quote/v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message =
      typeof errBody === 'object' &&
      errBody !== null &&
      'message' in errBody &&
      typeof (errBody as { message: unknown }).message === 'string'
        ? (errBody as { message: string }).message
        : `Relay quote failed (${response.status})`;
    throw new Error(message);
  }

  const raw = (await response.json()) as RelayQuoteV2Response;
  return normalizeRelayQuote(raw);
}

export function hyperliquidAmountToRelay(amountUsd: number): string {
  return Math.floor(amountUsd * 10 ** HYPERLIQUID_USDC_DECIMALS).toString();
}

export function buildHyperliquidToSolanaQuoteRequest(
  evmAddress: string,
  solanaAddress: string,
  amountUsd: number
): RelayQuoteV2Request {
  return {
    user: evmAddress,
    originChainId: RELAY_HYPERLIQUID_CHAIN_ID,
    destinationChainId: CHAIN_IDS.SOLANA,
    originCurrency: RELAY_CURRENCY.HYPERLIQUID_USDC,
    destinationCurrency: RELAY_CURRENCY.SOLANA_USDC,
    amount: hyperliquidAmountToRelay(amountUsd),
    tradeType: 'EXACT_INPUT',
    recipient: solanaAddress,
    refundTo: evmAddress,
    useDepositAddress: false,
    topupGas: false,
    referrer: 'nuke.trade',
  };
}
