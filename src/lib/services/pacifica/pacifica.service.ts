import { PACIFICA_HTTP_URL } from '@/dex/pacifica/constants';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';
import type {
  CreateMarketOrderRequest,
  CreateLimitOrderRequest,
  CancelOrderRequest,
  CreateOrderResponse,
  PacificaApiResponse,
} from './types';
import { prepareSigningData, messageToBytes } from './utils/signing';
import { signPacificaMessageWithTurnkey } from './utils/turnkey-signing';
import { roundAmount, roundPrice } from '@/dex/pacifica/utils/rounding';
import axios from 'axios';

export const ACCESS_CODE = 'HV6X60D82C3SDGAS';
export const EXPIRY_WINDOW = 300000;

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


  async whitelistAddress(organizationId: string, account: string, timestamp: number) {
    const message = new TextEncoder().encode(
      JSON.stringify({
        data: { code: ACCESS_CODE },
        expiry_window: EXPIRY_WINDOW,
        timestamp,
        type: 'claim_access_code',
      })
    );
    const signature = await signPacificaMessageWithTurnkey(message, account, organizationId);

    const { data } = await axios.post(`${PACIFICA_HTTP_URL}/whitelist/claim`, {
      account,
      code: ACCESS_CODE,
      signature: {
        type: 'raw',
        value: signature,
      },
      timestamp,
      expiry_window: EXPIRY_WINDOW,
    });

    return data;
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

      // Prepare operation data for signing
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
      };

      // Add optional fields
      if (request.client_order_id) {
        operationData.client_order_id = request.client_order_id;
      }

      if (request.take_profit) {
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

      if (request.stop_loss) {
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
  ): Promise<{ success: boolean; data?: Array<{ symbol: string; isolated: boolean; leverage: number }>; error?: string }> {
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
        data: json.data || [],
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

    return {
      success: true,
      // null means default (max leverage) — symbol not customized
      leverage: entry ? entry.leverage : null,
    };
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
