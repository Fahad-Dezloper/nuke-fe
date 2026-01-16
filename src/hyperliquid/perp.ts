import { HYPERLIQUID_API, marketSlippage } from "./constants";
import {
  Hex,
  PerpOrderRequest,
  PerpOrderTypedDataReturn,
  ValueMap,
} from "./types";
import { MarketPriceHelper } from "./utils/market-price";
import { createMainnetExchangeTypedData } from "./utils/signing";

export class PerpOrders {
  protected baseUrl = HYPERLIQUID_API;

  constructor() {}

  /*
  ERROR : PRICE GOING IN BTC INSTEAD
  */
  async createPerpPositionTypedData(
    orderRequest: PerpOrderRequest
  ): Promise<PerpOrderTypedDataReturn> {
    try {
      const {
        assetIndex,
        assetName,
        price,
        size,
        vaultAddress,
        isLong = true,
        isMarket = false,
      } = orderRequest;

      if (!isMarket && !price)
        throw new Error("Order is limit order, but no limit price received");

      const marketPriceHelper = new MarketPriceHelper();
      const tickInfo = await marketPriceHelper.getTickAndLotSize(
        assetName,
        "perps"
      );

      if (!tickInfo) {
        throw new Error(`Could not get tick info for ${assetName}`);
      }

      let buyingPrice = isMarket
        ? (
            await marketPriceHelper.getMarketPriceForTrading(
              assetName,
              "perps",
              isLong ? "buy" : "sell"
            )
          ).price
        : price;

      if (price < 0) throw new Error("Price cannot be less than 0");

      //size here is actually in USD, but we need to convert it to the asset amount
      let buyingAmount = size;

      if (buyingPrice && !isNaN(parseFloat(size))) {
        buyingAmount = tickInfo.roundSize(parseFloat(size) / buyingPrice);
      } else {
        const tradingError = "Invalid price or amount";
        throw new Error(tradingError);
      }

      //If the order is market order, then add the slippage
      if (isMarket) {
        if (isLong) {
          buyingPrice = buyingPrice + buyingPrice * (marketSlippage / 100);
        } else {
          buyingPrice = buyingPrice - buyingPrice * (marketSlippage / 100);
        }
      }

      const action: ValueMap = {
        type: "order",
        orders: [
          {
            a: assetIndex,
            b: isLong,
            p: tickInfo.roundPrice(buyingPrice),
            s: buyingAmount,
            r: false,
            t: { limit: { tif: isMarket ? "Ioc" : "Gtc" } },
          },
        ],
        grouping: "na",
        //TODO: add builder address
        // builder: {
        //   b: HYPERLIQUID_BUILDER_ADDRESS,
        //   f: HYPERLIQUID_PERP_BUILDER_FEE,
        // },
      };

      const nonce = Date.now();
      const typedData = createMainnetExchangeTypedData(
        action,
        nonce,
        vaultAddress as `0x${string}`
      );

      return {
        action,
        typedData,
        nonce,
        endpoint: `${this.baseUrl}/exchange`,
      };
    } catch (error) {
      console.error("Error creating long position:", error);
      throw error;
    }
  }

  async closePerpPositionTypedData(
    orderRequest: PerpOrderRequest
  ): Promise<PerpOrderTypedDataReturn> {
    try {
      const {
        assetIndex,
        assetName,
        price,
        size,
        vaultAddress,
        isLong = true,
        isMarket = false,
      } = orderRequest;

      const marketPriceHelper = new MarketPriceHelper();
      const tickInfo = await marketPriceHelper.getTickAndLotSize(
        assetName,
        "perps"
      );

      if (!tickInfo) {
        throw new Error(`Could not get tick info for ${assetName}`);
      }

      let sellingPrice = isMarket
        ? (
            await marketPriceHelper.getMarketPriceForTrading(
              assetName,
              "perps",
              //since we are closing the position, the order should be reversed, if isLong then sell else buy
              isLong ? "sell" : "buy"
            )
          ).price
        : price;

      //If the order is market order, then add the slippage
      if (isMarket) {
        if (isLong) {
          //if position is long then we are opening a short so substract the slippage
          sellingPrice = sellingPrice - sellingPrice * (marketSlippage / 100);
        } else {
          // if position is short then we are opening a long so add the slippage
          sellingPrice = sellingPrice + sellingPrice * (marketSlippage / 100);
        }
      }

      const action: ValueMap = {
        type: "order",
        orders: [
          {
            a: assetIndex,
            b: !isLong,
            p: tickInfo.roundPrice(sellingPrice),
            s: size,
            r: true,
            t: { limit: { tif: isMarket ? "Ioc" : "Gtc" } },
          },
        ],
        grouping: "na",
        //TODO: add builder address
        // builder: {
        //   b: HYPERLIQUID_BUILDER_ADDRESS,
        //   f: HYPERLIQUID_PERP_BUILDER_FEE,
        // },
      };

      const nonce = Date.now();
      const typedData = createMainnetExchangeTypedData(
        action,
        nonce,
        vaultAddress as Hex
      );

      return {
        action,
        typedData,
        nonce,
        endpoint: `${this.baseUrl}/exchange`,
      };
    } catch (error) {
      console.error("Error closing position:", error);
      throw error;
    }
  }

  async closeAllPerpPositionTypedData(ordersRequest: PerpOrderRequest[]) {
    try {
      const closePositionTypedDataArray: Array<PerpOrderTypedDataReturn> = [];

      for (const orderRequest of ordersRequest) {
        const typedData = await this.closePerpPositionTypedData(orderRequest);

        closePositionTypedDataArray.push(typedData);
      }

      return closePositionTypedDataArray;
    } catch (error) {
      console.error("Error closing all positions: ", error);
      throw error;
    }
  }
}
