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

export interface CreateOrderResponse {
  order_id: string;
}
