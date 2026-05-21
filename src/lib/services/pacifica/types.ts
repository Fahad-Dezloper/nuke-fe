import type { Side } from '@/dex/pacifica/types';

export interface CreateMarketOrderRequest {
  symbol: string;
  amount: string; // Must be string per API
  side: 'bid' | 'ask'; // Lowercase per API
  slippage_percent: string; // Must be string per API
  reduce_only: boolean;
  client_order_id?: string;
  take_profit?: {
    stop_price: string;
    limit_price?: string;
    client_order_id?: string;
  };
  stop_loss?: {
    stop_price: string;
    limit_price?: string;
    client_order_id?: string;
  };
  agent_wallet?: string;
  expiry_window?: number;
  builder_code?: string;
  /** Hedge plan prices already snapped to Pacifica tick — do not re-floor upper band. */
  tpsl_prices_pre_quantized?: boolean;
}

export interface CreateLimitOrderRequest {
  symbol: string;
  price: string;
  amount: string;
  side: 'bid' | 'ask';
  tif: 'GTC' | 'IOC' | 'ALO' | 'TOB';
  slippage_percent: string;
  reduce_only: boolean;
  client_order_id?: string;
  agent_wallet?: string;
  expiry_window?: number;
  builder_code?: string;
}

export interface SetPositionTpSlRequest {
  symbol: string;
  /** Position side: bid = long, ask = short */
  side: 'bid' | 'ask';
  takeProfitPrice?: string;
  takeProfitLimitPrice?: string;
  stopLossPrice?: string;
  stopLossLimitPrice?: string;
}

export interface CancelOrderRequest {
  symbol: string;
  order_id?: number;
  client_order_id?: string;
  agent_wallet?: string;
  expiry_window?: number;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id?: string;
  data?: any;
  error?: string;
  message?: string;
}

export interface PacificaApiResponse {
  order_id?: string | number;
  error?: string;
  code?: number;
}

export interface SigningData {
  type: string;
  timestamp: number;
  expiry_window?: number;
  data: Record<string, unknown>;
}

export interface TradingOperationState {
  isLoading: boolean;
  error: string | null;
  lastAction: string | null;
  signingInProgress: boolean;
}
