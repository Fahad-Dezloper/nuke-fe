export type ValueMap = Record<string, unknown>;
export type Hex = `0x${string}`;

export interface PerpOrderRequest {
  assetIndex: number;
  assetName: string;
  price: number;
  size: string;
  isMarket?: boolean;
  vaultAddress?: string;
  isLong?: boolean;
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
