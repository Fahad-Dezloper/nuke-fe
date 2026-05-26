'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import {
  usePortfolioPerformance,
  usePortfolioPnlChart,
  usePortfolioExchanges,
} from '@/hooks';
import type { ExchangeRow, PerformanceBucket, VenueKey } from '@/lib/api/services';
import {
  tabToApiTimeframe,
  timeframeTabs,
  venueDisplayOrder,
  venueMarks,
  type TimeframeTab,
} from './data';
import { ExchangeCard, InfoCard, PerformanceChart, SectionTitle } from './components';
import { formatCount, formatSignedUsd, formatUsd, pnlColorClass } from './format';

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

export function PortfolioContent() {
  const [activeTab, setActiveTab] = useState<TimeframeTab>('Day');
  const apiTimeframe = tabToApiTimeframe[activeTab];

  const { state } = useTurnkey();
  const evmAddress = getEVMAddress(state.userWallets) || '';
  const solanaAddress = getSolanaAddress(state.userWallets) || '';
  const enabled = state.isLoggedIn && !!evmAddress && !!solanaAddress;

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
            {orderedExchanges.map((row) => (
              <ExchangeCard
                key={row.venue}
                name={row.displayName}
                mark={venueMarks[row.venue]}
                availableBalance={formatUsd(row.availableBalanceUsd)}
                accountValue={formatUsd(row.totalEquityUsd)}
              />
            ))}
            <ExchangeCard
              name="All Exchanges"
              mark={null}
              availableBalance={formatUsd(exchanges?.totals.availableBalanceUsd ?? null)}
              accountValue={formatUsd(exchanges?.totals.totalEquityUsd ?? null)}
              highlighted
            />
          </div>
        </section>
      </div>
    </div>
  );
}
