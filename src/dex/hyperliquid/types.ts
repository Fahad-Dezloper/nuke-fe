export type ValueMap = Record<string, unknown>;
export type Hex = `0x${string}`;

export interface TpSlParams {
  assetId: number;
  isLong: boolean;
  currentPositionSize: string;
  finalTakeProfitPrice?: string;
  finalStopLossPrice?: string;
  takeProfitSize?: string;
  stopLossSize?: string;
  vaultAddress?: string;
}

export interface TpSlOrder {
  a: number; // assetId
  b: boolean; // isBuy (opposite of position direction for TP/SL)
  p: string; // price with slippage
  s: string; // size
  r: boolean; // reduce only
  t: {
    trigger: {
      isMarket: boolean;
      triggerPx: string;
      tpsl: 'tp' | 'sl';
    };
  };
}

export interface CancelTpSlParms {
  assetId: number;
  orderIds: number[];
  vaultAddress?: string;
}

export interface PerpOrderRequest {
  assetIndex: number;
  assetName: string;
  price: number;
  size: string;
  isMarket?: boolean;
  vaultAddress?: string;
  isLong?: boolean;
  /** Optional: attach TP/SL triggers in the same `order` action (`grouping: normalTpsl`). */
  takeProfitPrice?: string;
  stopLossPrice?: string;
  /** Use Pacifica-snapped prices as-is (trigger = limit, no HL slippage skew). */
  canonicalTpSlPrices?: boolean;
}

export interface PerpOrderTypedDataReturn {
  action: ValueMap;
  typedData: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: Hex;
    };
    types: {
      [key: string]: {
        name: string;
        type: string;
      }[];
    };
    primaryType: string;
    message: {
      [key: string]: any;
    };
  };
  nonce: number;
  endpoint: string;
}
