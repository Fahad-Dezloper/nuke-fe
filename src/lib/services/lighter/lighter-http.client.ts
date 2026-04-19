/**
 * Thin HTTP client for Lighter public + tx submission endpoints.
 * Base URL: https://mainnet.zklighter.elliot.ai (override for testnet).
 */

import axios, { type AxiosInstance } from 'axios';
import { ErrorCode, createError, toAppError } from '@/lib/errors';
import { LIGHTER_API_PREFIX, LIGHTER_HTTP_MAINNET } from './constants';
import type {
  AccountsByL1Response,
  NextNonceResponse,
  OrderBookDetailsResponse,
  SendTxRequest,
  SendTxResponse,
} from './types';

export interface LighterHttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class LighterHttpClient {
  private readonly client: AxiosInstance;

  constructor(options: LighterHttpClientOptions = {}) {
    const baseURL = (options.baseUrl ?? LIGHTER_HTTP_MAINNET).replace(/\/$/, '');
    this.client = axios.create({
      baseURL,
      timeout: options.timeoutMs ?? 30_000,
      headers: { Accept: 'application/json' },
    });
  }

  private url(path: string): string {
    return `${LIGHTER_API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async getOrderBookDetails(filter: 'perp' | 'spot' = 'perp'): Promise<OrderBookDetailsResponse> {
    try {
      const { data } = await this.client.get<OrderBookDetailsResponse>(this.url('/orderBookDetails'), {
        params: { filter },
      });
      return data;
    } catch (e) {
      throw toAppError(e, ErrorCode.LIGHTER_HTTP_ERROR);
    }
  }

  async getAccountsByL1Address(l1Address: string): Promise<AccountsByL1Response> {
    try {
      const { data } = await this.client.get<AccountsByL1Response>(
        this.url('/accountsByL1Address'),
        {
          params: { l1_address: l1Address },
        }
      );
      return data;
    } catch (e) {
      throw toAppError(e, ErrorCode.LIGHTER_HTTP_ERROR);
    }
  }

  async getNextNonce(accountIndex: number, apiKeyIndex: number): Promise<number> {
    try {
      const { data } = await this.client.get<NextNonceResponse>(this.url('/nextNonce'), {
        params: {
          account_index: accountIndex,
          api_key_index: apiKeyIndex,
        },
      });
      const n = typeof data?.nonce === 'number' ? data.nonce : data?.next_nonce;
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        throw createError(ErrorCode.NET_INVALID_RESPONSE, { endpoint: 'nextNonce', data });
      }
      return n;
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e) throw e;
      throw toAppError(e, ErrorCode.LIGHTER_HTTP_ERROR);
    }
  }

  /**
   * Submit a signed L2 transaction.
   * @param auth Optional `Authorization` header (some deployments use auth for rate limits).
   */
  async sendTx(body: SendTxRequest, auth?: string): Promise<SendTxResponse> {
    try {
      const { data } = await this.client.post<SendTxResponse>(this.url('/sendTx'), body, {
        headers: auth ? { Authorization: auth } : undefined,
      });
      if (
        data &&
        typeof data === 'object' &&
        'code' in data &&
        (data as SendTxResponse).code !== undefined &&
        (data as SendTxResponse).code !== 200 &&
        (data as SendTxResponse).code !== 0
      ) {
        throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { response: data });
      }
      return data;
    } catch (e) {
      throw toAppError(e, ErrorCode.LIGHTER_SUBMIT_TX_FAILED);
    }
  }

  async sendTxBatch(
    tx_types: number[],
    tx_infos: string[],
    auth?: string
  ): Promise<SendTxResponse> {
    try {
      const { data } = await this.client.post<SendTxResponse>(
        this.url('/sendTxBatch'),
        { tx_types, tx_infos },
        { headers: auth ? { Authorization: auth } : undefined }
      );
      if (
        data &&
        typeof data === 'object' &&
        'code' in data &&
        (data as SendTxResponse).code !== undefined &&
        (data as SendTxResponse).code !== 200 &&
        (data as SendTxResponse).code !== 0
      ) {
        throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { response: data });
      }
      return data;
    } catch (e) {
      throw toAppError(e, ErrorCode.LIGHTER_SUBMIT_TX_FAILED);
    }
  }
}
