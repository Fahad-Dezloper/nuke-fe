'use client';

import { useMemo, useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import {
  usePortfolioPerformance,
  usePortfolioPnlChart,
  usePortfolioExchanges,
} from '@/hooks';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { useFundExchange, type FundExchange } from '@/hooks/use-fund-exchange';
import type { ExchangeRow, PerformanceBucket, VenueKey } from '@/lib/api/services';
import {
  tabToApiTimeframe,
  timeframeTabs,
  venueDisplayOrder,
  venueMarks,
  venueToFundExchange,
  type TimeframeTab,
} from './data';
import { ExchangeCard, InfoCard, PerformanceChart, SectionTitle } from './components';
import { formatCount, formatSignedUsd, formatUsd, pnlColorClass } from './format';
import { AddMarginModal } from '@/components/ui/add-margin-modal';
import { isLoggedInAtom } from '@/lib/turnkey/store';
import { baseBalanceAtom } from '@/components/features/position-controls/store';
import { isPhoenixTradingEnabled } from '@/lib/phoenix/env';
import { toast } from 'sonner';

const EMPTY_BUCKET: PerformanceBucket = { volumeUsd: 0, strategiesOpened: 0, pnlUsd: 0 };

function pickBucket(
  data: ReturnType<typeof usePortfolioPerformance>['data'],
  tab: TimeframeTab
): PerformanceBucket | undefined {
  if (!data) return undefined;
  return data[tabToApiTimeframe[tab]];
}

function orderExchanges(rows: ExchangeRow[]): ExchangeRow[] {
  const byVenue = new Map<VenueKey, ExchangeRow>();
  rows.forEach((row) => byVenue.set(row.venue, row));
  return venueDisplayOrder
    .map((venue) => byVenue.get(venue))
    .filter((row): row is ExchangeRow => Boolean(row));
}

function sumVolumeUsd(rows: ExchangeRow[]): number | null {
  const values = rows
    .map((r) => r.volumeUsd)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

function existingMarginForVenue(row: ExchangeRow): number {
  const v = row.availableBalanceUsd;
  return v != null && Number.isFinite(v) ? v : 0;
}

export function PortfolioContent() {
  const [activeTab, setActiveTab] = useState<TimeframeTab>('Day');
  const apiTimeframe = tabToApiTimeframe[activeTab];

  const { state } = useTurnkey();
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const baseBalance = useAtomValue(baseBalanceAtom);
  const evmAddress = getEVMAddress(state.userWallets) || '';
  const solanaAddress = getSolanaAddress(state.userWallets) || '';
  const enabled = state.isLoggedIn && !!evmAddress && !!solanaAddress;

  useExchangeBalances();

  const [addMarginOpen, setAddMarginOpen] = useState(false);
  const [addMarginExchange, setAddMarginExchange] = useState<FundExchange>('hyperliquid');
  const [addMarginExisting, setAddMarginExisting] = useState(0);
  const [addMarginVenueName, setAddMarginVenueName] = useState('');

  const { fund, reset, step, isExecuting, statusMessage, error } = useFundExchange();

  const { data: performance } = usePortfolioPerformance({
    evmAddress: evmAddress || undefined,
    solanaAddress: solanaAddress || undefined,
    enabled,
  });

  const { data: pnlChart, loading: pnlChartLoading } = usePortfolioPnlChart({
    evmAddress: evmAddress || undefined,
    solanaAddress: solanaAddress || undefined,
    timeframe: apiTimeframe,
    enabled,
  });

  const { data: exchanges } = usePortfolioExchanges({
    evmAddress: evmAddress || undefined,
    solanaAddress: solanaAddress || undefined,
    enabled,
  });

  const bucket = pickBucket(performance, activeTab) ?? EMPTY_BUCKET;
  const orderedExchanges = useMemo(
    () => (exchanges ? orderExchanges(exchanges.exchanges) : []),
    [exchanges]
  );

  const totalVolumeUsd = useMemo(() => {
    const fromTotals = exchanges?.totals.volumeUsd;
    if (fromTotals != null && Number.isFinite(fromTotals)) return fromTotals;
    return sumVolumeUsd(orderedExchanges);
  }, [exchanges?.totals.volumeUsd, orderedExchanges]);

  const handleOpenAddMargin = useCallback((row: ExchangeRow) => {
    const target = venueToFundExchange(row.venue);
    if (!target) return;

    if (target === 'phoenix' && !isPhoenixTradingEnabled()) {
      toast.error('Phoenix trading is disabled', {
        description:
          'Set NEXT_PUBLIC_PHOENIX_TRADING_ENABLED=true in .env and restart the dev server.',
        duration: 6000,
      });
      return;
    }

    setAddMarginExchange(target);
    setAddMarginExisting(existingMarginForVenue(row));
    setAddMarginVenueName(row.displayName);
    setAddMarginOpen(true);
  }, []);

  const handleCloseAddMargin = useCallback(() => {
    if (isExecuting) return;
    setAddMarginOpen(false);
  }, [isExecuting]);

  const handleSubmitAddMargin = useCallback(
    (amountUsd: number) => {
      fund(addMarginExchange, amountUsd);
    },
    [fund, addMarginExchange]
  );

  return (
    <div className="scroll-touch h-full overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-390 flex-col gap-8 px-3 py-6 sm:gap-10 sm:px-4 sm:py-8 md:w-[92%] lg:w-[85%] lg:gap-12">
        <section className="space-y-5">
          <SectionTitle>Performance</SectionTitle>
          <div className="grid items-start gap-8 lg:grid-cols-[340px_minmax(0,860px)]">
            <div className="space-y-0">
              <div className="grid grid-cols-4 border border-border-white-5 bg-card">
                {timeframeTabs.map((tab, index) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'border-r border-border-white-5 px-3 py-2 text-[11px] text-text-muted-60 transition-colors hover:text-text-primary',
                      index === timeframeTabs.length - 1 && 'border-r-0',
                      tab === activeTab && 'bg-[#2a2a2a] text-text-primary'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <InfoCard label="Volume" value={formatUsd(bucket.volumeUsd)} />
              <InfoCard
                label="Strategies Opened"
                value={formatCount(bucket.strategiesOpened)}
              />
              <InfoCard
                label="PnL"
                value={formatSignedUsd(bucket.pnlUsd)}
                valueClassName={pnlColorClass(bucket.pnlUsd)}
                active
              />
            </div>
            <div className="w-full space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[13px] font-medium tracking-tight text-text-primary">
                  Cumulative PnL
                </h3>
                <span className="text-[11px] text-text-muted-60">{activeTab}</span>
              </div>
              <PerformanceChart
                points={pnlChart?.points ?? []}
                rangeStart={pnlChart?.rangeStart}
                rangeEnd={pnlChart?.rangeEnd}
                timeframe={apiTimeframe}
                loading={pnlChartLoading && !pnlChart}
              />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle>Exchanges</SectionTitle>
          <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-5">
            {orderedExchanges.map((row) => {
              const fundTarget = venueToFundExchange(row.venue);
              return (
                <ExchangeCard
                  key={row.venue}
                  name={row.displayName}
                  mark={venueMarks[row.venue]}
                  availableBalance={formatUsd(row.availableBalanceUsd)}
                  volume={formatUsd(row.volumeUsd)}
                  showAddMargin={isLoggedIn && baseBalance > 0}
                  addMarginDisabled={fundTarget === null}
                  onAddMargin={
                    fundTarget ? () => handleOpenAddMargin(row) : undefined
                  }
                />
              );
            })}
            <ExchangeCard
              name="All Exchanges"
              mark={null}
              availableBalance={formatUsd(exchanges?.totals.availableBalanceUsd ?? null)}
              volume={formatUsd(totalVolumeUsd)}
              highlighted
            />
          </div>
        </section>
      </div>

      <AddMarginModal
        isOpen={addMarginOpen}
        onClose={handleCloseAddMargin}
        exchange={addMarginExchange}
        baseBalance={baseBalance}
        existingMargin={addMarginExisting}
        otherExchangeMargin={0}
        otherExchangeName={addMarginVenueName}
        fundStep={step}
        isExecuting={isExecuting}
        statusMessage={statusMessage}
        error={error}
        onSubmit={handleSubmitAddMargin}
        onReset={reset}
      />
    </div>
  );
}
