/**
 * Withdrawal Action Executor
 *
 * Maps each WithdrawalAction from the backend to execution logic:
 *   - WITHDRAW → Sign & submit exchange withdrawal (Hyperliquid EIP-712 or Pacifica Solana)
 *   - BRIDGE   → Get quote, sign & send bridge tx to move USDC to Base
 *
 * This class does NOT decide what to execute — the backend does.
 * It only knows HOW to execute each action type.
 */

import { Signature } from 'ethers';
import { HYPERLIQUID_API } from '@/dex/hyperliquid/constants';
import { ErrorCode, createError } from '@/lib/errors';
import { signPacificaMessageWithTurnkey } from '@/lib/services/pacifica/utils/turnkey-signing';
import { bridgeService } from '@/lib/bridge/bridge.service';
import { signPermitWithTurnkey } from '@/lib/bridge/signing';
import { signTransferWithAuthorizationWithTurnkey } from '@/lib/bridge/solana-signing';
import type { TransferWithAuthorizationData } from '@/lib/bridge/types';
import { withdrawalApi } from './api';
import type {
  WithdrawalNextActionResponse,
  WithdrawalExchange,
} from './types';

// ─── Context ─────────────────────────────────────────────────────────────────

/**
 * Context required by the executor to sign and submit transactions.
 * Provided by the React hook from Turnkey state.
 */
export interface ExecutorContext {
  evmAddress: string;
  solanaAddress: string;
  organizationId: string;
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  txHash: string | null;
  error: string | null;
}

function toAmountString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toChainId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveBridgeAmount(params: Record<string, unknown> | null): string {
  const amount = toAmountString(params?.amount);
  if (amount) return amount;

  const amountUsdRaw = params?.amount_usd;
  const amountUsd =
    typeof amountUsdRaw === 'number'
      ? amountUsdRaw
      : typeof amountUsdRaw === 'string'
        ? Number(amountUsdRaw)
        : NaN;

  if (Number.isFinite(amountUsd) && amountUsd > 0) {
    return Math.floor(amountUsd * 1_000_000).toString();
  }

  return '0';
}

// ─── Executor ────────────────────────────────────────────────────────────────

export class WithdrawalActionExecutor {
  /**
   * Execute a single action.
   * Dispatches to the correct handler based on action type.
   */
  async execute(
    action: WithdrawalNextActionResponse,
    context: ExecutorContext,
    exchange: WithdrawalExchange
  ): Promise<ActionResult> {
    switch (action.action) {
      case 'WITHDRAW':
        return this.executeWithdraw(action, context, exchange);
      case 'BRIDGE':
        return this.executeBridge(action, context);
      default:
        return {
          success: false,
          txHash: null,
          error: `Unknown action: ${action.action}`,
        };
    }
  }

  // ─── Withdraw ─────────────────────────────────────────────────────────────

  private async executeWithdraw(
    action: WithdrawalNextActionResponse,
    context: ExecutorContext,
    exchange: WithdrawalExchange
  ): Promise<ActionResult> {
    if (exchange === 'hyperliquid') {
      return this.executeHyperliquidWithdraw(action, context);
    }
    if (exchange === 'pacifica') {
      return this.executePacificaWithdraw(action, context);
    }
    return {
      success: false,
      txHash: null,
      error: `Unsupported exchange for withdrawal: ${exchange}`,
    };
  }

  /**
   * Hyperliquid withdrawal:
   * 1. Get EIP-712 typed data from backend
   * 2. Sign with Turnkey EVM wallet
   * 3. Submit signed payload to Hyperliquid exchange
   */
  private async executeHyperliquidWithdraw(
    _action: WithdrawalNextActionResponse,
    context: ExecutorContext
  ): Promise<ActionResult> {
    try {
      const params = _action.params as Record<string, unknown> | null;
      const amount = toAmountString(params?.amount) ?? toAmountString(params?.amount_usd) ?? '0';
      // 1. Get EIP-712 typed data from backend
      const txData = await withdrawalApi.getTransaction<{
        domain: { name: string; version: string; chainId: number; verifyingContract: string };
        types: Record<string, { name: string; type: string }[]>;
        primaryType: string;
        message: Record<string, unknown>;
        action: Record<string, unknown>;
        nonce: number;
        typedData?: {
          domain: { name: string; version: string; chainId: number; verifyingContract: string };
          types: Record<string, { name: string; type: string }[]>;
          primaryType: string;
          message: Record<string, unknown>;
        };
      }>({
        Hyperliquid: {
          amount,
        },
      });

      const signDomain = txData.typedData?.domain ?? txData.domain;
      const rawSignTypes = txData.typedData?.types ?? txData.types;
      const signMessage = txData.typedData?.message ?? txData.message;
      const signTypes = Object.fromEntries(
        Object.entries(rawSignTypes ?? {}).filter(([key]) => key !== 'EIP712Domain')
      ) as Record<string, { name: string; type: string }[]>;

      if (!signDomain || !signTypes || !signMessage) {
        throw new Error('Invalid Hyperliquid typed data payload from backend');
      }

      // 2. Sign with Turnkey EVM wallet
      const { Turnkey } = await import('@turnkey/sdk-browser');
      const { TurnkeySigner } = await import('@turnkey/ethers');

      const turnkey = new Turnkey({
        apiBaseUrl: 'https://api.turnkey.com',
        defaultOrganizationId: context.organizationId,
      });

      const indexedDbClient = await turnkey.indexedDbClient();
      await indexedDbClient.init();

      const signer = new TurnkeySigner({
        client: indexedDbClient,
        organizationId: context.organizationId,
        signWith: context.evmAddress,
      });

      const signature = await signer.signTypedData(
        signDomain,
        signTypes,
        signMessage
      );

      const sig = Signature.from(signature);
      const signatureComponents = {
        r: sig.r as `0x${string}`,
        s: sig.s as `0x${string}`,
        v: sig.v,
      };

      // 3. Submit to Hyperliquid exchange
      const payload = {
        action: txData.action,
        nonce: txData.nonce,
        signature: signatureComponents,
      };

      const response = await fetch(`${HYPERLIQUID_API}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw createError(
          ErrorCode.HYPERLIQUID_SUBMIT_FAILED,
          { status: response.status, errorData }
        );
      }

      const responseData = await response.json();
      const txHash =
        responseData?.response?.data?.statuses?.[0]?.withdrawn ||
        responseData?.response?.type ||
        'hl-withdraw-ok';

      return { success: true, txHash: String(txHash), error: null };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[WithdrawalExecutor] Hyperliquid withdraw failed:', err);
      return { success: false, txHash: null, error: `Hyperliquid withdrawal failed: ${errMsg}` };
    }
  }

  /**
   * Pacifica withdrawal:
   * 1. Sign withdrawal message with Turnkey Solana wallet
   * 2. Send signed message to backend (backend submits to Pacifica directly)
   */
  private async executePacificaWithdraw(
    _action: WithdrawalNextActionResponse,
    context: ExecutorContext
  ): Promise<ActionResult> {
    try {
      const params = _action.params as Record<string, unknown> | null;
      const amount = toAmountString(params?.amount) ?? toAmountString(params?.amount_usd) ?? '0';

      // 1. Sign the withdrawal message
      const timestamp = Date.now();
      const message = new TextEncoder().encode(
        JSON.stringify({
          data: { amount },
          expiry_window: 5000,
          timestamp,
          type: 'withdraw',
        })
      );

      const signature = await signPacificaMessageWithTurnkey(
        message,
        context.solanaAddress,
        context.organizationId
      );

      // 2. Submit to backend (backend submits to Pacifica)
      const result = await withdrawalApi.getTransaction<{ success?: boolean; error?: string }>({
        Pacifica: {
          signature,
          amount,
        },
      });

      if (result.error) {
        return { success: false, txHash: null, error: `Pacifica withdrawal failed: ${result.error}` };
      }

      return { success: true, txHash: 'pacifica-withdraw-ok', error: null };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[WithdrawalExecutor] Pacifica withdraw failed:', err);
      return { success: false, txHash: null, error: `Pacifica withdrawal failed: ${errMsg}` };
    }
  }

  // ─── Bridge ───────────────────────────────────────────────────────────────

  /**
   * Bridge USDC from source chain (Arbitrum for HL) to Base.
   * 1. Get bridge quote from backend
   * 2. Sign bridge transaction with Turnkey EVM wallet
   * 3. Send on-chain
   */
  async executeBridge(
    action: WithdrawalNextActionResponse,
    context: ExecutorContext
  ): Promise<ActionResult> {
    try {
      const params = action.params as Record<string, unknown> | null;
      const amount = resolveBridgeAmount(params);
      const originChainId =
        toChainId(params?.originChainId) ?? toChainId(params?.origin_chain_id) ?? 42161;
      const destinationChainId =
        toChainId(params?.destinationChainId) ?? toChainId(params?.destination_chain_id) ?? 8453;
      const recipient = (params?.recipient as string) || context.evmAddress;

      // 1. Get bridge quote from backend
      const quote = await withdrawalApi.getBridgeQuote<{
        steps?: Array<{
          kind: string;
          requestId: string;
          items: Array<{
            data: {
              to: string;
              data: string;
              value: string;
              chainId: number;
              post?: {
                body?: {
                  api?: string;
                  kind?: string;
                  requestId?: string;
                };
              };
              sign?: {
                domain: {
                  name: string;
                  version: string;
                  chainId: number;
                  verifyingContract: `0x${string}`;
                };
                types: Record<string, { name: string; type: string }[]>;
                value: Record<string, unknown>;
              };
            };
          }>;
        }>;
      }>({
        originChainId,
        destinationChainId,
        amount,
        tradeType: 'EXACT_INPUT',
        usePermit: true,
        recipient,
      });

      // 2. Find the transaction step
      const txStep =
        quote.steps?.find((step) => step.kind === 'transaction') ||
        quote.steps?.find((step) => {
          const data = step.items?.[0]?.data as
            | { to?: string; data?: string; chainId?: number }
            | undefined;
          return Boolean(data?.to && data?.data && data?.chainId);
        });

      if (txStep && txStep.items?.[0]?.data) {
        const txData = txStep.items[0].data;

        // 3. Sign and send with Turnkey EVM wallet
        const { Turnkey } = await import('@turnkey/sdk-browser');
        const { TurnkeySigner } = await import('@turnkey/ethers');
        const { JsonRpcProvider } = await import('ethers');

        const turnkey = new Turnkey({
          apiBaseUrl: 'https://api.turnkey.com',
          defaultOrganizationId: context.organizationId,
        });

        const indexedDbClient = await turnkey.indexedDbClient();
        await indexedDbClient.init();

        const rpcUrl = originChainId === 42161
          ? process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL
          : process.env.NEXT_PUBLIC_BASE_RPC_URL;

        const provider = new JsonRpcProvider(rpcUrl);

        const signer = new TurnkeySigner({
          client: indexedDbClient,
          organizationId: context.organizationId,
          signWith: context.evmAddress,
        });

        const connectedSigner = signer.connect(provider);

        const tx = await connectedSigner.sendTransaction({
          to: txData.to,
          data: txData.data,
          value: BigInt(txData.value || '0'),
          chainId: txData.chainId,
        });

        const receipt = await tx.wait();
        const txHash = receipt?.hash || tx.hash;
        return { success: true, txHash, error: null };
      }

      // Fallback: permit/signature flow (e.g. eip3009) from relay quote
      const signatureStep = quote.steps?.find((step) => step.kind === 'signature');
      const signatureData = signatureStep?.items?.[0]?.data;
      const postBody = signatureData?.post?.body;
      const signData = signatureData?.sign;

      if (!signatureStep || !signData || !postBody?.requestId) {
        return {
          success: false,
          txHash: null,
          error: `No executable step found in bridge quote (amount=${amount}, origin=${originChainId}, destination=${destinationChainId})`,
        };
      }

      const executeKind = postBody.kind || 'PERMIT';
      const executeApi = postBody.api || 'relay';
      const requestId = postBody.requestId || signatureStep.requestId;

      const signature =
        executeKind.toLowerCase() === 'eip3009'
          ? await signTransferWithAuthorizationWithTurnkey(
              signData as TransferWithAuthorizationData,
              context.evmAddress,
              context.organizationId
            )
          : await signPermitWithTurnkey(
              {
                sign: {
                  domain: signData.domain,
                  types: signData.types,
                  value: signData.value,
                },
              },
              context.evmAddress,
              context.organizationId
            );

      await bridgeService.executePermit({
        signature,
        kind: executeKind,
        requestId,
        api: executeApi,
      });

      return { success: true, txHash: requestId, error: null };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[WithdrawalExecutor] Bridge failed:', err);
      return { success: false, txHash: null, error: `Bridge to Base failed: ${errMsg}` };
    }
  }
}
