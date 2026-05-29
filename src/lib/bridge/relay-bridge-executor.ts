/**
 * Execute Relay bridge quote steps (all signature + transaction kinds).
 * @see https://docs.relay.link/references/api/api_core_concepts/step-execution
 */

import { HYPERLIQUID_API } from '@/dex/hyperliquid/constants';
import { HyperliquidDepositHandler } from './deposit-handlers/hyperliquid.handler';
import { bridgeService } from './bridge.service';
import { signPermitWithTurnkey } from './signing';
import { signTransferWithAuthorizationWithTurnkey } from './solana-signing';
import { signAndSubmitRelaySolanaTransaction } from './solana-utils';
import { pollBridgeStatus } from './poll-bridge-status';
import { CHAIN_IDS } from './types';
import type { BridgeStep, QuoteResponse, TransferWithAuthorizationData } from './types';
import { TURNKEY_API_BASE_URL } from '@/lib/turnkey/constants';
import { Signature } from 'ethers';

const RELAY_API_URL = process.env.NEXT_PUBLIC_RELAY_API_URL || 'https://api.relay.link';
const HL_SIGNATURE_CHAIN_ID = '0xa4b1';
const evmBridgeSigner = new HyperliquidDepositHandler();

export interface RelayBridgeWalletContext {
  evmAddress: string;
  solanaAddress: string;
  organizationId: string;
}

type RelaySignPayload = {
  signatureKind?: string;
  domain?: Record<string, unknown>;
  types?: Record<string, { name: string; type: string }[]>;
  value?: Record<string, unknown>;
  primaryType?: string;
  message?: string;
};

type RelayHyperliquidSendAssetData = {
  action: {
    type: string;
    parameters: Record<string, unknown>;
  };
  nonce: number;
  eip712Types: Record<string, { name: string; type: string }[]>;
  eip712PrimaryType: string;
};

type RelayStepItemData = {
  sign?: RelaySignPayload;
  post?: {
    endpoint: string;
    method: string;
    body?: {
      kind?: string;
      type?: string;
      requestId?: string;
      api?: string;
    };
  };
  action?: RelayHyperliquidSendAssetData['action'];
  nonce?: number;
  eip712Types?: RelayHyperliquidSendAssetData['eip712Types'];
  eip712PrimaryType?: string;
  chainId?: number;
  to?: string;
  data?: string;
  value?: string;
  instructions?: Array<{
    programId: string;
    keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
    data: string;
  }>;
  sponsoredTransaction?: string;
  addressLookupTableAddresses?: string[];
};

async function getTurnkeyEvmSigner(evmAddress: string, organizationId: string) {
  const { Turnkey } = await import('@turnkey/sdk-browser');
  const { TurnkeySigner } = await import('@turnkey/ethers');

  const turnkey = new Turnkey({
    apiBaseUrl: TURNKEY_API_BASE_URL,
    defaultOrganizationId: organizationId,
  });
  const indexedDbClient = await turnkey.indexedDbClient();
  await indexedDbClient.init();

  return new TurnkeySigner({
    client: indexedDbClient,
    organizationId,
    signWith: evmAddress,
  });
}

async function signRelayPayload(
  sign: RelaySignPayload,
  evmAddress: string,
  organizationId: string
): Promise<string> {
  const kind = (sign.signatureKind ?? 'eip712').toLowerCase();

  if (kind === 'eip191') {
    const { getBytes, toUtf8Bytes } = await import('ethers');
    const signer = await getTurnkeyEvmSigner(evmAddress, organizationId);
    const message = sign.message ?? '';
    const bytes =
      typeof message === 'string' && message.startsWith('0x')
        ? getBytes(message)
        : toUtf8Bytes(message);
    const signature = await signer.signMessage(bytes);
    return signature.startsWith('0x') ? signature : `0x${signature}`;
  }

  if (!sign.domain || !sign.types || !sign.value) {
    throw new Error('Relay signature step missing EIP-712 fields');
  }

  const primaryType = sign.primaryType ?? Object.keys(sign.types)[0];
  const types = Object.fromEntries(
    Object.entries(sign.types).filter(([key]) => key !== 'EIP712Domain')
  ) as Record<string, { name: string; type: string }[]>;

  const signer = await getTurnkeyEvmSigner(evmAddress, organizationId);
  const signature = await signer.signTypedData(
    sign.domain as Parameters<typeof signer.signTypedData>[0],
    types,
    sign.value
  );
  return signature.startsWith('0x') ? signature : `0x${signature}`;
}

async function postRelaySignature(
  post: NonNullable<RelayStepItemData['post']>,
  signature: string
): Promise<void> {
  const endpoint = post.endpoint.startsWith('http')
    ? post.endpoint
    : `${RELAY_API_URL}${post.endpoint}`;

  const url = new URL(endpoint);
  url.searchParams.set('signature', signature);

  const response = await fetch(url.toString(), {
    method: post.method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post.body ?? {}),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Relay execute failed (${response.status}): ${errText.slice(0, 200)}`);
  }
}

async function executeSignatureItem(
  data: RelayStepItemData,
  ctx: RelayBridgeWalletContext
): Promise<void> {
  const sign = data.sign;
  const post = data.post;

  if (!sign || !post) {
    throw new Error('Relay signature step missing sign or post data');
  }

  const postType = (post.body?.type ?? post.body?.kind ?? '').toLowerCase();

  if (post.endpoint === '/authorize' || postType === 'nonce-mapping') {
    const signature = await signRelayPayload(sign, ctx.evmAddress, ctx.organizationId);
    await postRelaySignature(post, signature);
    return;
  }

  if (!post.body?.requestId) {
    throw new Error('Relay signature step missing requestId in post body');
  }

  const executeKind = (post.body.kind ?? 'PERMIT').toLowerCase();

  let signature: string;
  if (executeKind === 'eip3009') {
    signature = await signTransferWithAuthorizationWithTurnkey(
      sign as TransferWithAuthorizationData,
      ctx.evmAddress,
      ctx.organizationId
    );
  } else if (
    sign.domain &&
    sign.types &&
    sign.value &&
    (executeKind === 'permit' || executeKind === 'permit2' || sign.signatureKind === 'eip712')
  ) {
    signature = await signPermitWithTurnkey(
      {
        sign: {
          domain: sign.domain as {
            name: string;
            version: string;
            chainId: number;
            verifyingContract: `0x${string}`;
          },
          types: sign.types,
          value: sign.value,
        },
      },
      ctx.evmAddress,
      ctx.organizationId
    );
  } else {
    signature = await signRelayPayload(sign, ctx.evmAddress, ctx.organizationId);
  }

  const useBackendPermit =
    post.endpoint.includes('/execute/permits') ||
    post.endpoint === '/execute/permits';

  if (useBackendPermit) {
    await bridgeService.executePermit({
      signature,
      kind: post.body.kind || 'PERMIT',
      requestId: post.body.requestId,
      api: post.body.api || 'relay',
    });
  } else {
    await postRelaySignature(post, signature);
  }
}

function rpcUrlForChain(chainId: number): string | undefined {
  if (chainId === CHAIN_IDS.ARBITRUM) {
    return process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL;
  }
  if (chainId === CHAIN_IDS.ETHEREUM) {
    return process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL;
  }
  return process.env.NEXT_PUBLIC_BASE_RPC_URL;
}

/**
 * Relay HL v2 deposit: sign `sendAsset` and POST to Hyperliquid exchange (not an EVM tx).
 */
async function executeHyperliquidRelaySendAsset(
  data: RelayHyperliquidSendAssetData,
  ctx: RelayBridgeWalletContext
): Promise<void> {
  const params = data.action.parameters;
  const signTypes = Object.fromEntries(
    Object.entries(data.eip712Types).filter(([key]) => key !== 'EIP712Domain')
  ) as Record<string, { name: string; type: string }[]>;

  const domain = {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: 42161,
    verifyingContract: '0x0000000000000000000000000000000000000000',
  };

  const signer = await getTurnkeyEvmSigner(ctx.evmAddress, ctx.organizationId);
  const signature = await signer.signTypedData(domain, signTypes, params);
  const sig = Signature.from(signature);

  const hlAction = {
    type: 'sendAsset',
    signatureChainId: HL_SIGNATURE_CHAIN_ID,
    hyperliquidChain: params.hyperliquidChain ?? 'Mainnet',
    destination: params.destination,
    sourceDex: params.sourceDex ?? '',
    destinationDex: params.destinationDex ?? '',
    token: params.token,
    amount: params.amount,
    fromSubAccount: params.fromSubAccount ?? '',
    nonce: data.nonce,
  };

  const response = await fetch(`${HYPERLIQUID_API}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: hlAction,
      nonce: data.nonce,
      signature: { r: sig.r, s: sig.s, v: sig.v },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Hyperliquid sendAsset failed (${response.status}): ${JSON.stringify(errorData).slice(0, 300)}`
    );
  }
}

async function executeTransactionItem(
  data: RelayStepItemData,
  ctx: RelayBridgeWalletContext
): Promise<void> {
  if (
    data.action?.type === 'sendAsset' &&
    data.eip712Types &&
    data.eip712PrimaryType &&
    typeof data.nonce === 'number'
  ) {
    await executeHyperliquidRelaySendAsset(
      {
        action: data.action,
        nonce: data.nonce,
        eip712Types: data.eip712Types,
        eip712PrimaryType: data.eip712PrimaryType,
      },
      ctx
    );
    return;
  }

  const isSolanaTx =
    Boolean(data.instructions?.length || data.sponsoredTransaction) ||
    data.chainId === CHAIN_IDS.SOLANA;

  if (isSolanaTx) {
    if (!data.instructions?.length && !data.sponsoredTransaction) {
      throw new Error('Relay Solana transaction step missing instructions');
    }
    await signAndSubmitRelaySolanaTransaction(
      {
        addressLookupTableAddresses: data.addressLookupTableAddresses,
        instructions: data.instructions,
        sponsoredTransaction: data.sponsoredTransaction,
      },
      ctx.solanaAddress,
      ctx.organizationId
    );
    return;
  }

  if (data.to && data.data && data.chainId) {
    const { JsonRpcProvider } = await import('ethers');
    const signer = await getTurnkeyEvmSigner(ctx.evmAddress, ctx.organizationId);
    const provider = new JsonRpcProvider(rpcUrlForChain(data.chainId));
    const connected = signer.connect(provider);
    const tx = await connected.sendTransaction({
      to: data.to,
      data: data.data,
      value: BigInt(data.value || '0'),
      chainId: data.chainId,
    });
    await tx.wait();
    return;
  }

  throw new Error('Unsupported Relay transaction step payload');
}

async function executeBridgeStep(
  step: BridgeStep,
  ctx: RelayBridgeWalletContext
): Promise<void> {
  if (!step.items?.length) return;

  for (const item of step.items) {
    if (item.status === 'complete') continue;
    const data = item.data as RelayStepItemData;

    if (step.kind === 'signature') {
      await executeSignatureItem(data, ctx);
    } else if (step.kind === 'transaction') {
      await executeTransactionItem(data, ctx);
    } else {
      throw new Error(`Unknown Relay step kind: ${step.kind}`);
    }
  }
}

/**
 * Run all Relay quote steps, then poll until the bridge completes.
 */
export async function executeRelayBridgeQuote(
  quote: QuoteResponse,
  ctx: RelayBridgeWalletContext,
  options?: { existingRequestId?: string }
): Promise<string> {
  if (options?.existingRequestId) {
    await pollBridgeStatus(options.existingRequestId);
    return options.existingRequestId;
  }

  let primaryRequestId = '';

  for (const step of quote.steps) {
    if (step.requestId) primaryRequestId = step.requestId;

    if (step.kind === 'signature' && step.id === 'authorize1') {
      const signResult = await evmBridgeSigner.signBridgeTransaction(
        step,
        ctx.evmAddress,
        ctx.organizationId
      );
      await bridgeService.executePermit({
        signature: signResult.signature,
        kind: signResult.executeKind,
        requestId: step.requestId,
        api: signResult.executeApi,
      });
      continue;
    }

    await executeBridgeStep(step, ctx);
  }

  if (!primaryRequestId) {
    const sigStep = quote.steps.find((s) => s.kind === 'signature');
    const txStep = quote.steps.find((s) => s.kind === 'transaction');
    primaryRequestId = (sigStep ?? txStep)?.requestId ?? '';
  }

  if (!primaryRequestId) {
    throw new Error('No Relay requestId found after executing bridge steps');
  }

  await pollBridgeStatus(primaryRequestId);
  return primaryRequestId;
}
