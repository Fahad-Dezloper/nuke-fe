/**
 * Lighter trading orchestration: map human params → sign → `sendTx`.
 * Signing is delegated to `LighterTxSigner` (WASM/native); default stub throws until wired.
 */

import type { LighterHttpClient } from './lighter-http.client';
import type {
  LighterCancelOrderSignParams,
  LighterClosePerpParams,
  LighterOpenPerpParams,
  LighterUpdateLeverageParams,
  LighterUpdateMarginParams,
  SendTxResponse,
} from './types';
import type { LighterTxSigner } from './utils/signing';
import { LighterOrderType, LighterTimeInForce, leverageToMarginFraction } from './utils/tx-constants';

export interface LighterSendTxOptions {
  auth?: string;
  priceProtection?: boolean;
}

function mapTimeInForce(tif: LighterOpenPerpParams['timeInForce']): number {
  switch (tif) {
    case 'ioc':
      return LighterTimeInForce.IMMEDIATE_OR_CANCEL;
    case 'gtt':
      return LighterTimeInForce.GOOD_TILL_TIME;
    case 'alo':
      return LighterTimeInForce.POST_ONLY;
    default:
      return LighterTimeInForce.IMMEDIATE_OR_CANCEL;
  }
}

function mapOrderType(orderType: LighterOpenPerpParams['orderType']): number {
  return orderType === 'market' ? LighterOrderType.MARKET : LighterOrderType.LIMIT;
}

/** Open order: long = bid (`is_ask` false), short = ask. */
function openSideToIsAsk(side: LighterOpenPerpParams['side']): boolean {
  return side === 'short';
}

/** Close: flatten long by selling (ask), flatten short by buying (bid). */
function closeSideToIsAsk(positionSide: LighterClosePerpParams['side']): boolean {
  return positionSide === 'long';
}

export class LighterService {
  constructor(
    private readonly http: LighterHttpClient,
    private readonly signer: LighterTxSigner
  ) {}

  readonly getOrderBookDetails = this.http.getOrderBookDetails.bind(this.http);
  readonly getAccountsByL1Address = this.http.getAccountsByL1Address.bind(this.http);
  readonly getNextNonce = this.http.getNextNonce.bind(this.http);
  readonly sendTxBatch = this.http.sendTxBatch.bind(this.http);

  createAuthToken(deadlineSeconds: number, apiKeyIndex: number): Promise<string> {
    return this.signer.createAuthToken(deadlineSeconds, apiKeyIndex);
  }

  async openPerp(
    params: LighterOpenPerpParams,
    options?: LighterSendTxOptions
  ): Promise<SendTxResponse> {
    const signed = await this.signer.signCreateOrder({
      marketIndex: params.marketIndex,
      clientOrderIndex: params.clientOrderIndex,
      baseAmount: params.baseAmount,
      price: params.price,
      isAsk: openSideToIsAsk(params.side),
      orderType: mapOrderType(params.orderType),
      timeInForce: mapTimeInForce(params.timeInForce),
      reduceOnly: params.reduceOnly,
      orderExpiry: params.orderExpiry,
      triggerPrice: params.triggerPrice,
      apiKeyIndex: params.apiKeyIndex,
    });
    return this.http.sendTx(
      {
        tx_type: signed.txType,
        tx_info: signed.txInfo,
        price_protection: options?.priceProtection,
      },
      options?.auth
    );
  }

  /**
   * Market IOC reduce-only close. Caller supplies integer size and a protective price
   * (same convention as HL aggressive close).
   */
  async closePerp(
    params: LighterClosePerpParams,
    options?: LighterSendTxOptions
  ): Promise<SendTxResponse> {
    const signed = await this.signer.signCreateOrder({
      marketIndex: params.marketIndex,
      clientOrderIndex: params.clientOrderIndex,
      baseAmount: params.baseAmount,
      price: params.price,
      isAsk: closeSideToIsAsk(params.side),
      orderType: LighterOrderType.MARKET,
      timeInForce: LighterTimeInForce.IMMEDIATE_OR_CANCEL,
      reduceOnly: true,
      orderExpiry: params.orderExpiry,
      apiKeyIndex: params.apiKeyIndex,
    });
    return this.http.sendTx(
      {
        tx_type: signed.txType,
        tx_info: signed.txInfo,
        price_protection: options?.priceProtection,
      },
      options?.auth
    );
  }

  async cancelOrder(
    params: LighterCancelOrderSignParams,
    options?: LighterSendTxOptions
  ): Promise<SendTxResponse> {
    const signed = await this.signer.signCancelOrder(params);
    return this.http.sendTx(
      {
        tx_type: signed.txType,
        tx_info: signed.txInfo,
        price_protection: options?.priceProtection,
      },
      options?.auth
    );
  }

  async updateLeverage(
    params: LighterUpdateLeverageParams,
    options?: LighterSendTxOptions
  ): Promise<SendTxResponse> {
    const signed = await this.signer.signUpdateLeverage({
      marketIndex: params.marketIndex,
      initialMarginFraction: leverageToMarginFraction(params.leverage),
      marginMode: params.marginMode,
      apiKeyIndex: params.apiKeyIndex,
    });
    return this.http.sendTx(
      {
        tx_type: signed.txType,
        tx_info: signed.txInfo,
        price_protection: options?.priceProtection,
      },
      options?.auth
    );
  }

  async updateMargin(
    params: LighterUpdateMarginParams,
    options?: LighterSendTxOptions
  ): Promise<SendTxResponse> {
    const signed = await this.signer.signUpdateMargin({
      marketIndex: params.marketIndex,
      usdcAmount: params.usdcAmount,
      direction: params.direction,
      apiKeyIndex: params.apiKeyIndex,
    });
    return this.http.sendTx(
      {
        tx_type: signed.txType,
        tx_info: signed.txInfo,
        price_protection: options?.priceProtection,
      },
      options?.auth
    );
  }

  /** Submit a tx already signed outside this service (e.g. batch flows). */
  async sendSignedTx(
    txType: number,
    txInfo: string,
    options?: LighterSendTxOptions
  ): Promise<SendTxResponse> {
    return this.http.sendTx(
      {
        tx_type: txType,
        tx_info: txInfo,
        price_protection: options?.priceProtection,
      },
      options?.auth
    );
  }
}
