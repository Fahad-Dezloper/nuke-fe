import {
  ErrorCode,
  createError,
  toAppError,
  getUserMessage,
} from '@/lib/errors';
import type {
  BackpackOrderExecuteRequest,
  BackpackOrderExecuteResponse,
  BackpackPosition,
  BackpackFundingPayment,
  BackpackUpdateAccountRequest,
  BackpackAccount,
} from './types';
import {
  createBackpackSigningString,
  solanaPubkeyBase58ToBackpackApiKeyBase64,
  type BackpackInstruction,
} from './utils/signing';
import { signBackpackMessageWithTurnkey } from './utils/turnkey-signing';

export const BACKPACK_API_BASE_URL = 'https://api.backpack.exchange';

/** Per-asset row from GET /api/v1/capital (balanceQuery). */
type BackpackCapitalAssetRow = {
  available?: string;
  locked?: string;
  staked?: string;
};

function parseUsdcAvailableFromCapital(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.toUpperCase() !== 'USDC') continue;
    const row = obj[key];
    if (!row || typeof row !== 'object') continue;
    const available = (row as BackpackCapitalAssetRow).available;
    if (available == null) continue;
    const n = parseFloat(String(available));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

type SignedRequestArgs = {
  instruction: BackpackInstruction;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string; // e.g. /api/v1/order
  query?: Record<string, unknown>;
  body?: Record<string, unknown> | Array<Record<string, unknown>>;
  solanaAddress: string;
  organizationId: string;
  windowMs?: number;
};

export class BackpackService {
  constructor(private readonly baseUrl: string = BACKPACK_API_BASE_URL) {}

  private async signedRequest<T>(args: SignedRequestArgs): Promise<T> {
    try {
      if (!args.solanaAddress) throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      if (!args.organizationId) throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);

      const timestamp = Date.now();
      const windowMs = args.windowMs ?? 5000;

      const paramsForSigning =
        args.method === 'GET'
          ? (args.query ?? {})
          : Array.isArray(args.body)
            ? undefined // batch signing not needed for our scope
            : (args.body ?? {});

      const signingString = createBackpackSigningString({
        instruction: args.instruction,
        params: paramsForSigning,
        timestamp,
        windowMs,
      });

      const signature = await signBackpackMessageWithTurnkey(
        new TextEncoder().encode(signingString),
        args.solanaAddress,
        args.organizationId
      );

      const apiKey = solanaPubkeyBase58ToBackpackApiKeyBase64(args.solanaAddress);

      const url = new URL(args.path, this.baseUrl);
      if (args.query) {
        for (const [k, v] of Object.entries(args.query)) {
          if (v === undefined || v === null) continue;
          url.searchParams.set(k, String(v));
        }
      }

      const response = await fetch(url.toString(), {
        method: args.method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-API-Key': apiKey,
          'X-Signature': signature,
          'X-Timestamp': String(timestamp),
          'X-Window': String(windowMs),
        },
        body: args.method === 'GET' ? undefined : JSON.stringify(args.body ?? {}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw createError(
          ErrorCode.API_BAD_REQUEST,
          {
            status: response.status,
            statusText: response.statusText,
            endpoint: url.toString(),
            errorData,
          },
          new Error(`Backpack API error: ${response.status} ${response.statusText}`)
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return {} as T;
      }
      return (await response.json()) as T;
    } catch (error) {
      throw toAppError(error, ErrorCode.API_BAD_REQUEST);
    }
  }

  async executePerpOrder(args: {
    order: BackpackOrderExecuteRequest;
    solanaAddress: string;
    organizationId: string;
  }): Promise<{ success: boolean; data?: BackpackOrderExecuteResponse; error?: string }> {
    try {
      const data = await this.signedRequest<BackpackOrderExecuteResponse>({
        instruction: 'orderExecute',
        method: 'POST',
        path: '/api/v1/order',
        body: args.order as unknown as Record<string, unknown>,
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });

      return { success: true, data };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CREATE_FAILED);
      return { success: false, error: getUserMessage(appError) };
    }
  }

  /**
   * User-specific Solana deposit address for USDC (perp collateral).
   * GET /wapi/v1/capital/deposit/address?blockchain=Solana — instruction `depositAddressQuery`.
   */
  async fetchSolanaDepositAddress(args: {
    solanaAddress: string;
    organizationId: string;
  }): Promise<{ success: boolean; address?: string; error?: string }> {
    try {
      const data = await this.signedRequest<{ address: string }>({
        instruction: 'depositAddressQuery',
        method: 'GET',
        path: '/wapi/v1/capital/deposit/address',
        query: { blockchain: 'Solana' },
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });
      if (!data?.address?.trim()) {
        return { success: false, error: 'Backpack did not return a Solana deposit address' };
      }
      return { success: true, address: data.address.trim() };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.API_BAD_REQUEST);
      return { success: false, error: getUserMessage(appError) };
    }
  }

  async getOpenPositions(args: {
    solanaAddress: string;
    organizationId: string;
    symbol?: string;
    marketType?: 'PERP' | 'SPOT';
  }): Promise<{ success: boolean; data?: BackpackPosition[]; error?: string }> {
    try {
      const data = await this.signedRequest<BackpackPosition[]>({
        instruction: 'positionQuery',
        method: 'GET',
        path: '/api/v1/position',
        query: {
          ...(args.symbol ? { symbol: args.symbol } : {}),
          ...(args.marketType ? { marketType: args.marketType } : {}),
        },
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });
      return { success: true, data };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.API_BAD_REQUEST);
      return { success: false, error: getUserMessage(appError) };
    }
  }

  async updateAccount(args: {
    settings: BackpackUpdateAccountRequest;
    solanaAddress: string;
    organizationId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      await this.signedRequest<Record<string, unknown>>({
        instruction: 'accountUpdate',
        method: 'PATCH',
        path: '/api/v1/account',
        body: args.settings as unknown as Record<string, unknown>,
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });
      return { success: true };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED);
      return { success: false, error: getUserMessage(appError) };
    }
  }

  /**
   * Perp collateral: USDC `available` from signed GET /api/v1/capital (instruction balanceQuery).
   */
  async fetchUsdcAvailableBalance(args: {
    solanaAddress: string;
    organizationId: string;
  }): Promise<{ success: boolean; usdcUsd: number; error?: string }> {
    try {
      const raw = await this.signedRequest<unknown>({
        instruction: 'balanceQuery',
        method: 'GET',
        path: '/api/v1/capital',
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });
      const usdcUsd = parseUsdcAvailableFromCapital(raw);
      return { success: true, usdcUsd };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.API_BAD_REQUEST);
      return { success: false, usdcUsd: 0, error: getUserMessage(appError) };
    }
  }

  async getAccount(args: {
    solanaAddress: string;
    organizationId: string;
  }): Promise<{ success: boolean; data?: BackpackAccount; error?: string }> {
    try {
      const data = await this.signedRequest<BackpackAccount>({
        instruction: 'accountQuery',
        method: 'GET',
        path: '/api/v1/account',
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });
      return { success: true, data };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.API_BAD_REQUEST);
      return { success: false, error: getUserMessage(appError) };
    }
  }

  async fetchLeverageLimit(args: {
    solanaAddress: string;
    organizationId: string;
  }): Promise<{ success: boolean; leverageLimit: number | null; error?: string }> {
    const acct = await this.getAccount(args);
    if (!acct.success || !acct.data) {
      return { success: false, leverageLimit: null, error: acct.error || 'Failed to fetch Backpack account' };
    }

    const raw = acct.data.leverageLimit;
    if (!raw) return { success: true, leverageLimit: null };
    const parsed = parseFloat(raw);
    return { success: true, leverageLimit: Number.isFinite(parsed) ? parsed : null };
  }

  async updateLeverageLimit(args: {
    leverage: number;
    solanaAddress: string;
    organizationId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      if (!Number.isFinite(args.leverage) || args.leverage < 1 || args.leverage > 50) {
        throw createError(ErrorCode.VALID_INVALID_LEVERAGE, {
          leverage: args.leverage,
          min: 1,
          max: 50,
        });
      }

      // Backpack's accountUpdate sets a maximum allowed leverage at the account/subaccount level.
      // We set it to the requested leverage for deterministic behavior.
      const res = await this.updateAccount({
        settings: { leverageLimit: String(args.leverage) },
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });

      return res.success ? { success: true } : { success: false, error: res.error };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED);
      return { success: false, error: getUserMessage(appError) };
    }
  }

  async getFundingPayments(args: {
    solanaAddress: string;
    organizationId: string;
    symbol?: string;
    limit?: number;
    offset?: number;
    sortDirection?: 'Asc' | 'Desc';
    subaccountId?: number;
  }): Promise<{ success: boolean; data?: BackpackFundingPayment[]; error?: string }> {
    try {
      const data = await this.signedRequest<BackpackFundingPayment[]>({
        instruction: 'fundingHistoryQueryAll',
        method: 'GET',
        path: '/wapi/v1/history/funding',
        query: {
          ...(args.subaccountId !== undefined ? { subaccountId: args.subaccountId } : {}),
          ...(args.symbol ? { symbol: args.symbol } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
          ...(args.sortDirection ? { sortDirection: args.sortDirection } : {}),
        },
        solanaAddress: args.solanaAddress,
        organizationId: args.organizationId,
      });
      return { success: true, data };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.API_BAD_REQUEST);
      return { success: false, error: getUserMessage(appError) };
    }
  }
}

export const backpackService = new BackpackService();

