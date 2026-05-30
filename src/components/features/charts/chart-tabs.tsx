'use client';

/**
 * Chart Tabs Component
 * Reusable tabs component for chart views
 */

import { cn } from '@/lib/utils';

export type ChartTab = 'pnl' | 'cumulative' | 'funding';

interface ChartTabsProps {
  activeTab: ChartTab;
  onTabChange: (tab: ChartTab) => void;
  className?: string;
  compact?: boolean;
}

const tabs: { id: ChartTab; label: string }[] = [
  { id: 'funding', label: 'Funding Rate' },
  { id: 'pnl', label: 'PnL' },
  // { id: 'cumulative', label: 'Cumulative PnL' },
];

export function ChartTabs({ activeTab, onTabChange, className, compact }: ChartTabsProps) {
  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 bg-card/40 p-1 rounded-lg border border-border-white-10/50',
          className
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer select-none',
              activeTab === tab.id
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'text-text-muted-60 hover:text-text-primary hover:bg-card/25 border border-transparent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-border-white-10 sm:gap-6',
        !compact && 'px-3 md:px-4 lg:px-5',
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative cursor-pointer pb-2 font-medium transition-colors sm:pb-3 text-sm',
            activeTab === tab.id
              ? 'text-text-primary'
              : 'text-text-muted-60 hover:text-text-primary'
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent" />
          )}
        </button>
      ))}
    </div>
  );
}
