import { encode } from "@msgpack/msgpack";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import { HYPERLIQUID_API, marketSlippage } from "./constants";
import { perpIndexToTicker } from "./utils/asset-index-converter";
import { MarketPriceHelper } from "./utils/market-price";
import {
  createMainnetExchangeTypedData,
  createTestnetExchangeTypedData,
  ValueType,
} from "./utils/signing";
import { CancelTpSlParms, Hex, TpSlOrder, TpSlParams } from "./types";

export class TpSlManager {
  private baseUrl = HYPERLIQUID_API;

  constructor(private isTestnet: boolean = false) {
    if (this.isTestnet) {
      this.baseUrl = "https://api.hyperliquid-testnet.xyz";
    }
  }

  /**
   * Places take-profit and/or stop-loss orders for a position
   */
  public async placeTpSlOrders(params: TpSlParams) {
    try {
      const orders: TpSlOrder[] = [];

      const assetName = await perpIndexToTicker(params.assetId);

      if (!assetName) throw new Error("Asset name not found");

      const marketPriceHelper = new MarketPriceHelper();
      const tickInfo = await marketPriceHelper.getTickAndLotSize(
        assetName,
        "perps",
      );

      if (!tickInfo) throw new Error("Tick info details not found");

      // Take Profit Order
      if (
        params.finalTakeProfitPrice &&
        params.currentPositionSize &&
        parseFloat(params.currentPositionSize) > 0
      ) {
        // Use provided TP size or default to full position size
        const tpSize = params.takeProfitSize || params.currentPositionSize;

        //if long decrease the price by marketSlippage percentage otherwise increase it by marketSlippage percentage
        const priceWithSlippage = params.isLong
          ? tickInfo.roundPrice(
              Number(params.finalTakeProfitPrice) -
                (Number(params.finalTakeProfitPrice) * marketSlippage) / 100,
            )
          : tickInfo.roundPrice(
              Number(params.finalTakeProfitPrice) +
                (Number(params.finalTakeProfitPrice) * marketSlippage) / 100,
            );

        orders.push({
          a: params.assetId,
          b: !params.isLong, // Opposite of position direction
          p: priceWithSlippage,
          s: tickInfo.roundSize(Number(tpSize)),
          r: true, // Reduce only
          t: {
            trigger: {
              isMarket: true,
              triggerPx: tickInfo.roundPrice(
                Number(params.finalTakeProfitPrice),
              ),
              tpsl: "tp",
            },
          },
        });
      }

      // Stop Loss Order
      if (
        params.finalStopLossPrice &&
        params.currentPositionSize &&
        parseFloat(params.currentPositionSize) > 0
      ) {
        // Use provided SL size or default to full position size
        const slSize = params.stopLossSize || params.currentPositionSize;

        const priceWithSlippage = params.isLong
          ? tickInfo.roundPrice(
              Number(params.finalStopLossPrice) -
                (Number(params.finalStopLossPrice) * marketSlippage) / 100,
            )
          : tickInfo.roundPrice(
              Number(params.finalStopLossPrice) +
                (Number(params.finalStopLossPrice) * marketSlippage) / 100,
            );

        orders.push({
          a: params.assetId,
          b: !params.isLong, // Opposite of position direction
          p: priceWithSlippage,
          s: tickInfo.roundSize(Number(slSize)),
          r: true, // Reduce only
          t: {
            trigger: {
              isMarket: true,
              triggerPx: tickInfo.roundPrice(Number(params.finalStopLossPrice)),
              tpsl: "sl",
            },
          },
        });
      }

      if (orders.length === 0) {
        throw new Error(
          "No take profit or stop loss price provided, or position size is zero.",
        );
      }

      const action: ValueType = {
        type: "order",
        orders,
        grouping: "na",
        //TODO: add builder fee
        // builder: {
        //   b: HYPERLIQUID_BUILDER_ADDRESS,
        //   f: HYPERLIQUID_PERP_BUILDER_FEE,
        // },
      };

      const nonce = Date.now();
      const typedData = this.isTestnet
        ? createTestnetExchangeTypedData(action, nonce)
        : createMainnetExchangeTypedData(action, nonce);

      return {
        action,
        nonce,
        typedData,
        endpoint: `${this.baseUrl}/exchange`,
      };
    } catch (error) {
      console.error("Error placing TP/SL orders:", error);
      throw error;
    }
  }

  /**
   * Cancels existing TP/SL orders by their order IDs
   */
  public async cancelTpSlOrders(params: CancelTpSlParms) {
    try {
      const action = {
        type: "cancel",
        cancels: params.orderIds.map((orderId) => ({
          a: params.assetId,
          o: orderId,
        })),
      };

      const nonce = Date.now();

      // another issue with cancelling orders (the oid from hyperliquid is always parsed to a bigint in signing logic which breaks it. Why does Hyperliquid hate us like this?)
      // this really needs to be centralized to a single helper function
      const msgPackBytes = encode(action);
      const data = new Uint8Array(
        msgPackBytes.length + (params.vaultAddress ? 29 : 9),
      );
      data.set(msgPackBytes);
      const view = new DataView(data.buffer);
      view.setBigUint64(msgPackBytes.length, BigInt(nonce));
      if (params.vaultAddress) {
        view.setUint8(msgPackBytes.length + 8, 1);
        data.set(
          hexToBytes(params.vaultAddress.slice(2)),
          msgPackBytes.length + 9,
        );
      } else {
        view.setUint8(msgPackBytes.length + 8, 0);
      }
      const hashBytes = keccak_256(data);
      const actionHash = `0x${bytesToHex(hashBytes)}` as Hex;

      const typedData = {
        domain: {
          name: "Exchange",
          version: "1",
          chainId: 1337, // use 1337 even for mainnet?
          verifyingContract:
            "0x0000000000000000000000000000000000000000" as `0x${string}`,
        },
        types: {
          Agent: [
            { name: "source", type: "string" },
            { name: "connectionId", type: "bytes32" },
          ],
        },
        primaryType: "Agent",
        message: {
          source: "a", // "a" for mainnet
          connectionId: actionHash,
        },
      };

      return {
        action,
        nonce,
        typedData,
        endpoint: `${this.baseUrl}/exchange`,
      };
    } catch (error) {
      console.error("Error canceling TP/SL orders:", error);
      throw error;
    }
  }

  /**
   * Updates existing TP/SL orders with new prices
   */
  public async updateTpSlOrders(
    params: {
      assetId: number;
      isLong: boolean;
      currentPositionSize: string;
      finalTakeProfitPrice?: string;
      finalStopLossPrice?: string;
      vaultAddress?: string;
    },
    existingTpOrderId?: number, //  optional
    existingSlOrderId?: number, //  optional
  ) {
    const transactions: Array<any> = [];

    try {
      const orderIdsToCancel: number[] = [];
      if (existingTpOrderId) orderIdsToCancel.push(existingTpOrderId);
      if (existingSlOrderId) orderIdsToCancel.push(existingSlOrderId);

      // First cancel existing orders if any IDs are provided
      if (orderIdsToCancel.length > 0) {
        const cancelResponse = await this.cancelTpSlOrders({
          assetId: params.assetId,
          orderIds: orderIdsToCancel,
          vaultAddress: params.vaultAddress,
        });
        transactions.push(cancelResponse);
      }

      //  place new orders (only if TP or SL price is provided)
      if (params.finalTakeProfitPrice || params.finalStopLossPrice) {
        const typedData = await this.placeTpSlOrders(params);
        transactions.push(typedData);
      }

      return transactions;
    } catch (error) {
      console.error("Error updating TP/SL orders:", error);
      throw error;
    }
  }
}
