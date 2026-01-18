export enum Side {
  Bid = "Bid",
  Ask = "Ask",
}

export enum Tif {
  GTC = "GTC",
  IOC = "IOC",
  ALO = "ALO",
  TOB = "TOB",
}

export interface CreateMarketOrderReq {
  account: string;
  signature: string;
  timestamp: number;
  symbol: string;
  amount: number;
  side: Side;
  slippage_percent: number;
  reduce_only: boolean;
  limit_price?: string;
  agent_wallet?: string;
  expiry_window?: number;
}

export interface CreateLimitOrderReq {
  account: string;
  signature: string;
  timestamp: number;
  symbol: string;
  price: string;
  amount: number;
  side: Side;
  tif: Tif;
  slippage_percent: number;
  reduce_only: boolean;
  limit_price?: string;
  agent_wallet?: string;
  expiry_window?: number;
}

export interface CancelOrderReq {
  account: string;
  signature: string;
  timestamp: string;
  symbol: string;
  order_id: number;
  client_order_id: string;
}

export interface CreateOrderResponse {
  order_id: string;
}

export interface CancelOrderResponse {
  success: boolean;
}

export interface TpSlStopOrder {
  stop_price: string;
  limit_price?: string;
  client_order_id?: string;
}

export interface SetPositionTpSlReq {
  account: string;
  signature: string;
  timestamp: number;
  symbol: string;
  side: Side;
  take_profit?: TpSlStopOrder;
  stop_loss?: TpSlStopOrder;
  agent_wallet?: string;
  expiry_window?: number;
}

export interface SetPositionTpSlResponse {
  success: boolean;
}

export interface TpSlParams {
  account: string;
  symbol: string;
  side: Side;
  takeProfitPrice?: string;
  takeProfitLimitPrice?: string;
  takeProfitClientOrderId?: string;
  stopLossPrice?: string;
  stopLossLimitPrice?: string;
  stopLossClientOrderId?: string;
  agentWallet?: string;
  expiryWindow?: number;
}
