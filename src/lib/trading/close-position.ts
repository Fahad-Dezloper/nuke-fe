/**
 * Close Position Utilities
 *
 * Shared logic for closing positions on Hyperliquid and Pacifica.
 * Used by both the useClosePosition hook and the HedgeActionExecutor,
 * eliminating code duplication.
 */

import { HyperLiquidService } from '@/lib/services/hyperliquid/hyperliquid.service';
import { PacificaService } from '@/lib/services/pacifica/pacifica.service';
import { BackpackService } from '@/lib/services/backpack/backpack.service';
import { getSharedLighterAdapter } from '@/lib/services/lighter/lighter-shared-adapter';
import { HyperLiquidAdapter } from '@/lib/arbitrage/adapters/hyperliquid-adapter';
import { BUILDER_CODE } from '@/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloseLegResult {
  protocol: 'hyperliquid' | 'pacifica' | 'backpack' | 'lighter';
  success: boolean;
  error?: string;
}

export interface HLPositionData {
  symbol: string;
  size: string;
  side: 'Long' | 'Short';
}

export interface PacificaPositionData {
  symbol: string;
  size: string;
  side: 'Long' | 'Short';
}

export interface BackpackPositionData {
  symbol: string;
  size: string;
  side: 'Long' | 'Short';
}

/** Lighter leg uses the same aggregate shape as Hyperliquid in our API. */
export type LighterPositionData = HLPositionData;

// ─── Singleton Services ───────────────────────────────────────────────────────

const hlService = new HyperLiquidService();
const hlAdapter = new HyperLiquidAdapter(hlService);
const pacificaService = new PacificaService();
const backpackService = new BackpackService();

// ─── Close Functions ──────────────────────────────────────────────────────────

/**
 * Close a HyperLiquid position for a given asset.
 * Uses HL clearinghouse state for side/size — do not trust aggregate API leg fields
 * (they can disagree with on-chain state after mis-opened hedges).
 */
export async function closeHLPosition(
  hl: HLPositionData,
  evmAddress: string,
  organizationId: string
): Promise<CloseLegResult> {
  try {
    const symbol = hl.symbol.toUpperCase();
    const result = await hlAdapter.closePosition(symbol, evmAddress, organizationId);

    return {
      protocol: 'hyperliquid',
      success: result.success,
      error: result.success ? undefined : result.error || result.message,
    };
  } catch (err) {
    return {
      protocol: 'hyperliquid',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Close a Pacifica position by creating a reduce-only market order on the opposite side.
 */
export async function closePacificaPosition(
  pac: PacificaPositionData,
  solanaAddress: string,
  organizationId: string
): Promise<CloseLegResult> {
  try {
    // To close: submit opposite-side reduce_only market order
    const closeSide: 'bid' | 'ask' = pac.side === 'Long' ? 'ask' : 'bid';

    const result = await pacificaService.createMarketOrder(
      {
        symbol: pac.symbol.toUpperCase(),
        amount: pac.size,
        side: closeSide,
        slippage_percent: '3', // 3% slippage tolerance
        reduce_only: true,
        builder_code: BUILDER_CODE,
      },
      solanaAddress,
      organizationId
    );

    return {
      protocol: 'pacifica',
      success: result.success,
      error: result.success ? undefined : result.error || result.message,
    };
  } catch (err) {
    return {
      protocol: 'pacifica',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Close a Lighter perp leg via the shared Lighter adapter (reduce-only market IOC).
 */
export async function closeLighterPosition(
  lt: LighterPositionData,
  evmAddress: string,
  organizationId: string
): Promise<CloseLegResult> {
  try {
    const adapter = getSharedLighterAdapter();
    const res = await adapter.closePosition(lt.symbol, evmAddress, organizationId);
    return {
      protocol: 'lighter',
      success: res.success,
      error: res.success ? undefined : res.error || res.message,
    };
  } catch (err) {
    return {
      protocol: 'lighter',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Close a Backpack position by creating a reduce-only market order on the opposite side.
 */
export async function closeBackpackPosition(
  bp: BackpackPositionData,
  solanaAddress: string,
  organizationId: string
): Promise<CloseLegResult> {
  try {
    const closeSide = bp.side === 'Long' ? 'Ask' : 'Bid';

    const result = await backpackService.executePerpOrder({
      order: {
        symbol: `${bp.symbol.toUpperCase()}_USDC_PERP`,
        side: closeSide,
        orderType: 'Market',
        quantity: bp.size,
        reduceOnly: true,
      },
      solanaAddress,
      organizationId,
    });

    return {
      protocol: 'backpack',
      success: result.success,
      error: result.success ? undefined : result.error || 'Backpack close failed',
    };
  } catch (err) {
    return {
      protocol: 'backpack',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
