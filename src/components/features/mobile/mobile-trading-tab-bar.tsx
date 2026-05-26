'use client';

import { BarChart3, Info, LineChart, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTradingTab = 'info' | 'chart' | 'positions' | 'trade';

const TABS: { id: MobileTradingTab; label: string; icon: typeof Info }[] = [
  { id: 'info', label: 'Info', icon: Info },
  { id: 'chart', label: 'Chart', icon: LineChart },
  { id: 'positions', label: 'Positions', icon: BarChart3 },
  { id: 'trade', label: 'Trade', icon: Wallet },
];

interface MobileTradingTabBarProps {
  active: MobileTradingTab;
  onChange: (tab: MobileTradingTab) => void;
}

export function MobileTradingTabBar({ active, onChange }: MobileTradingTabBarProps) {
  return (
    <div
      className="shrink-0 border-b border-border-white-10 bg-section-surface/80 px-1"
      role="tablist"
      aria-label="Trading views"
    >
      <div className="grid grid-cols-4 gap-0.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2.5 touch-manipulation transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted-60 active:bg-card/40'
              )}
            >
              <Icon className="size-4" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
