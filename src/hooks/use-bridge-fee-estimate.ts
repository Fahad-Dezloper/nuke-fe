/**
 * Hook to fetch bridge fee estimates from the /bridge/quote API.
 *
 * Watches the margin input (debounced) and the user's wallet state.
 * When both are available, fetches a bridge quote for the margin amount
 * and extracts the fee breakdown (gasFeeUsd, relayFeeUsd, protocolFees).
 *
 * The fees are stored in the bridgeFeesAtom for consumption by the UI.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { bridgeService } from '@/lib/bridge/bridge.service';
import { CHAIN_IDS } from '@/lib/bridge/types';
import { bridgeFeesAtom, bridgeFeesLoadingAtom } from '@/lib/stores/bridge-fees.store';
import type { BridgeFees } from '@/lib/stores/bridge-fees.store';
import { marginAtom } from '@/components/features/position-controls/store';
import { turnkeyStateAtom } from '@/lib/turnkey/store';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { useDebounce } from './use-debounce';

/** Debounce delay in ms before fetching a quote */
const DEBOUNCE_MS = 1500;

/**
 * Parse the fee fields from a bridge quote response into a BridgeFees object.
 */
function parseFees(gasFeeUsd: string, relayFeeUsd: string, protocolFees: string): BridgeFees {
  const gas = parseFloat(gasFeeUsd) || 0;
  const relay = parseFloat(relayFeeUsd) || 0;
  const protocol = parseFloat(protocolFees) || 0;
  return {
    gasFeeUsd: gas,
    relayFeeUsd: relay,
    protocolFees: protocol,
    totalFeeUsd: gas + relay + protocol,
  };
}

export function useBridgeFeeEstimate() {
  const margin = useAtomValue(marginAtom);
  const turnkeyState = useAtomValue(turnkeyStateAtom);
  const setBridgeFees = useSetAtom(bridgeFeesAtom);
  const setLoading = useSetAtom(bridgeFeesLoadingAtom);

  // Debounce the margin value so we don't fire on every keystroke
  const debouncedMargin = useDebounce(margin, DEBOUNCE_MS);

  // Track the latest request to avoid stale responses
  const requestIdRef = useRef(0);

  useEffect(() => {
    const marginValue = parseFloat(debouncedMargin);

    // Skip if no margin, user not logged in, or no wallets
    if (
      !marginValue ||
      marginValue <= 0 ||
      !turnkeyState.isLoggedIn ||
      !turnkeyState.userWallets?.length
    ) {
      // Clear fees when margin is cleared
      if (!marginValue || marginValue <= 0) {
        setBridgeFees(null);
      }
      return;
    }

    const evmAddress = getEVMAddress(turnkeyState.userWallets);
    if (!evmAddress) return;

    // Convert USD margin to USDC smallest unit (6 decimals)
    // Use half the margin since each bridge leg handles roughly half
    const halfMarginUsd = marginValue / 2;
    const amountSmallestUnit = Math.floor(halfMarginUsd * 1_000_000).toString();

    const currentRequestId = ++requestIdRef.current;

    const fetchFees = async () => {
      setLoading(true);

      try {
        const quoteResponse = await bridgeService.getQuote({
          user: evmAddress,
          destinationChainId: CHAIN_IDS.ARBITRUM,
          amount: amountSmallestUnit,
          tradeType: 'EXACT_INPUT',
          usePermit: true,
          recipient: evmAddress,
        });

        // Only update if this is still the latest request
        if (currentRequestId !== requestIdRef.current) return;

        // Parse single-leg fees
        const singleLegFees = parseFees(
          quoteResponse.gasFeeUsd,
          quoteResponse.relayFeeUsd,
          quoteResponse.protocolFees
        );

        // A hedge position has 2 bridge legs, so double the fees
        setBridgeFees({
          gasFeeUsd: singleLegFees.gasFeeUsd * 2,
          relayFeeUsd: singleLegFees.relayFeeUsd * 2,
          protocolFees: singleLegFees.protocolFees * 2,
          totalFeeUsd: singleLegFees.totalFeeUsd * 2,
        });
      } catch (error) {
        // Only update if still latest request
        if (currentRequestId !== requestIdRef.current) return;

        console.warn('[useBridgeFeeEstimate] Failed to fetch fee estimate:', error);
        // Don't clear existing fees on error — keep stale data visible
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchFees();
  }, [debouncedMargin, turnkeyState.isLoggedIn, turnkeyState.userWallets, setBridgeFees, setLoading]);
}
