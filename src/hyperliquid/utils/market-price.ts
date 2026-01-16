import axios from "axios";

import { HYPERLIQUID_API } from "../constants";
import { getPerpMeta, getSpotMeta } from "./get-meta";

interface AssetInfo {
  szDecimals: number;
  name: string;
  maxLeverage: number;
  isDelisted?: boolean;
}

interface L2BookResponse {
  coin: string;
  time: number;
  levels: [
    Array<{ px: string; sz: string; n: number }>, // bids
    Array<{ px: string; sz: string; n: number }> // asks
  ];
}

export class MarketPriceHelper {
  private baseUrl: string;

  constructor(isTestnet: boolean = false) {
    this.baseUrl = isTestnet
      ? "https://api.hyperliquid-testnet.xyz"
      : HYPERLIQUID_API;
  }

  async getCurrentPrice(assetIndex: number): Promise<number> {
    try {
      // First get asset info to get the coin name
      const metaResponse = await axios.post(`${this.baseUrl}/info`, {
        type: "meta",
      });

      const meta = metaResponse.data;
      if (!meta?.universe?.[assetIndex]) {
        throw new Error(`Asset index ${assetIndex} not found`);
      }

      const asset = meta.universe[assetIndex] as AssetInfo;
      if (asset.isDelisted) {
        throw new Error(`Asset ${asset.name} is delisted`);
      }

      // Get L2 book for the coin
      const bookResponse = await axios.post(`${this.baseUrl}/info`, {
        type: "l2Book",
        coin: asset.name,
      });

      const book = bookResponse.data as L2BookResponse;
      if (!book?.levels?.[0]?.[0]?.px) {
        throw new Error(`No price data available for ${asset.name}`);
      }

      // Use the best bid price
      const price = parseFloat(book.levels[0][0].px);

      return price;
    } catch (error) {
      console.error("Failed to fetch current price:", error);
      throw error;
    }
  }

  async getCurrentSpotPrice(assetName: string) {
    try {
      let asset = assetName;

      if (assetName === "BTC") {
        asset = "UBTC";
      } else if (assetName === "ETH") {
        asset = "UETH";
      } else if (assetName === "SOL") {
        asset = "USOL";
      }

      const spotMeta = await getSpotMeta();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = spotMeta.tokens.find((t: any) => t.name === asset);
      const tokenId = token?.tokenId;
      const response = await axios.post(`${this.baseUrl}/info`, {
        type: "tokenDetails",
        tokenId: tokenId,
      });

      return response.data.midPx;
    } catch (error) {
      console.error("Failed to get current price. Error: ", error);
    }
  }

  async getTickAndLotSize(assetName: string, market: "spot" | "perps") {
    const MAX_DECIMALS = market === "perps" ? 6 : 8;

    let asset = assetName;

    if (market === "spot") {
      if (assetName === "BTC") {
        asset = "UBTC";
      } else if (assetName === "ETH") {
        asset = "UETH";
      } else if (assetName === "SOL") {
        asset = "USOL";
      }
    }

    const perpMeta = await getPerpMeta();
    const spotMeta = await getSpotMeta();

    const szDecimals =
      market === "perps"
        ? perpMeta.find((t) => t.name === asset.toUpperCase())?.szDecimals
        : spotMeta.tokens.find((t) => t.name === asset.toUpperCase())
            ?.szDecimals;

    if (szDecimals === undefined) return;

    const pxDecimals = MAX_DECIMALS - szDecimals;

    return {
      szDecimals,
      pxDecimals,
      roundSize: (size: number) => {
        const factor = Math.pow(10, szDecimals);
        const roundedDownSize = Math.floor(size * factor) / factor;
        // Convert to number then to string to remove trailing zeros
        return Number(roundedDownSize.toFixed(szDecimals)).toString();
      },
      roundPrice: (price: number) => {
        const precisionDecimals =
          assetName === "BTC" ? (price.toFixed(0).length === 5 ? 5 : 6) : 5;
        // Round to 5 significant figures (max as per HL docs)
        const precisePriceStr = price.toPrecision(precisionDecimals);

        // Format to required decimal places (this might add trailing zeros)
        const formattedPrice = Number(precisePriceStr).toFixed(pxDecimals);
        // Convert back to number and then string to remove any trailing zeros (which would break signing logic)
        return Number(formattedPrice).toString();
      },
    };
  }

  async listAvailableAssets(): Promise<
    { index: number; name: string; price: string }[]
  > {
    try {
      const metaResponse = await axios.post(`${this.baseUrl}/info`, {
        type: "meta",
      });

      const meta = metaResponse.data;
      if (!meta?.universe || !Array.isArray(meta.universe)) {
        throw new Error("Invalid API response structure");
      }

      // Get prices for non-delisted assets
      const assets = meta.universe
        .map(async (asset: AssetInfo, index: number) => {
          if (asset.isDelisted) return null;

          try {
            const price = await this.getCurrentPrice(index);
            return {
              index,
              name: asset.name,
              price: price.toString(),
            };
          } catch (error) {
            console.warn(`Failed to get price for ${asset.name}:`, error);
            return null;
          }
        })
        .filter(Boolean); // Remove null entries

      return Promise.all(assets);
    } catch (error) {
      console.error("Failed to fetch assets:", error);
      throw error;
    }
  }

  async isPriceValid(assetIndex: number, orderPrice: number): Promise<boolean> {
    const currentPrice = await this.getCurrentPrice(assetIndex);

    // Price can't deviate more than 80% up or down
    const upperBound = currentPrice * 1.8; // +80%
    const lowerBound = currentPrice * 0.2; // -80%

    return orderPrice >= lowerBound && orderPrice <= upperBound;
  }

  async getMarketPriceForTrading(
    assetTicker: string,
    marketType: "spot" | "perps",
    side: "buy" | "sell"
  ): Promise<{ price: number }> {
    // Fetch L2 book data for the assetTicker
    let bookData: L2BookResponse;
    try {
      const response = await axios.post(`${this.baseUrl}/info`, {
        type: "l2Book",
        coin: assetTicker.toUpperCase(), // Ensure asset ticker is uppercase
      });
      bookData = response.data as L2BookResponse;
    } catch (error) {
      console.error(
        `Failed to fetch L2 book for ${assetTicker} in getMarketPriceForTrading:`,
        error
      );
      throw new Error(
        `Could not fetch L2 book for ${assetTicker} to determine market price for trading.`
      );
    }

    let price: number;

    if (side === "buy") {
      // For buying, use the current best (lowest) ask price.
      if (bookData.levels && bookData.levels[1] && bookData.levels[1][0]) {
        price = parseFloat(bookData.levels[1][0].px);
      } else {
        throw new Error(
          `No asks found in L2 book for ${assetTicker} to determine buy price for GTC limit.`
        );
      }
    } else {
      // For selling, use the current best (highest) bid price.
      if (bookData.levels && bookData.levels[0] && bookData.levels[0][0]) {
        price = parseFloat(bookData.levels[0][0].px);
      } else {
        throw new Error(
          `No bids found in L2 book for ${assetTicker} to determine sell price for GTC limit.`
        );
      }
    }

    // COMMENT: If this function were part of a flow that also accepted an optional user-defined limit price,
    // the calling function (e.g., in TradeService) would make the decision:
    // - If a user-defined limitPrice is provided by the frontend for a GTC order,
    //   that user-defined price would be used INSTEAD of this fetched 'price'.
    // - This function's purpose is to determine an aggressive GTC price when no specific limit is given by the user.
    // - Example (in calling function):
    //   let finalPriceToUse = userSuppliedLimitPrice ? parseFloat(userSuppliedLimitPrice) : fetchedMarketPrice.price;
    //   Then, finalPriceToUse would be formatted and sent in the order.

    return { price };
  }

  async getAggressiveIOCPriceString(
    side: "buy" | "sell",
    assetTicker: string,
    marketType: "perps" // Assuming perps for now, can be extended
    // Reference price is no longer passed; it's fetched from L2 book
  ): Promise<string> {
    const tickInfo = await this.getTickAndLotSize(assetTicker, marketType);
    if (!tickInfo) {
      throw new Error(
        `Could not get tick/lot size for ${assetTicker} to generate IOC price string.`
      );
    }

    // Fetch L2 book data for the assetTicker
    let bookData: L2BookResponse;
    try {
      const response = await axios.post(`${this.baseUrl}/info`, {
        type: "l2Book",
        coin: assetTicker.toUpperCase(), // Ensure asset ticker is uppercase
      });
      bookData = response.data as L2BookResponse;
    } catch (error) {
      console.error(`Failed to fetch L2 book for ${assetTicker}:`, error);
      throw new Error(
        `Could not fetch L2 book for ${assetTicker} to set IOC price.`
      );
    }

    let targetPrice: number;
    const smallestPriceStep = Math.pow(10, -tickInfo.pxDecimals);

    if (side === "buy") {
      // For buying to close a short, use the current best (lowest) ask price,
      // then make it slightly more aggressive (one tick higher) to cross the spread.
      if (bookData.levels && bookData.levels[1] && bookData.levels[1][0]) {
        const bestAskPrice = parseFloat(bookData.levels[1][0].px);
        targetPrice = bestAskPrice + smallestPriceStep;
      } else {
        throw new Error(
          `No asks found in L2 book for ${assetTicker} to place buy IOC.`
        );
      }
    } else {
      // For selling to close a long, use the current best (highest) bid price,
      // then make it slightly more aggressive (one tick lower) to cross the spread.
      if (bookData.levels && bookData.levels[0] && bookData.levels[0][0]) {
        const bestBidPrice = parseFloat(bookData.levels[0][0].px);
        const potentialTargetPrice = bestBidPrice - smallestPriceStep;

        if (potentialTargetPrice < smallestPriceStep) {
          // If subtracting a tick makes the price too low (e.g., zero, negative, or below the smallest representable step),
          // then use the smallest_price_step itself as the target price.
          // This handles edge cases where the best bid is already at or very near the minimum price.
          targetPrice = smallestPriceStep;
        } else {
          targetPrice = potentialTargetPrice;
        }
      } else {
        throw new Error(
          `No bids found in L2 book for ${assetTicker} to place sell IOC.`
        );
      }
    }

    const finalPriceString = tickInfo.roundPrice(targetPrice);

    return finalPriceString;
  }
}
