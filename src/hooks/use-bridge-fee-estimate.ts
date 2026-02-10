/**
 * Hook to fetch bridge fee estimates using React Query.
 *
 * Watches the margin input (debounced) and the user's wallet state.
 * Uses React Query for automatic cancellation and cache management
 * instead of manual requestId tracking.
 */

'use client';

import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { bridgeService } from '@/lib/bridge/bridge.service';
import { CHAIN_IDS } from '@/lib/bridge/types';
import { bridgeFeesAtom, bridgeFeesLoadingAtom } from '@/lib/stores/bridge-fees.store';
import type { BridgeFees } from '@/lib/stores/bridge-fees.store';
import { marginAtom } from '@/components/features/position-controls/store';
import { turnkeyStateAtom } from '@/lib/turnkey/store';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { useDebounce } from './use-debounce';
import { queryKeys } from '@/lib/query-keys';

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

  const debouncedMargin = useDebounce(margin, DEBOUNCE_MS);

  const marginValue = parseFloat(debouncedMargin);
  const isValidMargin = marginValue > 0;
  const evmAddress = turnkeyState.userWallets?.length
    ? getEVMAddress(turnkeyState.userWallets)
    : null;
  const isEnabled = isValidMargin && turnkeyState.isLoggedIn && !!evmAddress;

  // Convert USD margin to USDC smallest unit (half per leg)
  const amountSmallestUnit = isValidMargin
    ? Math.floor((marginValue / 2) * 1_000_000).toString()
    : '0';

  const query = useQuery({
    queryKey: queryKeys.bridgeFees.estimate(amountSmallestUnit, evmAddress ?? ''),
    queryFn: async () => {
      const quoteResponse = await bridgeService.getQuote({
        user: evmAddress!,
        destinationChainId: CHAIN_IDS.ARBITRUM,
        amount: amountSmallestUnit,
        tradeType: 'EXACT_INPUT',
        usePermit: true,
        recipient: evmAddress!,
      });

      const singleLegFees = parseFees(
        quoteResponse.gasFeeUsd,
        quoteResponse.relayFeeUsd,
        quoteResponse.protocolFees
      );

      // A hedge position has 2 bridge legs, so double the fees
      return {
        gasFeeUsd: singleLegFees.gasFeeUsd * 2,
        relayFeeUsd: singleLegFees.relayFeeUsd * 2,
        protocolFees: singleLegFees.protocolFees * 2,
        totalFeeUsd: singleLegFees.totalFeeUsd * 2,
      } satisfies BridgeFees;
    },
    enabled: isEnabled,
    staleTime: 30_000, // Fee estimates are valid for 30s
    // Keep previous data while fetching new (avoids flicker)
    placeholderData: (prev) => prev,
  });

  // Sync React Query state → Jotai atoms
  useEffect(() => {
    if (query.data) {
      setBridgeFees(query.data);
    } else if (!isValidMargin) {
      setBridgeFees(null);
    }
  }, [query.data, isValidMargin, setBridgeFees]);

  useEffect(() => {
    setLoading(query.isFetching);
  }, [query.isFetching, setLoading]);
}
