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
}

const tabs: { id: ChartTab; label: string }[] = [
  { id: 'pnl', label: 'PnL' },
  { id: 'cumulative', label: 'Cumulative PnL' },
  { id: 'funding', label: 'Funding Rate' },
];

export function ChartTabs({
  activeTab,
  onTabChange,
  className,
}: ChartTabsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-6 border-b border-border-white-10 px-3 md:px-4 lg:px-5',
        className
      )}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === tab.id
              ? 'text-text-primary'
              : 'text-text-muted-60 hover:text-text-primary'
          )}>
          {tab.label}
          {activeTab === tab.id && (
            <span className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent' />
          )}
        </button>
      ))}
    </div>
  );
}
