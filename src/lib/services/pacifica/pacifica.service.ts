import { PACIFICA_HTTP_URL } from '@/dex/pacifica/constants';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';
import type {
  CreateMarketOrderRequest,
  CreateLimitOrderRequest,
  CreateOrderResponse,
  PacificaApiResponse,
} from './types';
import { prepareSigningData, messageToBytes } from './utils/signing';
import { signPacificaMessageWithTurnkey } from './utils/turnkey-signing';

export class PacificaService {
  private baseUrl: string;
  private timeout: number;

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

      // Prepare operation data for signing
      const operationData: Record<string, unknown> = {
        symbol: request.symbol,
        amount: request.amount, // Already a string
        side: request.side,
        slippage_percent: request.slippage_percent,
        reduce_only: request.reduce_only,
      };

      // Add optional fields
      if (request.client_order_id) {
        operationData.client_order_id = request.client_order_id;
      }
      if (request.take_profit) {
        operationData.take_profit = request.take_profit;
      }
      if (request.stop_loss) {
        operationData.stop_loss = request.stop_loss;
      }

      // Sign the order request
      const { timestamp, signature } = await this.signOrderRequest(
        'create_market_order',
        operationData,
        walletAddress,
        organizationId,
        request.expiry_window
      );

      // Build the final request (operation data + signature header fields)
      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
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

      // Prepare operation data for signing
      const operationData: Record<string, unknown> = {
        symbol: request.symbol,
        price: request.price,
        amount: request.amount,
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
        request.expiry_window
      );

      // Build the final request
      const finalRequest: Record<string, unknown> = {
        account: walletAddress,
        signature,
        timestamp,
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
}

export const pacificaService = new PacificaService();
