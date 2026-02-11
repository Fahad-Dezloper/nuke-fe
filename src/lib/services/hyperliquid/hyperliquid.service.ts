import { PerpOrders } from '@/dex/hyperliquid/perp';
import { HYPERLIQUID_API } from '@/dex/hyperliquid/constants';
import { Signature } from 'ethers';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';
import { perpTickerToIndex } from '@/dex/hyperliquid/utils/asset-index-converter';
import { createMainnetExchangeTypedData } from '@/dex/hyperliquid/utils/signing';
import type {
  CreatePositionRequest,
  ClosePositionRequest,
  PositionResponse,
  HyperLiquidApiResponse,
  SignatureComponents,
  UpdateLeverageRequest,
  UserLeverageResponse,
} from './types';
import type { PerpOrderRequest } from '@/dex/hyperliquid/types';

export class HyperLiquidService {
  private perpOrders: PerpOrders;
  private baseUrl: string;

  constructor(baseUrl: string = HYPERLIQUID_API) {
    this.perpOrders = new PerpOrders();
    this.baseUrl = baseUrl;
  }

  /**
   * Sign L1 action with Turnkey (EIP-712)
   * Matches the format from Svelte codebase using TurnkeySigner directly
   * @param action - The action to sign
   * @param nonce - Unique request identifier
   * @param typedData - EIP-712 typed data structure
   * @param walletAddress - Turnkey wallet address to sign with
   * @param organizationId - Turnkey organization ID
   * @returns Signature components (r, s, v)
   */
  async signL1ActionWithTurnkey(
    action: Record<string, unknown>,
    nonce: number,
    typedData: {
      domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: `0x${string}`;
      };
      types: {
        [key: string]: {
          name: string;
          type: string;
        }[];
      };
      primaryType: string;
      message: Record<string, unknown>;
    },
    walletAddress: string,
    organizationId: string
  ): Promise<SignatureComponents> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      // Import Turnkey and TurnkeySigner dynamically
      const { Turnkey } = await import('@turnkey/sdk-browser');
      const { TurnkeySigner } = await import('@turnkey/ethers');

      let turnkey: InstanceType<typeof Turnkey>;
      let indexedDbClient: Awaited<ReturnType<typeof turnkey.indexedDbClient>>;
      let signer: InstanceType<typeof TurnkeySigner>;

      try {
        turnkey = new Turnkey({
          apiBaseUrl: 'https://api.turnkey.com',
          defaultOrganizationId: organizationId,
        });

        indexedDbClient = await turnkey.indexedDbClient();
        await indexedDbClient.init();
      } catch (error) {
        throw createError(
          ErrorCode.TURNKEY_CLIENT_INIT_FAILED,
          { organizationId },
          toAppError(error)
        );
      }

      try {
        signer = new TurnkeySigner({
          client: indexedDbClient,
          organizationId: organizationId,
          signWith: walletAddress,
        });
      } catch (error) {
        throw createError(
          ErrorCode.TURNKEY_SIGNER_CREATE_FAILED,
          { walletAddress, organizationId },
          toAppError(error)
        );
      }

      const domain = typedData.domain;
      const types = typedData.types;
      const value = typedData.message;

      // Sign the EIP-712 data
      let signature: string;
      try {
        signature = await signer.signTypedData(domain, types, value);
      } catch (error) {
        throw createError(
          ErrorCode.TURNKEY_SIGNATURE_FAILED,
          { walletAddress, actionType: typedData.primaryType },
          toAppError(error)
        );
      }

      const sig = Signature.from(signature);

      return {
        r: sig.r as `0x${string}`,
        s: sig.s as `0x${string}`,
        v: sig.v,
      };
    } catch (error) {
      console.error('Error signing L1 action with TurnkeySigner:', error);
      throw toAppError(error, ErrorCode.HYPERLIQUID_SIGNING_FAILED);
    }
  }

  /**
   * Submit signed data to HyperLiquid exchange
   * @param endpoint - HyperLiquid API endpoint
   * @param action - The action to submit
   * @param nonce - Unique request identifier
   * @param signature - Signature components
   * @returns HyperLiquid API response
   */
  async submitToHyperLiquid(
    endpoint: string,
    action: Record<string, unknown>,
    nonce: number,
    signature: SignatureComponents
  ): Promise<HyperLiquidApiResponse> {
    try {
      const payload = {
        action,
        nonce,
        signature,
      };

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        throw createError(ErrorCode.NET_CONNECTION_ERROR, { endpoint }, toAppError(error));
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw createError(
          ErrorCode.HYPERLIQUID_SUBMIT_FAILED,
          {
            status: response.status,
            statusText: response.statusText,
            errorText,
            endpoint,
          },
          new Error(
            `HyperLiquid API error: ${response.status} ${response.statusText} - ${errorText}`
          )
        );
      }

      const json = await response.json();
      return json;
    } catch (error) {
      console.error('Error submitting to HyperLiquid:', error);
      throw toAppError(error, ErrorCode.HYPERLIQUID_SUBMIT_FAILED);
    }
  }

  /**
   * Create a new perpetual position
   * @param request - Position creation request
   * @param walletAddress - Turnkey wallet address
   * @param organizationId - Turnkey organization ID
   * @returns Position response with success status
   */
  async createPosition(
    request: CreatePositionRequest,
    walletAddress: string,
    organizationId: string
  ): Promise<PositionResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      // Validate request
      if (!request.assetName || !request.size) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['assetName', 'size'].filter(
            (field) => !request[field as keyof CreatePositionRequest]
          ),
        });
      }

      // Convert CreatePositionRequest to PerpOrderRequest
      const perpOrderRequest: PerpOrderRequest = {
        assetIndex: request.assetIndex,
        assetName: request.assetName,
        price: request.price,
        size: request.size,
        isMarket: request.isMarket ?? false,
        vaultAddress: request.vaultAddress,
        isLong: request.isLong ?? true,
      };

      // Generate typed data using PerpOrders class
      let typedDataResult;
      try {
        typedDataResult = await this.perpOrders.createPerpPositionTypedData(perpOrderRequest);
      } catch (error) {
        throw createError(
          ErrorCode.TRADE_TYPED_DATA_GENERATION_FAILED,
          { assetName: request.assetName },
          toAppError(error)
        );
      }

      // Sign the typed data with Turnkey
      const signature = await this.signL1ActionWithTurnkey(
        typedDataResult.action,
        typedDataResult.nonce,
        typedDataResult.typedData,
        walletAddress,
        organizationId
      );

      // Submit to HyperLiquid
      const hyperLiquidResponse = await this.submitToHyperLiquid(
        typedDataResult.endpoint,
        typedDataResult.action,
        typedDataResult.nonce,
        signature
      );

      if (hyperLiquidResponse.status !== 'ok') {
        const errorMsg =
          hyperLiquidResponse.response || 'Failed to create position (unknown error)';
        throw createError(ErrorCode.TRADE_POSITION_CREATE_FAILED, {
          hyperLiquidResponse: errorMsg,
          assetName: request.assetName,
        });
      }

      return {
        success: true,
        data: hyperLiquidResponse,
        message: 'Position created successfully',
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CREATE_FAILED);
      console.error('Error creating position:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to create position',
      };
    }
  }

  /**
   * Close an existing perpetual position
   * @param request - Position close request
   * @param walletAddress - Turnkey wallet address
   * @param organizationId - Turnkey organization ID
   * @returns Position response with success status
   */
  async closePosition(
    request: ClosePositionRequest,
    walletAddress: string,
    organizationId: string
  ): Promise<PositionResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      // Validate request
      if (!request.assetName || !request.size || !request.userAddress) {
        throw createError(ErrorCode.VALID_MISSING_REQUIRED_FIELD, {
          missingFields: ['assetName', 'size', 'userAddress'].filter(
            (field) => !request[field as keyof ClosePositionRequest]
          ),
        });
      }

      // Convert ClosePositionRequest to PerpOrderRequest
      const perpOrderRequest: PerpOrderRequest = {
        assetIndex: request.assetIndex,
        assetName: request.assetName,
        price: request.price,
        size: request.size,
        isMarket: request.isMarket ?? false,
        vaultAddress: request.vaultAddress,
        isLong: request.isLong ?? true,
      };

      // Generate typed data using PerpOrders class
      let typedDataResult;
      try {
        typedDataResult = await this.perpOrders.closePerpPositionTypedData(perpOrderRequest);
      } catch (error) {
        throw createError(
          ErrorCode.TRADE_TYPED_DATA_GENERATION_FAILED,
          { assetName: request.assetName },
          toAppError(error)
        );
      }

      // Sign the typed data with Turnkey
      const signature = await this.signL1ActionWithTurnkey(
        typedDataResult.action,
        typedDataResult.nonce,
        typedDataResult.typedData,
        walletAddress,
        organizationId
      );

      // Submit to HyperLiquid
      const hyperLiquidResponse = await this.submitToHyperLiquid(
        typedDataResult.endpoint,
        typedDataResult.action,
        typedDataResult.nonce,
        signature
      );

      if (hyperLiquidResponse.status !== 'ok') {
        const errorMsg = hyperLiquidResponse.response || 'Failed to close position (unknown error)';
        throw createError(ErrorCode.TRADE_POSITION_CLOSE_FAILED, {
          hyperLiquidResponse: errorMsg,
          assetName: request.assetName,
        });
      }

      return {
        success: true,
        data: hyperLiquidResponse,
        message: 'Position closed successfully',
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_POSITION_CLOSE_FAILED);
      console.error('Error closing position:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to close position',
      };
    }
  }

  /**
   * Fetch user's current leverage for a specific asset
   * @param userAddress - User's wallet address
   * @param coin - Asset ticker (e.g., 'BTC', 'ETH')
   * @returns User leverage response
   */
  async fetchUserLeverage(userAddress: string, coin: string): Promise<UserLeverageResponse> {
    try {
      if (!userAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!coin) {
        throw createError(ErrorCode.VALID_INVALID_ASSET, {
          coin,
        });
      }

      const request = {
        type: 'activeAssetData',
        user: userAddress,
        coin: coin,
      };

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });
      } catch (error) {
        throw createError(
          ErrorCode.NET_CONNECTION_ERROR,
          { endpoint: `${this.baseUrl}/info` },
          toAppError(error)
        );
      }

      if (!response.ok) {
        throw createError(ErrorCode.TRADE_LEVERAGE_FETCH_FAILED, {
          status: response.status,
          statusText: response.statusText,
          userAddress,
          coin,
        });
      }

      const data = await response.json();

      if (!data || !data.leverage) {
        throw createError(ErrorCode.HYPERLIQUID_INVALID_RESPONSE, {
          endpoint: `${this.baseUrl}/info`,
          responseData: data,
        });
      }

      return {
        success: true,
        leverage: data.leverage.value,
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_LEVERAGE_FETCH_FAILED);
      console.error('Error fetching user leverage:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Update leverage for a specific asset on HyperLiquid.
   *
   * This is an L1 action submitted to /exchange with:
   *   { type: "updateLeverage", asset: <assetIndex>, isCross: true, leverage: <value> }
   *
   * The action is signed via Turnkey EIP-712 and submitted like any other exchange action.
   *
   * @param request - Leverage update request
   * @param walletAddress - Turnkey wallet address
   * @param organizationId - Turnkey organization ID
   * @returns Position response
   */
  async updateLeverage(
    request: UpdateLeverageRequest,
    walletAddress: string,
    organizationId: string
  ): Promise<PositionResponse> {
    try {
      if (!walletAddress) {
        throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
      }

      if (!organizationId) {
        throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
      }

      if (request.leverage < 1 || request.leverage > 50) {
        throw createError(ErrorCode.VALID_INVALID_LEVERAGE, {
          leverage: request.leverage,
          min: 1,
          max: 50,
        });
      }

      if (!request.assetTicker) {
        throw createError(ErrorCode.VALID_INVALID_ASSET, {
          assetTicker: request.assetTicker,
        });
      }
      // Resolve asset ticker to HyperLiquid asset index
      const assetIndex = await perpTickerToIndex(request.assetTicker.toUpperCase());
      if (assetIndex < 0) {
        throw createError(ErrorCode.VALID_INVALID_ASSET, {
          assetTicker: request.assetTicker,
          reason: `Asset ${request.assetTicker} not found on HyperLiquid`,
        });
      }

      // Build the L1 action
      const action: Record<string, unknown> = {
        type: 'updateLeverage',
        asset: assetIndex,
        isCross: true, // cross-margin mode
        leverage: request.leverage,
      };

      const nonce = Date.now();

      // Create typed data for mainnet signing
      const typedData = createMainnetExchangeTypedData(
        action,
        nonce,
        request.vaultAddress as `0x${string}` | undefined
      );

      // Sign with Turnkey
      const signature = await this.signL1ActionWithTurnkey(
        action,
        nonce,
        typedData,
        walletAddress,
        organizationId
      );

      // Submit to HyperLiquid /exchange
      const response = await this.submitToHyperLiquid(
        `${this.baseUrl}/exchange`,
        action,
        nonce,
        signature
      );

      if (response.status !== 'ok') {
        const errorMsg = response.response || 'Failed to update leverage (unknown error)';
        throw createError(ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED, {
          hyperLiquidResponse: errorMsg,
          assetTicker: request.assetTicker,
          leverage: request.leverage,
        });
      }

      return {
        success: true,
        data: response,
        message: `Leverage updated to ${request.leverage}x for ${request.assetTicker}`,
      };
    } catch (error) {
      const appError = toAppError(error, ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED);
      console.error('Error updating leverage:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
        message: 'Failed to update leverage',
      };
    }
  }
}

export const hyperLiquidService = new HyperLiquidService();
