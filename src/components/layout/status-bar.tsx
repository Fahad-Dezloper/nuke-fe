'use client';

import { APP_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  className?: string;
}

export function StatusBar({ className }: StatusBarProps) {
  return (
    <footer
      className={cn(
        'shrink-0 border-t border-border-white-10 bg-navbar px-4 md:px-5',
        className
      )}
    >
      <div className="flex h-8 items-center justify-between text-[11px] text-text-muted-40">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_6px_var(--green)]" />
          <span>Stable connection</span>
        </div>
        <span className="font-tabular text-text-muted-60">v{APP_CONFIG.version}</span>
      </div>
    </footer>
  );
}
