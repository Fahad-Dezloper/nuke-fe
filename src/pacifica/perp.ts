import { PacificaClient } from "./client";
import { CreateMarketOrderReq, CreateLimitOrderReq } from "./types";

export async function createPerpMarketOrder(
  createOrderReq: CreateMarketOrderReq
): Promise<string> {
  const client = new PacificaClient();
  const orderId = await client.createMarketOrder(createOrderReq);
  return orderId;
}

export async function createPerpLimitOrder(
  createOrderReq: CreateLimitOrderReq
): Promise<string> {
  const client = new PacificaClient();
  const orderId = await client.createLimitOrder(createOrderReq);
  return orderId;
}
