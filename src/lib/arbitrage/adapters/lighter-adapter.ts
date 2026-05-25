/**
 * Lighter protocol adapter — wraps `LighterService` for hedge / arbitrage flows.
 */

import { InfoClient } from 'lighter-sdk-client';
import { getAddress } from 'viem';
import type { ProtocolAdapter } from './protocol-adapter.interface';
import type {
  UnifiedPositionParams,
  UnifiedPositionResult,
  UnifiedPosition,
  ProtocolMetadata,
} from '../types';
import { LighterService } from '@/lib/services/lighter/lighter.service';
import { getLighterL2Credentials } from '@/lib/services/lighter/lighter-credentials';
import {
  computeLighterOpenAmounts,
  fetchLighterPerpRow,
  lighterHumanPriceToInt,
  lighterWorstPriceForClose,
} from '@/lib/services/lighter/lighter-reads';
import type { HedgeLegTpslPrices } from '@/lib/hedge-intent/hedge-tpsl';
import { LIGHTER_HTTP_MAINNET } from '@/lib/services/lighter/constants';
import { ErrorCode, createError } from '@/lib/errors';

export class LighterAdapter implements ProtocolAdapter {
  private readonly protocolName = 'lighter';

  constructor(private readonly service: LighterService) {}

  getRequiredWalletType(): 'ethereum' | 'solana' {
    return 'ethereum';
  }

  normalizeAssetName(asset: string): string {
    return asset.toUpperCase();
  }

  calculatePositionSize(margin: string, leverage: number, price?: string): string {
    const m = parseFloat(margin);
    const p = price ? parseFloat(price) : 0;
    if (!Number.isFinite(m) || m <= 0) return '0';
    if (!Number.isFinite(p) || p <= 0) return (m * leverage).toFixed(4);
    return ((m * leverage) / p).toFixed(6);
  }

  getMetadata(): ProtocolMetadata {
    return {
      name: this.protocolName,
      displayName: 'Lighter',
      walletType: 'ethereum',
      maxLeverage: 50,
      minMargin: '5',
      supportedAssets: [],
      supportsMarketOrders: true,
      supportsLimitOrders: true,
      defaultSlippagePercent: '0.5',
    };
  }

  getSupportedAssets(): string[] {
    return [];
  }

  async openPosition(params: UnifiedPositionParams): Promise<UnifiedPositionResult> {
    try {
      const creds = getLighterL2Credentials();
      if (!creds) {
        return this.fail(params, 'Lighter L2 credentials are not configured');
      }

      const entryPriceStr = params.price;
      if (!entryPriceStr || parseFloat(entryPriceStr) <= 0) {
        return this.fail(params, 'Price is required to size the Lighter leg');
      }

      const row = await fetchLighterPerpRow(params.asset);
      if (!row) {
        return this.fail(params, `Asset ${params.asset} not found on Lighter perps`);
      }
      const marketIndex = row.market_id;
      if (marketIndex == null || marketIndex < 0) {
        return this.fail(params, 'Lighter market_id missing for asset');
      }

      const marginUsd = parseFloat(params.margin);
      if (!Number.isFinite(marginUsd) || marginUsd <= 0) {
        return this.fail(params, 'Invalid margin');
      }

      const slip = parseFloat(params.slippagePercent || '0.5');
      const { baseAmount, worstPrice } = computeLighterOpenAmounts({
        marginUsd,
        leverage: params.leverage,
        direction: params.direction,
        slippagePercent: Number.isFinite(slip) ? slip : 0.5,
        lastTradePrice: row.last_trade_price,
        priceDecimals: row.price_decimals,
        sizeDecimals: row.size_decimals,
      });

      const clientOrderIndex = Math.floor(Date.now() % 1_000_000_000);
      const orderExpiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 28;

      const res = await this.service.openPerp(
        {
          marketIndex: row.market_id,
          clientOrderIndex,
          baseAmount,
          price: worstPrice,
          side: params.direction,
          orderType: 'market',
          timeInForce: 'ioc',
          reduceOnly: false,
          orderExpiry,
          apiKeyIndex: creds.apiKeyIndex,
        },
        { priceProtection: true }
      );

      const rec = res as Record<string, unknown>;
      const txHash = (rec.tx_hash as string | undefined) || (rec.hash as string | undefined) || '';

      if (!txHash && res?.message && String(res.message).toLowerCase().includes('fail')) {
        return this.fail(params, String(res.message));
      }

      let tpslWarning: string | undefined;
      if (params.hedgeTpsl) {
        const priceDecimals = row.price_decimals ?? row.supported_price_decimals ?? 0;
        const tpslErr = await this.attachMirroredHedgeTpsl({
          hedgeTpsl: params.hedgeTpsl,
          positionDirection: params.direction,
          marketIndex,
          baseAmount,
          priceDecimals: Number(priceDecimals),
          apiKeyIndex: creds.apiKeyIndex,
        });
        if (tpslErr) {
          tpslWarning = tpslErr;
          console.warn('[LighterAdapter] Mirrored TP/SL attach failed:', tpslErr);
        }
      }

      const sizeHuman = this.calculatePositionSize(params.margin, params.leverage, entryPriceStr);

      return {
        success: true,
        positionId: txHash || `lighter-${clientOrderIndex}-${params.asset}`,
        protocol: this.protocolName,
        asset: params.asset,
        direction: params.direction,
        size: sizeHuman,
        entryPrice: entryPriceStr,
        margin: params.margin,
        leverage: params.leverage,
        message: tpslWarning
          ? `Position opened on Lighter (TP/SL attach failed: ${tpslWarning})`
          : 'Position opened on Lighter with mirrored TP/SL',
        rawData: res,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return this.fail(params, msg);
    }
  }

  async closePosition(
    positionId: string,
    walletAddress: string,
    _organizationId: string
  ): Promise<UnifiedPositionResult> {
    try {
      const creds = getLighterL2Credentials();
      if (!creds) {
        throw createError(ErrorCode.LIGHTER_CREDENTIALS_MISSING);
      }

      const asset = positionId.toUpperCase();
      const row = await fetchLighterPerpRow(asset);
      if (!row) {
        return this.closeFail(asset, 'Market not found on Lighter');
      }

      const client = new InfoClient({ baseURL: LIGHTER_HTTP_MAINNET });
      const info = await client.getAccountInfo({
        by: 'l1_address',
        value: getAddress(walletAddress as `0x${string}`),
      });
      const account = info.accounts?.[0];
      const pos = account?.positions?.find((p) => p.symbol?.toUpperCase() === asset);
      if (!pos?.position) {
        return this.closeFail(asset, 'No Lighter position for this asset');
      }

      const rawSize = Math.abs(Math.floor(Number.parseFloat(pos.position)));
      if (!Number.isFinite(rawSize) || rawSize <= 0) {
        return this.closeFail(asset, 'Invalid position size from Lighter');
      }

      const side: 'long' | 'short' = pos.sign >= 0 ? 'long' : 'short';
      const worstPrice = lighterWorstPriceForClose(side, row.last_trade_price, 3);

      const orderExpiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      const clientOrderIndex = Math.floor(Date.now() % 1_000_000_000);

      const res = await this.service.closePerp(
        {
          marketIndex: row.market_id,
          clientOrderIndex,
          baseAmount: rawSize,
          price: worstPrice,
          side,
          orderExpiry,
          apiKeyIndex: creds.apiKeyIndex,
        },
        { priceProtection: true }
      );

      const rec = res as Record<string, unknown>;
      const txHash = (rec.tx_hash as string | undefined) || (rec.hash as string | undefined) || '';

      return {
        success: true,
        positionId: txHash || `lighter-close-${clientOrderIndex}`,
        protocol: this.protocolName,
        asset,
        direction: side,
        size: String(rawSize),
        entryPrice: row.last_trade_price.toString(),
        margin: '0',
        leverage: 1,
        message: 'Lighter position closed',
        rawData: res,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return this.closeFail(positionId, msg);
    }
  }

  async getPosition(positionId: string, walletAddress: string): Promise<UnifiedPosition> {
    const asset = positionId.toUpperCase();
    const client = new InfoClient({ baseURL: LIGHTER_HTTP_MAINNET });
    const info = await client.getAccountInfo({
      by: 'l1_address',
      value: getAddress(walletAddress as `0x${string}`),
    });
    const account = info.accounts?.[0];
    const pos = account?.positions?.find((p) => p.symbol?.toUpperCase() === asset);

    if (!pos?.position) {
      return {
        positionId: asset,
        protocol: this.protocolName,
        asset,
        direction: 'long',
        size: '0',
        entryPrice: '0',
        margin: pos?.allocated_margin ?? '0',
        leverage: 1,
      };
    }

    const size = Math.abs(Number.parseFloat(pos.position)).toString();
    const direction = pos.sign >= 0 ? 'long' : 'short';
    const imf = Number.parseInt(pos.initial_margin_fraction || '0', 10);
    const lev = Number.isFinite(imf) && imf > 0 ? Math.round(10_000 / imf) : 1;

    return {
      positionId: asset,
      protocol: this.protocolName,
      asset,
      direction,
      size,
      entryPrice: pos.avg_entry_price ?? '0',
      margin: pos.allocated_margin ?? '0',
      leverage: lev,
      unrealizedPnl: pos.unrealized_pnl,
    };
  }

  /**
   * Place reduce-only take-profit + stop-loss triggers using the same canonical prices as HL/Pacifica.
   */
  private async attachMirroredHedgeTpsl(args: {
    hedgeTpsl: HedgeLegTpslPrices;
    positionDirection: 'long' | 'short';
    marketIndex: number;
    baseAmount: number;
    priceDecimals: number;
    apiKeyIndex: number;
  }): Promise<string | null> {
    const { hedgeTpsl, positionDirection, marketIndex, baseAmount, priceDecimals, apiKeyIndex } =
      args;

    if (!Number.isFinite(marketIndex) || marketIndex < 0) {
      return 'Invalid Lighter market index';
    }

    try {
      const tpTrigger = lighterHumanPriceToInt(hedgeTpsl.takeProfitPrice, priceDecimals);
      const slTrigger = lighterHumanPriceToInt(hedgeTpsl.stopLossPrice, priceDecimals);
      const tpLimit = lighterHumanPriceToInt(
        hedgeTpsl.takeProfitLimitPrice ?? hedgeTpsl.takeProfitPrice,
        priceDecimals
      );
      const slLimit = lighterHumanPriceToInt(
        hedgeTpsl.stopLossLimitPrice ?? hedgeTpsl.stopLossPrice,
        priceDecimals
      );

      /** Reduce-only close: sell to close long (`short`), buy to close short (`long`). */
      const closeSide: 'long' | 'short' = positionDirection === 'long' ? 'short' : 'long';
      const orderExpiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 28;
      const base = Date.now() % 1_000_000_000;

      const placeTrigger = async (
        kind: 'take_profit' | 'stop_loss',
        triggerPrice: number,
        limitPrice: number,
        clientOrderIndex: number
      ) => {
        await this.service.openPerp(
          {
            marketIndex,
            clientOrderIndex,
            baseAmount,
            price: limitPrice,
            side: closeSide,
            orderType: kind,
            timeInForce: 'gtt',
            reduceOnly: true,
            orderExpiry,
            triggerPrice,
            apiKeyIndex,
          },
          { priceProtection: true }
        );
      };

      await placeTrigger('take_profit', tpTrigger, tpLimit, Math.floor(base + 1));
      await placeTrigger('stop_loss', slTrigger, slLimit, Math.floor(base + 2));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }

  private fail(params: UnifiedPositionParams, error: string): UnifiedPositionResult {
    return {
      success: false,
      positionId: '',
      protocol: this.protocolName,
      asset: params.asset,
      direction: params.direction,
      size: '0',
      entryPrice: '0',
      margin: params.margin,
      leverage: params.leverage,
      error,
      message: error,
    };
  }

  private closeFail(asset: string, error: string): UnifiedPositionResult {
    return {
      success: false,
      positionId: '',
      protocol: this.protocolName,
      asset,
      direction: 'long',
      size: '0',
      entryPrice: '0',
      margin: '0',
      leverage: 1,
      error,
      message: error,
    };
  }
}
