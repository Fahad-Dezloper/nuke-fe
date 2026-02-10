/**
 * Bridge Fees Store
 * Jotai atoms for bridge fee estimates (from the /bridge/quote API).
 *
 * These fees come from the Relay.link bridge quote and include:
 *  - gasFeeUsd:    Destination chain gas fee
 *  - relayFeeUsd:  Relay service fee
 *  - protocolFees: Nuke protocol fee
 */

import { atom } from 'jotai';

/** Parsed bridge fee data for a single bridge operation */
export interface BridgeFees {
  gasFeeUsd: number;
  relayFeeUsd: number;
  protocolFees: number;
  /** Sum of all three fee components */
  totalFeeUsd: number;
}

/** Latest bridge fee estimate (null = not yet fetched) */
export const bridgeFeesAtom = atom<BridgeFees | null>(null);

/** Whether a fee estimate request is in flight */
export const bridgeFeesLoadingAtom = atom<boolean>(false);
