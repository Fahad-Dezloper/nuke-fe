'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { formatPercentWithSign, formatPrice } from '@/lib/utils';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { useBestPair } from '@/hooks/use-best-pair';
import { fundingSpreadAprYearly } from '@/lib/arbitrage/asset-table-pairs';
import { getProtocolConfig } from '@/lib/protocols/config';
import Image from 'next/image';

export function MobileInfoPanel() {
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const { getBestPairForAsset } = useBestPair();

  if (!selectedAsset) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-muted-60">
        Select an asset to view details
      </div>
    );
  }

  const bestPair = getBestPairForAsset(selectedAsset);
  const longCfg = getProtocolConfig(bestPair.long);
  const shortCfg = getProtocolConfig(bestPair.short);
  const currentPrice = selectedAsset.markPx || selectedAsset.hyperliquidMarkPx || 0;
  const longFundingRate = selectedAsset.protocols?.[bestPair.long]?.fundingRateYearly || 0;
  const shortFundingRate = selectedAsset.protocols?.[bestPair.short]?.fundingRateYearly || 0;
  const estimatedAPR = fundingSpreadAprYearly(longFundingRate, shortFundingRate);
  const priceFormatter = (val: number) => formatPrice(val, 'USD', 'en-US', 4, 4);

  return (
    <div className="scroll-touch flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border-white-10 bg-border-white-10">
        <GridCell label="CURRENT PRICE" span={2}>
          <AnimatedNumber
            value={currentPrice}
            formatter={priceFormatter}
            duration={300}
            className="text-lg font-bold tabular-nums"
          />
        </GridCell>
        <GridCell label="LONG FUNDING RATE">
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-1.5 text-sm font-semibold tabular-nums transition-colors duration-300"
              style={{ color: longCfg ? `var(${longCfg.colorVar})` : undefined }}
            >
              <ArrowUp className="size-3.5" />
              {formatPercentWithSign(longFundingRate)}
            </span>
            {longCfg?.logo ? (
              <Image
                src={longCfg.logo}
                alt={`${longCfg.displayName} logo`}
                width={14}
                height={14}
                className="h-3.5 w-3.5 rounded-full opacity-90"
              />
            ) : null}
          </div>
        </GridCell>
        <GridCell label="SHORT FUNDING RATE">
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-1.5 text-sm font-semibold tabular-nums transition-colors duration-300"
              style={{ color: shortCfg ? `var(${shortCfg.colorVar})` : undefined }}
            >
              <ArrowDown className="size-3.5" />
              {formatPercentWithSign(shortFundingRate)}
            </span>
            {shortCfg?.logo ? (
              <Image
                src={shortCfg.logo}
                alt={`${shortCfg.displayName} logo`}
                width={14}
                height={14}
                className="h-3.5 w-3.5 rounded-full opacity-90"
              />
            ) : null}
          </div>
        </GridCell>
        <GridCell label="EST. NET APR" span={2} highlight>
          <span className="text-lg font-bold tabular-nums text-green-400">
            {formatPercentWithSign(estimatedAPR)}
          </span>
        </GridCell>
      </div>

      <section className="mt-4 rounded-md border border-border-white-10 bg-section-surface p-3">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted-40">
          Best arbitrage pair
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <VenueCard
            side="LONG"
            name={longCfg?.displayName ?? bestPair.long}
            logo={longCfg?.logo}
          />
          <VenueCard
            side="SHORT"
            name={shortCfg?.displayName ?? bestPair.short}
            logo={shortCfg?.logo}
          />
        </div>
      </section>
    </div>
  );
}

function GridCell({
  label,
  children,
  span,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  span?: 2;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-section-surface px-3 py-3',
        span === 2 && 'col-span-2',
        highlight && 'bg-green-950/20'
      )}
    >
      <p className="text-[9px] font-medium uppercase tracking-wider text-text-muted-40">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function VenueCard({
  side,
  name,
  logo,
}: {
  side: 'LONG' | 'SHORT';
  name: string;
  logo?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2.5',
        side === 'LONG'
          ? 'border-green-500/20 bg-green-500/5'
          : 'border-red-500/20 bg-red-500/5'
      )}
    >
      <p
        className={cn(
          'text-[9px] font-bold uppercase tracking-wider',
          side === 'LONG' ? 'text-green-400' : 'text-red-400'
        )}
      >
        {side}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {logo ? (
          <Image src={logo} alt={name} width={18} height={18} className="rounded-sm" />
        ) : null}
        <span className="text-sm font-medium text-text-primary">{name}</span>
      </div>
    </div>
  );
}
