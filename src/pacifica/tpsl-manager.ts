import { PACIFICA_HTTP_URL } from "./constants";
import {
  Side,
  TpSlParams,
  SetPositionTpSlReq,
  TpSlStopOrder,
} from "./types";

export interface TpSlSigningData {
  type: string;
  request: Omit<SetPositionTpSlReq, "signature">;
  endpoint: string;
}

export class TpSlManager {
  private baseUrl: string;

  constructor() {
    this.baseUrl = PACIFICA_HTTP_URL;
  }

  /**
   * Prepares the signing data for setting TP/SL on a position
   * Returns the data needed for signing - the actual API call should be made after signing
   */
  public prepareSetPositionTpSl(params: TpSlParams): TpSlSigningData {
    if (!params.takeProfitPrice && !params.stopLossPrice) {
      throw new Error(
        "At least one of take profit or stop loss price must be provided",
      );
    }

    let takeProfit: TpSlStopOrder | undefined;
    let stopLoss: TpSlStopOrder | undefined;

    if (params.takeProfitPrice) {
      takeProfit = {
        stop_price: params.takeProfitPrice,
        limit_price: params.takeProfitLimitPrice,
        client_order_id: params.takeProfitClientOrderId,
      };
    }

    if (params.stopLossPrice) {
      stopLoss = {
        stop_price: params.stopLossPrice,
        limit_price: params.stopLossLimitPrice,
        client_order_id: params.stopLossClientOrderId,
      };
    }

    const timestamp = Date.now();

    const request: Omit<SetPositionTpSlReq, "signature"> = {
      account: params.account,
      timestamp,
      symbol: params.symbol,
      side: params.side,
      take_profit: takeProfit,
      stop_loss: stopLoss,
      agent_wallet: params.agentWallet,
      expiry_window: params.expiryWindow,
    };

    return {
      type: "set_position_tpsl",
      request,
      endpoint: `${this.baseUrl}/positions/tpsl`,
    };
  }

  /**
   * Sets take profit and/or stop loss for an existing position
   * Requires a signed request
   */
  public async setPositionTpSl(
    request: SetPositionTpSlReq,
  ): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/positions/tpsl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (response.ok) {
      return true;
    }

    if (response.status === 400) {
      throw new Error("Failed to set position TP/SL. Bad request");
    }

    throw new Error("Internal server error");
  }
}
