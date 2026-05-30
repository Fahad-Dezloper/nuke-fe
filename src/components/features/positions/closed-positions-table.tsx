'use client';

/**
 * Closed Positions Table Component
 * Displays closed positions with mock historical data
 */

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getProtocolConfig } from '@/lib/protocols/config';
import { hyperliquidCoinIconUrl } from '@/lib/hyperliquid/coin-icon-url';

// Shared grid template for Closed positions table
const CLOSED_TABLE_GRID =
  'grid grid-cols-[minmax(110px,1.2fr)_minmax(180px,1.8fr)_minmax(160px,1.8fr)_minmax(90px,1.2fr)_minmax(110px,1.4fr)_minmax(80px,1fr)_minmax(110px,1.3fr)_minmax(150px,1.8fr)] gap-3 items-center';

interface ClosedPosition {
  asset: string;
  leverage: string;
  longPlatform: string;
  shortPlatform: string;
  size: string;
  realizedPricePnl: string;
  realizedFundingPnl: string;
  realizedApr: string;
  netProfit: string;
  closedAt: string;
}

const MOCK_CLOSED_POSITIONS: ClosedPosition[] = [
  {
    asset: 'SOL',
    leverage: '3.0x',
    longPlatform: 'hyperliquid',
    shortPlatform: 'backpack',
    size: '15.0 SOL ($2,625.00)',
    realizedPricePnl: '+$65.50',
    realizedFundingPnl: '+$24.30',
    realizedApr: '+18.2%',
    netProfit: '+$89.80',
    closedAt: '2026-05-30 18:24:11',
  },
  {
    asset: 'BTC',
    leverage: '5.0x',
    longPlatform: 'phoenix',
    shortPlatform: 'hyperliquid',
    size: '0.08 BTC ($5,480.00)',
    realizedPricePnl: '-$35.20',
    realizedFundingPnl: '+$142.10',
    realizedApr: '+12.4%',
    netProfit: '+$106.90',
    closedAt: '2026-05-29 11:05:43',
  },
  {
    asset: 'ETH',
    leverage: '2.5x',
    longPlatform: 'lighter',
    shortPlatform: 'pacifica',
    size: '2.5 ETH ($8,500.00)',
    realizedPricePnl: '+$110.00',
    realizedFundingPnl: '-$18.50',
    realizedApr: '+8.9%',
    netProfit: '+$91.50',
    closedAt: '2026-05-28 09:12:04',
  },
];

interface ClosedProtocolBadgeProps {
  protocolId: string;
}

function ClosedProtocolBadge({ protocolId }: ClosedProtocolBadgeProps) {
  const config = getProtocolConfig(protocolId);

  if (!config) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-500/10 border border-gray-500/20 w-fit">
        <span className="text-[10px] font-medium text-text-primary whitespace-nowrap">{protocolId}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-all duration-200 w-fit">
      <Image
        src={config.logo}
        alt={config.displayName}
        width={16}
        height={16}
        className="shrink-0 rounded-xs"
      />
    </div>
  );
}

export function ClosedPositionsTable() {
  const headers = [
    'ASSET',
    'Long / Short',
    'SIZE',
    'Price PnL',
    'Funding PnL',
    'APR',
    'Net Profit',
    'CLOSED AT',
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Scroll container for both horizontal and vertical scrolling */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <div className="w-full min-w-[1230px] flex flex-col min-h-full">
          {/* Table Header - Sticky */}
          <div className="sticky top-0 z-[1] px-5 py-3.5 border-b border-white/[0.06] bg-[#131417]/90 backdrop-blur-md shrink-0 shadow-sm">
            <div className={CLOSED_TABLE_GRID}>
              {headers.map((header) => (
                <span
                  key={header}
                  className="text-[10px] text-white/40 font-bold uppercase tracking-wider truncate"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>

          {/* Table Rows */}
          <div className="flex-1 divide-y divide-white/[0.04]">
            {MOCK_CLOSED_POSITIONS.map((position) => {
              const isPricePnlPositive = position.realizedPricePnl.startsWith('+');
              const isFundingPnlPositive = position.realizedFundingPnl.startsWith('+');
              const isAprPositive = position.realizedApr.startsWith('+');
              const isNetProfitPositive = position.netProfit.startsWith('+');

              return (
                <div
                  key={position.asset + '-' + position.closedAt}
                  className="relative border-b border-white/[0.04] last:border-b-0 cursor-default transition-all duration-200 ease-in-out hover:bg-[#1A1B1E] px-5 py-4 min-h-[68px] flex items-center w-full"
                >
                  <div className={cn(CLOSED_TABLE_GRID, 'w-full')}>
                    {/* ASSET */}
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Image
                          src={hyperliquidCoinIconUrl(position.asset)}
                          alt={position.asset}
                          width={26}
                          height={26}
                          className="rounded-full ring-1 ring-white/10"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-bold text-text-primary leading-none">
                          {position.asset}
                        </span>
                        <span className="inline-flex items-center text-[9px] font-bold px-1 py-0.2 rounded-xs bg-white/5 text-white/50 w-fit">
                          {position.leverage}
                        </span>
                      </div>
                    </div>

                    {/* LONG / SHORT */}
                    <div className="flex items-center gap-1.5 w-full">
                      <ClosedProtocolBadge
                        protocolId={position.longPlatform}
                      />
                      <span className="text-white text-base font-medium shrink-0">→</span>
                      <ClosedProtocolBadge
                        protocolId={position.shortPlatform}
                      />
                    </div>

                    {/* SIZE */}
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white/90 tabular-nums font-mono truncate block">
                        {position.size}
                      </span>
                    </div>

                    {/* PRICE PNL */}
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums font-mono truncate block',
                          isPricePnlPositive ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {position.realizedPricePnl}
                      </span>
                    </div>

                    {/* FUNDING PNL */}
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums font-mono truncate block',
                          isFundingPnlPositive ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {position.realizedFundingPnl}
                      </span>
                    </div>

                    {/* APR */}
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums font-mono truncate block',
                          isAprPositive ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {position.realizedApr}
                      </span>
                    </div>

                    {/* NET PROFIT */}
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center text-xs font-bold tabular-nums font-mono px-2 py-0.5 rounded-md border shadow-xs',
                          isNetProfitPositive
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_2px_10px_rgba(16,185,129,0.06)]'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_2px_10px_rgba(244,63,94,0.06)]'
                        )}
                      >
                        {position.netProfit}
                      </span>
                    </div>

                    {/* CLOSED AT */}
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white/50 font-mono truncate block">
                        {position.closedAt}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
