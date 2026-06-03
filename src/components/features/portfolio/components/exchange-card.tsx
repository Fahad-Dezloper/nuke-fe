'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExchangeLogo } from './exchange-logo';

interface ExchangeCardProps {
  name: string;
  mark: string | null;
  availableBalance: string;
  volume: string;
  highlighted?: boolean;
  showAddMargin?: boolean;
  addMarginDisabled?: boolean;
  onAddMargin?: () => void;
}

export function ExchangeCard({
  name,
  mark,
  availableBalance,
  volume,
  highlighted,
  showAddMargin,
  addMarginDisabled,
  onAddMargin,
}: ExchangeCardProps) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col border border-border-white-5 bg-card',
        highlighted && 'bg-[#191919]'
      )}
    >
      <div className="flex-1 px-4 py-6">
        <ExchangeLogo name={name} mark={mark} />
      </div>
      <div className="border-t border-border-white-5 px-4 py-3">
        <p className="text-[11px] text-text-muted-60">Available Balance</p>
        <p className="mt-1 text-[16px] font-medium text-text-primary">{availableBalance}</p>
      </div>
      <div className="border-t border-border-white-5 px-4 py-3">
        <p className="text-[11px] text-text-muted-60">Volume</p>
        <p className="mt-1 text-[16px] font-medium text-text-primary">{volume}</p>
      </div>
      {showAddMargin && (
        <div className="border-t border-border-white-5 px-4 py-3">
          <button
            type="button"
            onClick={addMarginDisabled ? undefined : onAddMargin}
            disabled={!!addMarginDisabled}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-md py-2',
              'text-[11px] font-medium tracking-wide',
              'border border-border-white-10/50',
              addMarginDisabled
                ? 'cursor-not-allowed bg-white/5 text-text-muted-60/40 opacity-60'
                : 'cursor-pointer bg-white/5 text-text-muted-60 hover:border-border-white-20 hover:bg-white/10 hover:text-text-primary'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            ADD MARGIN
          </button>
        </div>
      )}
    </div>
  );
}
