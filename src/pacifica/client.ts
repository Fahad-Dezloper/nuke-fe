import { PACIFICA_HTTP_URL } from "./constants";
import {
  CreateMarketOrderReq,
  CreateLimitOrderReq,
  CreateOrderResponse,
  CancelOrderReq,
  CancelOrderResponse,
  SetPositionTpSlReq,
  SetPositionTpSlResponse,
} from "./types";

export class PacificaClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = PACIFICA_HTTP_URL;
    this.timeout = 30000; // 30 seconds
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createMarketOrder(
    createOrderReq: CreateMarketOrderReq,
  ): Promise<string> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}orders/create_market`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createOrderReq),
      },
    );

    if (response.ok) {
      const data: CreateOrderResponse = await response.json();
      return data.order_id;
    }

    if (response.status === 400) {
      throw new Error("Failed to create a market order. Bad request");
    }

    throw new Error("Internal server error");
  }

  async createLimitOrder(createOrderReq: CreateLimitOrderReq): Promise<string> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}orders/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createOrderReq),
      },
    );

    if (response.ok) {
      const data: CreateOrderResponse = await response.json();
      return data.order_id;
    }

    if (response.status === 400) {
      throw new Error("Failed to create a limit order. Bad request");
    }

    throw new Error("Internal server error");
  }

  async cancelOrder(cancelOrderReq: CancelOrderReq) {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/orders/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cancelOrderReq),
      },
    );

    if (!response.ok) {
      const data: CancelOrderResponse = await response.json();
      return data.success;
    }

    if (response.status === 400) {
      throw new Error("Failed to cancel order. Bad request");
    }

    throw new Error("Internal server error");
  }

  async setPositionTpSl(
    setPositionTpSlReq: SetPositionTpSlReq,
  ): Promise<boolean> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/positions/tpsl`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(setPositionTpSlReq),
      },
    );

    if (response.ok) {
      const data: SetPositionTpSlResponse = await response.json();
      return data.success;
    }

    if (response.status === 400) {
      throw new Error("Failed to set position TP/SL. Bad request");
    }

    throw new Error("Internal server error");
  }
}
