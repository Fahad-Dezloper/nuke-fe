'use client';

/**
 * Position Controls Section Component
 * Right side panel with position controls.
 *
 * Now wired to the Hedge Intent system:
 * - "OPEN HEDGED POSITION" creates a backend-orchestrated intent
 * - Progress stepper shows bridge → deposit → open flow
 * - Auto-resumes on page reload
 */

import { useAtomValue, useAtom } from 'jotai';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { PositionControlsSection } from './trading-dashboard';
import { cn } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/ui/connect-wallet-button';
import { PositionSizeSection } from './position-controls/position-size-section';
import { LeverageSection } from './position-controls/leverage-section';
import { PositionDetailsSection } from './position-controls/position-details-section';
import { TradeDetailsSection } from './position-controls/trade-details-section';
import { AssetPriceHeader } from './position-controls/asset-price-header';
import { HedgeExecutionProgress } from './position-controls/hedge-execution-progress';
import { isLoggedInAtom } from '@/lib/turnkey/store';
import { ChevronDown, Copy } from 'lucide-react';
import {
  marginAtom,
  leverageAtom,
  selectedAssetAtom,
  marginValidationAtom,
  hedgeExitRangeAtom,
  hedgeExitRangeEnabledAtom,
  exitRangeValidationAtom,
} from './position-controls/store';
import {
  ExitRangeSection,
  ExitRangeValidationBanner,
} from './position-controls/exit-range-section';
import { useHedgeIntent } from '@/lib/hedge-intent';
import { useBestPair } from '@/hooks/use-best-pair';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { usePositions } from '@/hooks/use-positions';
import { marketFeedDataAtom } from '@/lib/stores/market-feed.store';
import { PositionControlsSkeleton } from '@/components/ui/skeletons';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { PacificaService } from '@/lib/services/pacifica';
import {
  assetHasOpenHedge,
  existingPositionError,
  isMinVenueNotionalMet,
} from '@/lib/trading/open-hedge-validation';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateTradingBalances } from '@/lib/trading/invalidate-trading-balances';

interface PositionControlsSectionContentProps {
  className?: string;
  onConnectWallet?: () => void;
  onOpenPosition?: () => void;
  /** Mobile trade tab: scrollable flat panel without fixed height clipping */
  embedded?: boolean;
}

const pacificaService = new PacificaService();

export function PositionControlsSectionContent({
  className,
  onConnectWallet,
  onOpenPosition,
  embedded,
}: PositionControlsSectionContentProps) {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const [margin] = useAtom(marginAtom);
  const [leverage] = useAtom(leverageAtom);
  const [selectedAsset] = useAtom(selectedAssetAtom);
  const marginValidation = useAtomValue(marginValidationAtom);
  const exitRangeValidation = useAtomValue(exitRangeValidationAtom);
  const exitRange = useAtomValue(hedgeExitRangeAtom);
  const exitRangeEnabled = useAtomValue(hedgeExitRangeEnabledAtom);
  const { state: turnkeyState } = useTurnkey();
  const queryClient = useQueryClient();

  const evmAddress = turnkeyState.userWallets?.length
    ? getEVMAddress(turnkeyState.userWallets)
    : null;
  const solanaAddress = turnkeyState.userWallets?.length
    ? getSolanaAddress(turnkeyState.userWallets)
    : null;

  useExchangeBalances();

  const { rawPositions, refetch: refetchPositions } = usePositions({
    evmAddress: evmAddress ?? undefined,
    solanaAddress: solanaAddress ?? undefined,
    enabled: isLoggedIn && !!evmAddress && !!solanaAddress,
  });

  const openSymbols = useMemo(() => rawPositions.map((p) => p.symbol), [rawPositions]);

  const hasExistingPosition = selectedAsset ? assetHasOpenHedge(selectedAsset, openSymbols) : false;

  const { openHedge, isExecuting, phase, statusMessage, currentAction, detail, safetyExposure } =
    useHedgeIntent();
  const { getBestPairForAsset } = useBestPair();

  const handleOpenPosition = useCallback(async () => {
    if (onOpenPosition) {
      onOpenPosition();
      return;
    }

    if (!selectedAsset) {
      toast.error('Please select an asset');
      return;
    }

    const marginNum = parseFloat(margin);
    if (!margin || !Number.isFinite(marginNum) || marginNum <= 0) {
      toast.error('Please enter a valid margin amount');
      return;
    }

    if (!isMinVenueNotionalMet(marginNum, leverage)) {
      toast.error('Position size too small per venue', {
        description: marginValidation.error ?? undefined,
        duration: 8000,
      });
      return;
    }

    if (!marginValidation.isValid) {
      toast.error('Cannot open hedge', {
        description: marginValidation.error ?? 'Check margin and balances.',
        duration: 8000,
      });
      return;
    }

    if (exitRangeEnabled && !exitRangeValidation.isValid) {
      toast.error('Cannot open hedge', {
        description: exitRangeValidation.error ?? 'Adjust exit limits.',
        duration: 8000,
      });
      return;
    }

    if (exitRangeEnabled && !exitRange) {
      toast.error('Set exit limits before opening.');
      return;
    }

    if (!isLoggedIn) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (hasExistingPosition) {
      toast.error('Position already open', {
        description: existingPositionError(selectedAsset),
        duration: 8000,
      });
      return;
    }

    const assetItem = marketFeedData.find((a) => a.asset === selectedAsset) ?? null;
    const bestPair = getBestPairForAsset(assetItem);

    const needsPacifica = bestPair.long === 'pacifica' || bestPair.short === 'pacifica';

    if (needsPacifica && solanaAddress) {
      try {
        const approved = await pacificaService.checkBuilderCodeApproval(solanaAddress);
        if (!approved) {
          toast.message('Pacifica builder approval required', {
            description:
              'Confirm the Pacifica builder approval in your wallet when prompted during setup.',
            duration: 8000,
          });
        }
      } catch {
        /* non-blocking — executor will retry */
      }
    }

    await openHedge({
      asset: selectedAsset,
      marginUsd: marginNum,
      leverage,
      longExchange: bestPair.long,
      shortExchange: bestPair.short,
      exitRange: exitRangeEnabled ? exitRange ?? undefined : undefined,
    });

    if (evmAddress && solanaAddress) {
      void invalidateTradingBalances(queryClient, { evmAddress, solanaAddress });
    }
    void refetchPositions();
  }, [
    onOpenPosition,
    selectedAsset,
    margin,
    leverage,
    marginValidation,
    exitRangeEnabled,
    exitRangeValidation,
    exitRange,
    isLoggedIn,
    hasExistingPosition,
    marketFeedData,
    getBestPairForAsset,
    solanaAddress,
    openHedge,
    evmAddress,
    queryClient,
    refetchPositions,
  ]);

  const canExecute =
    isLoggedIn &&
    selectedAsset &&
    margin &&
    parseFloat(margin) > 0 &&
    marginValidation.isValid &&
    exitRangeValidation.isValid &&
    (!exitRangeEnabled || !!exitRange) &&
    !hasExistingPosition &&
    !isExecuting;

  const isComplete = phase === 'complete';
  const isFailed = phase === 'failed' || phase === 'safety_failed';

  const [progressDismissed, setProgressDismissed] = useState(false);

  useEffect(() => {
    if (isExecuting) setProgressDismissed(false);
  }, [isExecuting]);

  useEffect(() => {
    if (!isComplete && !isFailed) return;
    const timer = setTimeout(() => setProgressDismissed(true), 2000);
    return () => clearTimeout(timer);
  }, [isComplete, isFailed]);

  const showProgress = (isExecuting || isComplete || isFailed) && !progressDismissed;

  const getButtonText = (): string => {
    if (isExecuting) {
      switch (phase) {
        case 'creating':
          return 'Creating intent...';
        case 'bridging':
          return 'Bridging funds...';
        case 'depositing':
          return 'Depositing...';
        case 'pacifica_access':
          return 'Pacifica access...';
        case 'opening':
          return 'Opening positions...';
        case 'closing':
          return 'Safety mode...';
        default:
          return 'Executing...';
      }
    }

    if (isComplete) return 'Hedge live ✓';

    const marginNum = parseFloat(margin) || 0;
    if (marginNum <= 0) {
      return 'Enter Margin Amount';
    }

    if (!isMinVenueNotionalMet(marginNum, leverage)) {
      return 'Min. Size Not Met';
    }

    if (!marginValidation.isValid) {
      if (marginValidation.error?.toLowerCase().includes('balance')) {
        return 'Insufficient Balance';
      }
      return marginValidation.error || 'Invalid Margin';
    }

    if (hasExistingPosition) {
      return 'Hedge Already Open';
    }

    return 'Open Hedged Position';
  };

  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const assetItem = useMemo(
    () => (selectedAsset ? (marketFeedData.find((a) => a.asset === selectedAsset) ?? null) : null),
    [selectedAsset, marketFeedData]
  );

  const bestPair = useMemo(() => getBestPairForAsset(assetItem), [assetItem, getBestPairForAsset]);

  const price = useMemo(() => assetItem?.markPx || assetItem?.hyperliquidMarkPx || 0, [assetItem]);

  const longProtocol = useMemo(
    () => assetItem?.protocols?.[bestPair.long] ?? null,
    [assetItem, bestPair.long]
  );

  const shortProtocol = useMemo(
    () => assetItem?.protocols?.[bestPair.short] ?? null,
    [assetItem, bestPair.short]
  );

  const fundingLong = useMemo(
    () => longProtocol?.fundingRateYearly || assetItem?.hyperliquidFundingRate || 0,
    [longProtocol, assetItem]
  );

  const fundingShort = useMemo(
    () => shortProtocol?.fundingRateYearly || assetItem?.pacificaFundingRate || 0,
    [shortProtocol, assetItem]
  );

  const spreadAPR = fundingShort - fundingLong;

  const gridItems = useMemo(
    () => [
      { label: 'Long Venue', value: bestPair.long.toUpperCase(), color: 'text-emerald-400' },
      { label: 'Short Venue', value: bestPair.short.toUpperCase(), color: 'text-rose-400' },
      {
        label: 'Long Funding',
        value: `${fundingLong > 0 ? '+' : ''}${fundingLong.toFixed(2)}%`,
        color: fundingLong >= 0 ? 'text-emerald-400' : 'text-rose-400',
      },
      {
        label: 'Short Funding',
        value: `${fundingShort > 0 ? '+' : ''}${fundingShort.toFixed(2)}%`,
        color: fundingShort >= 0 ? 'text-emerald-400' : 'text-rose-400',
      },
      {
        label: 'Spread APR',
        value: `${spreadAPR > 0 ? '+' : ''}${spreadAPR.toFixed(2)}%`,
        color: spreadAPR >= 0 ? 'text-emerald-400' : 'text-rose-400',
      },
      {
        label: 'Max Leverage',
        value: `${Math.min(longProtocol?.maxLeverage ?? 20, shortProtocol?.maxLeverage ?? 20)}x`,
        color: 'text-white',
      },
    ],
    [bestPair, fundingLong, fundingShort, spreadAPR, longProtocol, shortProtocol]
  );

  if (marketFeedData.length === 0) {
    return <PositionControlsSkeleton className={className} />;
  }

  return (
    <PositionControlsSection
      embedded={embedded}
      className={cn(
        embedded
          ? 'h-auto min-h-full'
          : 'h-full overflow-hidden bg-[#1B1B1B] lg:w-[350px] xl:w-[400px] lg:shrink-0',
        className
      )}
    >
      <div className={cn('flex flex-col', embedded ? 'min-h-full' : 'h-full')}>
        {/* ── Top Stats Bar ───────────────────────────────────── */}
        {!embedded && selectedAsset && (
          <div className="px-4 pt-3 pb-2.5 space-y-2.5 border-b border-white/[0.06] bg-[#121315]/40 shrink-0">
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-text-muted-60 font-bold uppercase tracking-wider leading-none">
                  Price
                </span>
                <span className="text-[11px] font-bold text-text-primary font-mono mt-1 truncate">
                  $
                  {price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-text-muted-60 font-bold uppercase tracking-wider leading-none">
                  Long Fund
                </span>
                <span
                  className={cn(
                    'text-[11px] font-bold font-mono mt-1 truncate',
                    fundingLong >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {fundingLong > 0 ? '+' : ''}
                  {fundingLong.toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-text-muted-60 font-bold uppercase tracking-wider leading-none">
                  Short Fund
                </span>
                <span
                  className={cn(
                    'text-[11px] font-bold font-mono mt-1 truncate',
                    fundingShort >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {fundingShort > 0 ? '+' : ''}
                  {fundingShort.toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-col items-end min-w-0">
                <span className="text-[10px] text-text-muted-60 font-bold uppercase tracking-wider leading-none">
                  Spread APR
                </span>
                <span
                  className={cn(
                    'text-[11px] font-bold font-mono mt-1 truncate',
                    spreadAPR >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {spreadAPR > 0 ? '+' : ''}
                  {spreadAPR.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Funding Ratio Bar */}
            <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden flex">
              {(() => {
                const absL = Math.abs(fundingLong);
                const absS = Math.abs(fundingShort);
                const total = absL + absS || 1;
                return (
                  <>
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${(absL / total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(absS / total) * 100}%` }}
                    />
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── USDC Balance Bar ─────────────────────────────────── */}
        {!embedded && isLoggedIn && (
          <div className="px-4 py-2 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#2775CA] flex items-center justify-center">
                <span className="text-[8px] font-black text-white leading-none">$</span>
              </div>
              <span className="text-[11px] font-bold text-text-muted-60 uppercase tracking-wider">
                USDC Balance
              </span>
            </div>
            <span className="text-[13px] font-bold text-text-primary font-mono tabular-nums">
              $
              {baseBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        {/* ── Scrollable Content ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-5">
          <PositionSizeSection />

          <LeverageSection />

          <ExitRangeSection />
          <ExitRangeValidationBanner />

          {hasExistingPosition && selectedAsset && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                {existingPositionError(selectedAsset)}
              </p>
            </div>
          )}

          <PositionDetailsSection />

          {/* ── Hedge Info & Specs Accordion ──────────────────── */}
          <div className="border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() => setIsInfoExpanded(!isInfoExpanded)}
              className="w-full flex items-center justify-between text-xs font-bold text-text-primary hover:text-white cursor-pointer transition-colors"
            >
              <span>Hedge Info</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isInfoExpanded && 'rotate-180'
                )}
              />
            </button>

            {isInfoExpanded && (
              <div className="mt-3 space-y-3">
                {/* Specs Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {gridItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[#121315] border border-white/[0.04] p-2.5 rounded-lg text-center flex flex-col items-center justify-center gap-0.5"
                    >
                      <span className={cn('text-xs font-bold tabular-nums', item.color)}>
                        {item.value}
                      </span>
                      <span className="text-[9px] text-text-muted-60 font-semibold tracking-wide uppercase">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Wallet Addresses */}
                <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between bg-[#121315] border border-white/[0.04] rounded-lg px-3 py-2">
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                      EVM
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-text-primary truncate max-w-[120px]">
                        {evmAddress
                          ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`
                          : 'Not Connected'}
                      </span>
                      {evmAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(evmAddress);
                            toast.success('EVM Address copied!');
                          }}
                          className="text-white/30 hover:text-white cursor-pointer transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-[#121315] border border-white/[0.04] rounded-lg px-3 py-2">
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                      SOL
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-text-primary truncate max-w-[120px]">
                        {solanaAddress
                          ? `${solanaAddress.slice(0, 6)}...${solanaAddress.slice(-4)}`
                          : 'Not Connected'}
                      </span>
                      {solanaAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(solanaAddress);
                            toast.success('Solana Address copied!');
                          }}
                          className="text-white/30 hover:text-white cursor-pointer transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <TradeDetailsSection />
        </div>

        {showProgress && (
          <HedgeExecutionProgress
            detail={detail}
            phase={phase}
            statusMessage={statusMessage}
            currentAction={currentAction}
            safetyExposure={safetyExposure}
          />
        )}

        <div className="px-4 md:px-6 pb-4 pt-3 border-t border-border-white-10/50 space-y-3 bg-card shrink-0">
          {isLoggedIn ? (
            <ConnectWalletButton
              onClick={handleOpenPosition}
              size="md"
              fullWidth
              text={getButtonText()}
              disabled={!canExecute || isExecuting}
            />
          ) : (
            <ConnectWalletButton onClick={onConnectWallet} size="md" fullWidth />
          )}
        </div>
      </div>
    </PositionControlsSection>
  );
}
