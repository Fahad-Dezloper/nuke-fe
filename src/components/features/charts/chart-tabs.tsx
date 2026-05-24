'use client';

import { cn } from '@/lib/utils';

export type ChartTab = 'pnl' | 'cumulative' | 'funding';

interface ChartTabsProps {
  activeTab: ChartTab;
  onTabChange: (tab: ChartTab) => void;
  className?: string;
}

const tabs: { id: ChartTab; label: string }[] = [
  { id: 'funding', label: 'Funding' },
  { id: 'pnl', label: 'PnL' },
];

export function ChartTabs({ activeTab, onTabChange, className }: ChartTabsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors cursor-pointer',
            activeTab === tab.id
              ? 'bg-secondary text-text-primary'
              : 'text-text-muted-60 hover:text-text-primary hover:bg-secondary/50'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
