import { PacificaClient } from "./client";
import {
  CreateMarketOrderReq,
  CreateLimitOrderReq,
  CancelOrderReq,
  SetPositionTpSlReq,
} from "./types";

export async function createPerpMarketOrder(
  createOrderReq: CreateMarketOrderReq,
): Promise<string> {
  const client = new PacificaClient();
  const orderId = await client.createMarketOrder(createOrderReq);
  return orderId;
}

export async function createPerpLimitOrder(
  createOrderReq: CreateLimitOrderReq,
): Promise<string> {
  const client = new PacificaClient();
  const orderId = await client.createLimitOrder(createOrderReq);
  return orderId;
}

export async function cancelOrder(
  cancelOrderReq: CancelOrderReq,
): Promise<boolean> {
  const client = new PacificaClient();

  const isSuccess = await client.cancelOrder(cancelOrderReq);

  return isSuccess;
}

export async function setPositionTpSl(
  setPositionTpSlReq: SetPositionTpSlReq,
): Promise<boolean> {
  const client = new PacificaClient();

  const isSuccess = await client.setPositionTpSl(setPositionTpSlReq);

  return isSuccess;
}
