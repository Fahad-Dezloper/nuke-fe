/**
 * Phoenix isolated market-order instruction builder (HTTP ix API).
 * Rise `buildPlaceMarketOrderFlow` requires an internal rpc client with `addresses`;
 * the public HTTP route is stable and validates transferable collateral server-side.
 */

import type { RiseInstructionLike } from '@/lib/services/phoenix/phoenix-submit';

const PHOENIX_API_URL =
  process.env.NEXT_PUBLIC_PHOENIX_API_URL?.trim() || 'https://perp-api.phoenix.trade';

type ApiInstructionResponse = {
  programId: string;
  data: number[];
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
};

function apiIxToRise(ix: ApiInstructionResponse): RiseInstructionLike {
  const role = (isSigner: boolean, isWritable: boolean): number => {
    if (isSigner && isWritable) return 3;
    if (isSigner) return 2;
    if (isWritable) return 1;
    return 0;
  };
  return {
    programAddress: ix.programId,
    accounts: ix.keys.map((k) => ({
      address: k.pubkey,
      role: role(k.isSigner, k.isWritable),
    })),
    data: new Uint8Array(ix.data),
  };
}

export type PhoenixIsolatedTpSlConfig = {
  takeProfitTriggerPrice: number;
  stopLossTriggerPrice: number;
  takeProfitExecutionPrice?: number;
  stopLossExecutionPrice?: number;
  numBaseLots?: number;
};

export type PhoenixIsolatedMarketIxParams = {
  authority: string;
  symbol: string;
  /** Phoenix side: `bid` (long) or `ask` (short) */
  side: 'bid' | 'ask';
  numBaseLots: bigint | number;
  transferAmountMicros: bigint;
  skipTransferToParent?: boolean;
  isReduceOnly?: boolean;
  subaccountIndex?: number;
  /** Mirrored hedge TP/SL bracket (attached on isolated open). */
  tpSl?: PhoenixIsolatedTpSlConfig;
  /** Sponsored Solana fee payer — gasless for user when configured. */
  feePayer?: string;
};

/**
 * Build Solana instructions for an isolated market order (open or reduce-only close).
 */
export async function fetchPhoenixIsolatedMarketOrderInstructions(
  params: PhoenixIsolatedMarketIxParams
): Promise<RiseInstructionLike[]> {
  const body: Record<string, unknown> = {
    authority: params.authority,
    symbol: params.symbol,
    side: params.side,
    numBaseLots: Number(params.numBaseLots),
    skipTransferToParent: params.skipTransferToParent ?? !params.isReduceOnly,
  };

  if (params.isReduceOnly) {
    body.isReduceOnly = true;
  }
  if (params.subaccountIndex != null) {
    body.subaccountIndex = params.subaccountIndex;
  }
  if (params.transferAmountMicros > BigInt(0)) {
    body.transferAmount = Number(params.transferAmountMicros);
  }
  if (params.tpSl) {
    body.tpSl = params.tpSl;
  }
  if (params.feePayer?.trim()) {
    body.feePayer = params.feePayer.trim();
  }

  const res = await fetch(`${PHOENIX_API_URL}/v1/ix/place-isolated-market-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || `Phoenix isolated ix HTTP ${res.status}`);
  }

  const parsed = JSON.parse(text) as ApiInstructionResponse[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Phoenix isolated ix returned no instructions');
  }

  return parsed.map(apiIxToRise);
}
