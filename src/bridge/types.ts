export interface QuoteParams {
  user: string;
  origin_chain_id: number;
  destination_chain_id: number;
  origin_currecny: string;
  destination_currency: string;
  amount: string;
  trade_type: string;
  use_permit: boolean;
}
