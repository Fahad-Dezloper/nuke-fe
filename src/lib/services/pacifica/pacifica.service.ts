import { PACIFICA_HTTP_URL } from '@/dex/pacifica/constants';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';
import type {
  CreateMarketOrderRequest,
  CreateLimitOrderRequest,
  CancelOrderRequest,
  CreateOrderResponse,
  PacificaApiResponse,
  SetPositionTpSlRequest,
} from './types';
import { TpSlManager } from '@/dex/pacifica/tpsl-manager';
import { Side } from '@/dex/pacifica/types';
import { prepareSigningData, messageToBytes } from './utils/signing';
import { signPacificaMessageWithTurnkey } from './utils/turnkey-signing';
import { roundAmount, roundPrice } from '@/dex/pacifica/utils/rounding';
import axios from 'axios';
import { BUILDER_CODE, BUILDER_MAX_FEE_RATE, EXPIRY_WINDOW, REFERRAL_CODE } from '@/constants';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

/** Pacifica returns 400 when the wallet already has a referral code on file. */
/** Per-symbol margin row from GET /account/settings (`data.margin_settings`). */
export interface PacificaMarginSetting {
  symbol: string;
  isolated: boolean;
  leverage: number;
}

function normalizeMarginSettingRow(row: unknown): PacificaMarginSetting | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const symbol = typeof r.symbol === 'string' ? r.symbol.trim() : '';
  if (!symbol) return null;
  const lev = Number(r.leverage);
  return {
    symbol,
    isolated: Boolean(r.isolated),
    leverage: Number.isFinite(lev) && lev > 0 ? lev : 0,
  };
}

/**
 * Pacifica returns `data: { margin_settings: [...], spot_settings: [...] }`, not a bare array.
 * @see https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/account/get-account-settings
 */
export function parsePacificaMarginSettings(raw: unknown): PacificaMarginSetting[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(normalizeMarginSettingRow)
      .filter((r): r is PacificaMarginSetting => r != null);
  }
  if (typeof raw !== 'object') return [];
  const marginSettings = (raw as Record<string, unknown>).margin_settings;
  if (!Array.isArray(marginSettings)) return [];
  return marginSettings
    .map(normalizeMarginSettingRow)
    .filter((r): r is PacificaMarginSetting => r != null);
}

function pacificaReferralAlreadyClaimed(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const rec = body as Record<string, unknown>;
  const err = String(rec.error ?? '').toLowerCase();
  return (
    err.includes('check violation') ||
    err.includes('already claimed') ||
    err.includes('already exists') ||
    err.includes('duplicate')
  );
}

export class PacificaService {
  private baseUrl: string;
  private timeout: number;

  private expiryWindow = 30_000;

  constructor(baseUrl: string = PACIFICA_HTTP_URL) {
    this.baseUrl = baseUrl;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Signs a Pacifica order request using Turnkey
   * @param operationType - The operation type (e.g., "create_market_order")
   * @param operationData - The operation data to sign
   * @param walletAddress - Turnkey Solana wallet address
   * @param organizationId - Turnkey organization ID
   * @param expiryWindow - Optional expiry window in milliseconds (default: 30000)
   * @returns Object with timestamp and signature
   */
  async signOrderRequest(
    operationType: string,
    operationData: Record<string, unknown>,
    walletAddress: string,
    organizationId: string,
    expiryWindow?: number
  ): Promise<{ timestamp: number; signature: string }> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      // Generate timestamp
      const timestamp = Date.now();

      // Prepare the message for signing (recursive sort + compact JSON)
      const messageToSign = prepareSigningData(
        operationType,
        operationData,
        timestamp,
        expiryWindow
      );

      // Convert to bytes
      const messageBytes = messageToBytes(messageToSign);

      // Sign with Turnkey
      const signature = await signPacificaMessageWithTurnkey(
        messageBytes,
        walletAddress,
        organizationId
      );

      return {
        timestamp,
        signature,
      };
    } catch (error) {
      console.error('Error signing Pacifica order request:', error);
      throw toAppError(error, ErrorCode.WALLET_SIGNING_FAILED);
    }
  }

  // ─── Referral code (points) — check via Nuke BE, claim on Pacifica ─────

  /**
   * Nuke claim-status for referral points. On HTTP/error, `ok` is false — do not attempt Pacifica claim.
   */
  async checkReferralClaimedOnBackend(
    userId: string
  ): Promise<{ ok: true; claimed: boolean } | { ok: false }> {
    try {
      const data = await apiClient.get<{ is_claimed: boolean }>(
        API_ENDPOINTS.pacificaClaim.status(userId)
      );
      return { ok: true, claimed: data.is_claimed === true };
    } catch (err) {
      console.warn('[Pacifica] Nuke referral claim-status check failed:', err);
      return { ok: false };
    }
  }

  private async recordReferralClaimOnBackend(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.pacificaClaim.claim);
    } catch (err) {
      console.warn('[Pacifica] Nuke referral claim record failed (non-fatal):', err);
    }
  }

  /**
   * Claim REFERRAL_CODE on Pacifica for points. Signs POST /referral/user/code/claim.
   * On success (or wallet already has a referral on Pacifica), syncs Nuke BE via POST /user/claim/pacifica.
   */
  async claimReferralCode(
    account: string,
    organizationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const timestamp = Date.now();

      const message = new TextEncoder().encode(
        JSON.stringify({
          data: { code: REFERRAL_CODE },
          expiry_window: 5000,
          timestamp,
          type: 'claim_referral_code',
        })
      );
      const signature = await signPacificaMessageWithTurnkey(message, account, organizationId);

      const finalRequest = {
        account,
        agent_wallet: null,
        signature,
        timestamp,
        expiry_window: 5000,
        code: REFERRAL_CODE,
      };

      const response = await fetch(`${this.baseUrl}/referral/user/code/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalRequest),
      });

      const apiResponse = (await response.json().catch(() => ({}))) as PacificaApiResponse & {
        code?: number;
      };

      if (response.ok && !apiResponse.error) {
        await this.recordReferralClaimOnBackend();
        return { success: true };
      }

      if (pacificaReferralAlreadyClaimed(apiResponse)) {
        console.log(
          '[Pacifica] Referral already set on Pacifica for this wallet — syncing Nuke claim record'
        );
        await this.recordReferralClaimOnBackend();
        return { success: true };
      }

      const errDetail =
        apiResponse.error ||
        (response.ok ? 'Unknown Pacifica referral error' : `HTTP ${response.status}`);
      return { success: false, error: `Referral code claim failed: ${errDetail}` };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[Pacifica] Referral code claim failed (non-fatal):', errMsg);
      return { success: false, error: `Referral code claim failed: ${errMsg}` };
    }
  }

  // ─── Builder Code Approval (check on Pacifica) ─────────────────────────

  /**
   * Checks whether the user has already approved the NUKETRADE builder code.
   *
   * GET /account/builder_codes/approvals?account=<address>
   *
   * @returns true if approved, false otherwise
   */
  async checkBuilderCodeApproval(account: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/account/builder_codes/approvals?account=${account}`,
        { method: 'GET', headers: { Accept: '*/*' } }
      );

      if (!response.ok) {
        console.warn('[Pacifica] Failed to check builder code approvals:', response.status);
        return false;
      }

      const json = await response.json();
      const approvals: Array<{ builder_code: string }> = json?.data ?? [];
      return Array.isArray(approvals) && approvals.some((a) => a.builder_code === BUILDER_CODE);
    } catch (err) {
      console.warn('[Pacifica] Error checking builder code approvals:', err);
      return false;
    }
  }

  /**
   * Prompts the user to approve the NUKETRADE builder code.
   *
   * Signs an `approve_builder_code` payload and POSTs to
   * /account/builder_codes/approve
   *
   * @param account - Solana wallet address
   * @param organizationId - Turnkey organization ID
   */
  async approveBuilderCode(
    account: string,
    organizationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const operationData: Record<string, unknown> = {
        builder_code: BUILDER_CODE,
        max_fee_rate: BUILDER_MAX_FEE_RATE,
      };

      const { timestamp, signature } = await this.signOrderRequest(
        'approve_builder_code',
        operationData,
        account,
        organizationId,
        5000 // 5s expiry window per docs
      );

      const finalRequest = {
        account,
        agent_wallet: null,
        signature,
        timestamp,
        expiry_window: 5000,
        builder_code: BUILDER_CODE,
        max_fee_rate: BUILDER_MAX_FEE_RATE,
      };

      const apiResponse = await this.submitToPacifica('/account/builder_codes/approve', finalRequest);

      if (apiResponse.error) {
        return { success: false, error: `Builder code approval failed: ${apiResponse.error}` };
      }

      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Pacifica] Builder code approval failed:', err);
      return { success: false, error: `Builder code approval failed: ${errMsg}` };
    }
  }

  /**
   * Submits a signed order to Pacifica API
   * @param endpoint - API endpoint
   * @param requestBody - The complete request body with signature
   * @returns Pacifica API response
   */
  private async submitToPacifica(
    endpoint: string,
    requestBody: Record<string, unknown>
  ): Promise<PacificaApiResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw createError(
          ErrorCode.API_BAD_REQUEST,
          {
            status: response.status,
            statusText: response.statusText,
            errorData,
            endpoint,
          },
          new Error(`Pacifica API error: ${response.status} ${response.statusText}`)
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error submitting to Pacifica:', error);
      throw toAppError(error, ErrorCode.NET_CONNECTION_ERROR);
    }
  }

  /**
   * Creates a market order on Pacifica
   * @param request - Market order request parameters
   * @param walletAddress - Turnkey Solana wallet address
   * @param organizationId - Turnkey organization ID
   * @returns Order creation response
   */

  /**
   * Updates leverage for a specific symbol on Pacifica.
   *
   * Follows the same signing pattern as other Pacifica operations:
   *   operation_type = "update_leverage"
   *   operation_data = { symbol, leverage }
   *   POST /account/update_leverage
   *
   * @param symbol - Asset symbol (e.g. "BTC")
   * @param leverage - New leverage value
   * @param walletAddress - Turnkey Solana wallet address
   * @param organizationId - Turnkey organization ID
   * @returns Success/failure response
   */
  /**
   * Set cross or isolated margin mode for a symbol (must be done before opening a position).
   * POST /account/margin — `update_margin_mode`
   */
  async updateMarginMode(
    symbol: string,
    isIsolated: boolean,
    walletAddress: string,
    organizationId: string
  ): Promise<CreateOrderResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }
      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }
      if (!symbol) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, { missingFields: ['symbol'] });
      }

      const operationData: Record<string, unknown> = {
        symbol: symbol.toUpperCase(),
        is_isolated: isIsolated,
      };

      const { timestamp, signature } = await this.signOrderRequest(
        'update_margin_mode',
        operationData,
        walletAddress,
        organizationId,
        this.expiryWindow
      );

      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
        expiry_window: this.expiryWindow,
        ...operationData,
      };

      const apiResponse = await this.submitToPacifica('/account/margin', finalRequest);

      if (apiResponse.error) {
        throw createError(ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED, {
          error: apiResponse.error,
          symbol,
        });
      }

      return {
        success: true,
        message: `Pacifica margin mode set to ${isIsolated ? 'isolated' : 'cross'}`,
        data: apiResponse,
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to update Pacifica margin mode',
      };
    }
  }

  /**
   * Whether the symbol is configured for isolated margin (false = cross / default).
   */
  async fetchIsolatedMargin(
    account: string,
    symbol: string
  ): Promise<{ success: boolean; isolated: boolean | null; error?: string }> {
    const settingsResult = await this.getAccountSettings(account);
    if (!settingsResult.success || !settingsResult.data) {
      return {
        success: false,
        isolated: null,
        error: settingsResult.error || 'Failed to fetch account settings',
      };
    }
    const entry = settingsResult.data.find(
      (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
    );
    return {
      success: true,
      isolated: entry?.isolated ?? false,
    };
  }

  async updateLeverage(
    symbol: string,
    leverage: number,
    walletAddress: string,
    organizationId: string
  ): Promise<CreateOrderResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      if (!symbol) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['symbol'],
        });
      }

      if (leverage < 1 || leverage > 20) {
        throw createError(ErrorCode.VALID_INVALID_LEVERAGE, {
          leverage,
          min: 1,
          max: 20,
        });
      }

      // Prepare operation data for signing (no builder_code — not supported on this endpoint)
      const operationData: Record<string, unknown> = {
        symbol: symbol.toUpperCase(),
        leverage,
      };

      // Sign the request
      const { timestamp, signature } = await this.signOrderRequest(
        'update_leverage',
        operationData,
        walletAddress,
        organizationId,
        this.expiryWindow
      );

      // Build the final request
      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
        expiry_window: this.expiryWindow,
        ...operationData,
      };

      // Submit to Pacifica API
      const apiResponse = await this.submitToPacifica('/account/leverage', finalRequest);

      if (apiResponse.error) {
        throw createError(ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED, {
          error: apiResponse.error,
          code: apiResponse.code,
          symbol,
        });
      }

      return {
        success: true,
        data: apiResponse,
        message: `Leverage updated to ${leverage}x for ${symbol}`,
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED);
      console.error('Error updating Pacifica leverage:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to update leverage',
      };
    }
  }

  async createMarketOrder(
    request: CreateMarketOrderRequest,
    walletAddress: string,
    organizationId: string
  ): Promise<CreateOrderResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      // Validate required fields
      if (!request.symbol || !request.amount || !request.side) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['symbol', 'amount', 'side'].filter(
            (field) => !request[field as keyof CreateMarketOrderRequest]
          ),
        });
      }

      const symbol = request.symbol.toUpperCase();

      // Round amount to lot_size (and prices to tick_size) for the symbol.
      // Pacifica rejects requests whose amount / price aren't exact multiples.
      const roundedAmount = await roundAmount(request.amount, symbol);

      // Prepare operation data for signing
      const operationData: Record<string, unknown> = {
        symbol,
        amount: roundedAmount,
        side: request.side,
        slippage_percent: String(request.slippage_percent),
        reduce_only: request.reduce_only,
        builder_code: request.builder_code ?? BUILDER_CODE,
      };

      // Add optional fields
      if (request.client_order_id) {
        operationData.client_order_id = request.client_order_id;
      }

      if (request.take_profit) {
        if (request.tpsl_prices_pre_quantized) {
          operationData.take_profit = {
            stop_price: request.take_profit.stop_price,
            limit_price: request.take_profit.limit_price ?? request.take_profit.stop_price,
            ...(request.take_profit.client_order_id && {
              client_order_id: request.take_profit.client_order_id,
            }),
          };
        } else {
          operationData.take_profit = {
            stop_price: await roundPrice(request.take_profit.stop_price, symbol),
            ...(request.take_profit.limit_price && {
              limit_price: await roundPrice(request.take_profit.limit_price, symbol),
            }),
            ...(request.take_profit.client_order_id && {
              client_order_id: request.take_profit.client_order_id,
            }),
          };
        }
      }

      if (request.stop_loss) {
        if (request.tpsl_prices_pre_quantized) {
          operationData.stop_loss = {
            stop_price: request.stop_loss.stop_price,
            limit_price: request.stop_loss.limit_price ?? request.stop_loss.stop_price,
            ...(request.stop_loss.client_order_id && {
              client_order_id: request.stop_loss.client_order_id,
            }),
          };
        } else {
          operationData.stop_loss = {
            stop_price: await roundPrice(request.stop_loss.stop_price, symbol),
            ...(request.stop_loss.limit_price && {
              limit_price: await roundPrice(request.stop_loss.limit_price, symbol),
            }),
            ...(request.stop_loss.client_order_id && {
              client_order_id: request.stop_loss.client_order_id,
            }),
          };
        }
      }
      // Sign the order request
      const { timestamp, signature } = await this.signOrderRequest(
        'create_market_order',
        operationData,
        walletAddress,
        organizationId,
        this.expiryWindow
      );

      // Build the final request (operation data + signature header fields)
      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
        expiry_window: this.expiryWindow,
        ...operationData, // Spread operation data (NOT wrapped in "data")
      };

      // Add optional header fields
      if (request.expiry_window !== undefined) {
        finalRequest.expiry_window = request.expiry_window;
      }
      if (request.agent_wallet) {
        finalRequest.agent_wallet = request.agent_wallet;
      }

      // Submit to Pacifica API
      const apiResponse = await this.submitToPacifica('/orders/create_market', finalRequest);

      if (apiResponse.error) {
        throw createError(ErrorCode.TRADE_POSITION_CREATE_FAILED, {
          error: apiResponse.error,
          code: apiResponse.code,
          symbol: request.symbol,
        });
      }

      return {
        success: true,
        order_id: String(apiResponse.order_id || ''),
        data: apiResponse,
        message: 'Market order created successfully',
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CREATE_FAILED);
      console.error('Error creating market order:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to create market order',
      };
    }
  }

  /**
   * Creates a limit order on Pacifica
   * @param request - Limit order request parameters
   * @param walletAddress - Turnkey Solana wallet address
   * @param organizationId - Turnkey organization ID
   * @returns Order creation response
   */
  async createLimitOrder(
    request: CreateLimitOrderRequest,
    walletAddress: string,
    organizationId: string
  ): Promise<CreateOrderResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      // Validate required fields
      if (!request.symbol || !request.price || !request.amount || !request.side) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['symbol', 'price', 'amount', 'side'].filter(
            (field) => !request[field as keyof CreateLimitOrderRequest]
          ),
        });
      }

      const symbol = request.symbol.toUpperCase();

      // Round price to tick_size and amount to lot_size for the symbol.
      // Pacifica rejects requests whose price / amount aren't exact multiples.
      const roundedPrice = await roundPrice(request.price, symbol);
      const roundedAmount = await roundAmount(request.amount, symbol);

      // Prepare operation data for signing
      const operationData: Record<string, unknown> = {
        symbol,
        price: roundedPrice,
        amount: roundedAmount,
        side: request.side,
        tif: request.tif,
        slippage_percent: request.slippage_percent,
        reduce_only: request.reduce_only,
        builder_code: request.builder_code ?? BUILDER_CODE,
      };

      // Add optional fields
      if (request.client_order_id) {
        operationData.client_order_id = request.client_order_id;
      }

      // Sign the order request
      const { timestamp, signature } = await this.signOrderRequest(
        'create_order',
        operationData,
        walletAddress,
        organizationId,
        this.expiryWindow
      );

      // Build the final request
      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
        expiry_window: this.expiryWindow,
        ...operationData,
      };

      // Add optional header fields
      if (request.expiry_window !== undefined) {
        finalRequest.expiry_window = request.expiry_window;
      }
      if (request.agent_wallet) {
        finalRequest.agent_wallet = request.agent_wallet;
      }

      // Submit to Pacifica API
      const apiResponse = await this.submitToPacifica('/orders/create', finalRequest);

      if (apiResponse.error) {
        throw createError(ErrorCode.TRADE_POSITION_CREATE_FAILED, {
          error: apiResponse.error,
          code: apiResponse.code,
          symbol: request.symbol,
        });
      }

      return {
        success: true,
        order_id: String(apiResponse.order_id || ''),
        data: apiResponse,
        message: 'Limit order created successfully',
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CREATE_FAILED);
      console.error('Error creating limit order:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to create limit order',
      };
    }
  }
  /**
   * Cancels an order on Pacifica
   *
   * Either `order_id` (exchange-assigned) or `client_order_id` must be provided.
   *
   * @param request - Cancel order request parameters
   * @param walletAddress - Turnkey Solana wallet address
   * @param organizationId - Turnkey organization ID
   * @returns Success/failure response
   */
  /**
   * Fetch account settings from Pacifica (leverage, margin mode, etc.)
   *
   * GET /account/settings?account=<address>
   *
   * Returns settings for all symbols that have been changed from default.
   * Symbols not in the response use default settings (cross margin, max leverage).
   *
   * @param account - Solana wallet address
   * @returns Array of account settings per symbol
   */
  async getAccountSettings(
    account: string
  ): Promise<{ success: boolean; data?: PacificaMarginSetting[]; error?: string }> {
    try {
      if (!account) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      const response = await fetch(`${this.baseUrl}/account/settings?account=${account}`, {
        method: 'GET',
        headers: { Accept: '*/*' },
      });

      if (!response.ok) {
        throw createError(ErrorCode.API_BAD_REQUEST, {
          status: response.status,
          statusText: response.statusText,
          endpoint: '/account/settings',
        });
      }

      const json = await response.json();

      if (!json.success) {
        return {
          success: false,
          error: json.error || 'Failed to fetch Pacifica account settings',
        };
      }

      return {
        success: true,
        data: parsePacificaMarginSettings(json.data),
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.API_BAD_REQUEST);
      console.error('Error fetching Pacifica account settings:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Fetch the current leverage for a specific symbol on Pacifica.
   *
   * @param account - Solana wallet address
   * @param symbol - Asset symbol (e.g. "BTC")
   * @returns Current leverage value, or null if using default (max leverage)
   */
  async fetchLeverage(
    account: string,
    symbol: string
  ): Promise<{ success: boolean; leverage: number | null; error?: string }> {
    const settingsResult = await this.getAccountSettings(account);

    if (!settingsResult.success || !settingsResult.data) {
      return {
        success: false,
        leverage: null,
        error: settingsResult.error || 'Failed to fetch account settings',
      };
    }

    const entry = settingsResult.data.find(
      (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
    );

    let parsedLeverage: number | null = null;
    const raw = entry?.leverage;
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) parsedLeverage = n;
    }

    return {
      success: true,
      // null: no per-symbol row (Pacifica uses default / max until explicitly set)
      leverage: parsedLeverage,
    };
  }

  /**
   * Fetch the user's account balance from Pacifica.
   *
   * GET /account?account=<address>
   * Returns `available_to_spend` — free margin not locked in positions/orders.
   *
   * @param account - Solana wallet address
   * @returns Available balance in USD
   */
  async fetchAccountBalance(
    account: string
  ): Promise<{ success: boolean; availableToSpend: number; error?: string }> {
    try {
      if (!account) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      const response = await fetch(`${this.baseUrl}/account?account=${account}`, {
        method: 'GET',
        headers: { Accept: '*/*' },
      });

      // Wallets that have never used Pacifica return 404. Treat as zero balance
      // rather than a noisy error.
      if (response.status === 404) {
        return { success: true, availableToSpend: 0 };
      }

      if (!response.ok) {
        throw createError(ErrorCode.API_BAD_REQUEST, {
          status: response.status,
          statusText: response.statusText,
          endpoint: '/account',
        });
      }

      const json = await response.json();

      if (!json.success || !json.data) {
        return {
          success: false,
          availableToSpend: 0,
          error: json.error || 'Failed to fetch Pacifica account balance',
        };
      }

      const availableToSpend = parseFloat(json.data.available_to_spend ?? '0');

      return {
        success: true,
        availableToSpend: isNaN(availableToSpend) ? 0 : availableToSpend,
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.API_BAD_REQUEST);
      console.error('Error fetching Pacifica account balance:', appError);
      return {
        success: false,
        availableToSpend: 0,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Attach mirrored TP/SL to an existing Pacifica position (`POST /positions/tpsl`).
   */
  async setPositionTpSl(
    request: SetPositionTpSlRequest,
    walletAddress: string,
    organizationId: string
  ): Promise<CreateOrderResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }
      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }
      if (!request.takeProfitPrice && !request.stopLossPrice) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['takeProfitPrice or stopLossPrice'],
        });
      }

      const symbol = request.symbol.toUpperCase();
      const pacificaSide = request.side === 'bid' ? Side.Bid : Side.Ask;

      const tpSlManager = new TpSlManager();
      const { request: unsigned } = tpSlManager.prepareSetPositionTpSl({
        account: walletAddress,
        symbol,
        side: pacificaSide,
        takeProfitPrice: request.takeProfitPrice
          ? await roundPrice(request.takeProfitPrice, symbol)
          : undefined,
        takeProfitLimitPrice: request.takeProfitLimitPrice
          ? await roundPrice(request.takeProfitLimitPrice, symbol)
          : undefined,
        stopLossPrice: request.stopLossPrice
          ? await roundPrice(request.stopLossPrice, symbol)
          : undefined,
        stopLossLimitPrice: request.stopLossLimitPrice
          ? await roundPrice(request.stopLossLimitPrice, symbol)
          : undefined,
        expiryWindow: this.expiryWindow,
      });

      const operationData: Record<string, unknown> = {
        symbol: unsigned.symbol,
        side: request.side,
      };
      if (unsigned.take_profit) operationData.take_profit = unsigned.take_profit;
      if (unsigned.stop_loss) operationData.stop_loss = unsigned.stop_loss;

      const { timestamp, signature } = await this.signOrderRequest(
        'set_position_tpsl',
        operationData,
        walletAddress,
        organizationId,
        this.expiryWindow
      );

      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
        expiry_window: this.expiryWindow,
        ...operationData,
      };

      const apiResponse = await this.submitToPacifica('/positions/tpsl', finalRequest);

      if (apiResponse.error) {
        throw createError(ErrorCode.TRADE_POSITION_CREATE_FAILED, {
          error: apiResponse.error,
          code: apiResponse.code,
          symbol,
        });
      }

      return {
        success: true,
        data: apiResponse,
        message: 'Position TP/SL set successfully',
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CREATE_FAILED);
      console.error('Error setting Pacifica TP/SL:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to set position TP/SL',
      };
    }
  }

  async cancelOrder(
    request: CancelOrderRequest,
    walletAddress: string,
    organizationId: string
  ): Promise<CreateOrderResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      // Validate required fields — need at least one of order_id or client_order_id
      if (!request.symbol) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['symbol'],
        });
      }

      if (request.order_id === undefined && !request.client_order_id) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['order_id or client_order_id'],
        });
      }

      // Prepare operation data for signing
      const operationData: Record<string, unknown> = {
        symbol: request.symbol,
      };

      if (request.order_id !== undefined) {
        operationData.order_id = request.order_id;
      }
      if (request.client_order_id) {
        operationData.client_order_id = request.client_order_id;
      }

      // Sign the order request
      const { timestamp, signature } = await this.signOrderRequest(
        'cancel_order',
        operationData,
        walletAddress,
        organizationId,
        this.expiryWindow
      );

      // Build the final request
      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
        expiry_window: this.expiryWindow,
        ...operationData,
      };

      // Add optional header fields
      if (request.expiry_window !== undefined) {
        finalRequest.expiry_window = request.expiry_window;
      }
      if (request.agent_wallet) {
        finalRequest.agent_wallet = request.agent_wallet;
      }

      // Submit to Pacifica API
      const apiResponse = await this.submitToPacifica('/orders/cancel', finalRequest);

      if (apiResponse.error) {
        throw createError(ErrorCode.TRADE_POSITION_CREATE_FAILED, {
          error: apiResponse.error,
          code: apiResponse.code,
          symbol: request.symbol,
        });
      }

      return {
        success: true,
        data: apiResponse,
        message: `Order cancelled successfully for ${request.symbol}`,
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CREATE_FAILED);
      console.error('Error cancelling Pacifica order:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to cancel order',
      };
    }
  }
}

export const pacificaService = new PacificaService();
