'use client';

import { cn } from '@/lib/utils';
import { ExchangeLogo } from './exchange-logo';

interface ExchangeCardProps {
  name: string;
  mark: string | null;
  availableBalance: string;
  accountValue: string;
  highlighted?: boolean;
}

export function ExchangeCard({
  name,
  mark,
  availableBalance,
  accountValue,
  highlighted,
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
        <p className="text-[11px] text-text-muted-60">Account Value</p>
        <p className="mt-1 text-[16px] font-medium text-text-primary">{accountValue}</p>
      </div>
    </div>
  );
}
