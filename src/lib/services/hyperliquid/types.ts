export interface CreatePositionRequest {
  assetIndex: number;
  assetName: string;
  price: number;
  size: string;
  leverage?: number;
  vaultAddress?: string;
  isLong?: boolean;
  isMarket?: boolean;
  takeProfitPrice?: string;
  stopLossPrice?: string;
  canonicalTpSlPrices?: boolean;
}

export interface ClosePositionRequest {
  assetIndex: number;
  assetName: string;
  price: number;
  size: string;
  leverage?: number;
  vaultAddress?: string;
  isLong?: boolean;
  userAddress: string;
  isMarket?: boolean;
}

export interface PositionResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface HyperLiquidApiResponse {
  status: 'ok' | 'err';
  response?: string;
  data?: any;
}

export interface SignatureComponents {
  r: `0x${string}`;
  s: `0x${string}`;
  v: number;
}

export interface UpdateLeverageRequest {
  leverage: number;
  assetTicker: string;
  /** `true` = cross (default on HL UI), `false` = isolated per asset */
  isCross?: boolean;
  vaultAddress?: string;
}

export interface UserLeverageResponse {
  success: boolean;
  leverage?: number;
  error?: string;
}

export interface TradingOperationState {
  isLoading: boolean;
  error: string | null;
  lastAction: string | null;
  signingInProgress: boolean;
}

export interface TypedDataForSigning {
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
}
