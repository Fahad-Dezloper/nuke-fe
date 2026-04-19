'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { exchanges, performanceByTimeframe, timeframeTabs, type TimeframeTab } from './data';
import { ExchangeCard, InfoCard, PerformanceChart, SectionTitle } from './components';

export function PortfolioContent() {
  const [activeTab, setActiveTab] = useState<TimeframeTab>('Day');
  const performance = performanceByTimeframe[activeTab];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full w-[85%] max-w-[1560px] flex-col gap-12  py-8">
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
              <InfoCard label="Volume" value={performance.volume} />
              <InfoCard label="Strategies Opened" value={performance.strategiesOpened} />
              <InfoCard label="PnL" value={performance.pnl} active />
            </div>
            <div className="w-full">
              <PerformanceChart />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle>Exchanges</SectionTitle>
          <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-5">
            {exchanges.map((exchange) => (
              <ExchangeCard key={exchange.name} {...exchange} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
