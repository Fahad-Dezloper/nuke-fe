'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArbitragePosition } from '@/types/positions';
import { hyperliquidCoinIconUrl } from '@/lib/hyperliquid/coin-icon-url';
import { getProtocolConfig } from '@/lib/protocols/config';

interface MobilePositionsListProps {
  positions: ArbitragePosition[];
  onClosePosition?: (asset: string) => void;
}

export function MobilePositionsList({ positions, onClosePosition }: MobilePositionsListProps) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-text-muted-60">No open arbitrage positions</p>
      </div>
    );
  }

  return (
    <div className="scroll-touch flex-1 space-y-2 overflow-y-auto p-3">
      {positions.map((position) => (
        <MobilePositionCard
          key={`${position.asset}-${position.leverage}`}
          position={position}
          onClose={onClosePosition}
        />
      ))}
    </div>
  );
}

function MobilePositionCard({
  position,
  onClose,
}: {
  position: ArbitragePosition;
  onClose?: (asset: string) => void;
}) {
  const isPositive =
    position.totalPnl.startsWith('+') ||
    parseFloat(position.totalPnl.replace(/[^0-9.-]/g, '')) > 0;
  const longCfg = getProtocolConfig(position.long.platform.toLowerCase());
  const shortCfg = getProtocolConfig(position.short.platform.toLowerCase());

  return (
    <article className="rounded-md border border-border-white-10 bg-section-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Image
            src={hyperliquidCoinIconUrl(position.asset)}
            alt={position.asset}
            width={28}
            height={28}
            className="rounded-sm"
          />
          <div>
            <p className="text-sm font-bold text-text-primary">{position.asset}</p>
            <p className="text-[10px] text-text-muted-60">{position.leverage}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase text-text-muted-40">Total PnL</p>
          <p
            className={cn(
              'text-sm font-bold tabular-nums',
              isPositive ? 'text-green-400' : 'text-red-400'
            )}
          >
            {position.totalPnl}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
          {longCfg?.displayName ?? position.long.platform}
        </span>
        <span className="inline-flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
          {shortCfg?.displayName ?? position.short.platform}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-white-10 pt-3">
        <Metric label="Size" value={position.size} />
        <Metric label="Margin" value={position.margin} />
        <Metric label="Price PnL" value={position.pricePnl} />
      </div>

      {onClose && (
        <button
          type="button"
          onClick={() => onClose(position.asset)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 py-2 text-xs font-semibold text-red-400 touch-manipulation active:bg-red-500/20"
        >
          <X className="size-3.5" aria-hidden />
          Close position
        </button>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase text-text-muted-40">{label}</p>
      <p className="mt-0.5 text-xs font-medium tabular-nums text-text-primary">{value}</p>
    </div>
  );
}
