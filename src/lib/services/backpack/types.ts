export type BackpackSide = 'Bid' | 'Ask';
export type BackpackOrderType = 'Market' | 'Limit';

export interface BackpackApiError {
  code?: string;
  message?: string;
}

export interface BackpackOrderExecuteRequest {
  symbol: string;
  side: BackpackSide;
  orderType: BackpackOrderType;
  quantity?: string;
  quoteQuantity?: string;
  price?: string;
  reduceOnly?: boolean;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  clientId?: number;
  postOnly?: boolean;
  selfTradePrevention?: 'RejectTaker' | 'RejectMaker' | 'RejectBoth';
  slippageTolerance?: string;
  slippageToleranceType?: 'TickSize' | 'Percent';
}

export interface BackpackOrderExecuteResponse {
  orderType: BackpackOrderType;
  id: string;
  clientId: number;
  createdAt: number;
  executedQuantity: string;
  executedQuoteQuantity: string;
  quantity: string;
  quoteQuantity: string;
  reduceOnly: boolean;
  timeInForce: string;
  side: BackpackSide;
  status: string;
  symbol: string;
}

export interface BackpackPosition {
  symbol: string;
  positionId: string;
  breakEvenPrice: string;
  entryPrice: string;
  markPrice: string;
  netQuantity: string;
  netExposureQuantity: string;
  netExposureNotional: string;
  pnlUnrealized: string;
  pnlRealized: string;
  cumulativeFundingPayment: string;
  estLiquidationPrice?: string;
  accountLeverage?: string;
  subaccountId?: number;
}

export interface BackpackFundingPayment {
  symbol: string;
  quantity: string;
  intervalEndTimestamp: string;
  fundingRate: string;
  subaccountId: number;
  userId: number;
}

export interface BackpackUpdateAccountRequest {
  leverageLimit?: string;
  autoLend?: boolean;
  autoRepayBorrows?: boolean;
  autoBorrowSettlements?: boolean;
}

export interface BackpackAccount {
  leverageLimit?: string;
  autoLend?: boolean;
  autoRepayBorrows?: boolean;
  autoBorrowSettlements?: boolean;
  autoRealizePnl?: boolean;
  autoLendRedeem?: boolean;
  borrowLimit?: string;
  positionLimit?: string;
  liquidating?: boolean;
}

