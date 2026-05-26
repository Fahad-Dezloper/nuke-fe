'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isNavActive } from '@/lib/navigation';

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 md:hidden',
        'border-t border-border-white-10',
        'bg-background/90 backdrop-blur-xl supports-backdrop-filter:bg-background/80',
        'pb-[env(safe-area-inset-bottom,0px)]'
      )}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;

          if (item.soon) {
            return (
              <div
                key={item.href}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 opacity-45"
                aria-disabled
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                <span className="text-[10px] font-medium text-text-muted-40">
                  {item.shortLabel}
                </span>
                <span className="text-[9px] uppercase tracking-wide text-text-muted-40">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5',
                'touch-manipulation transition-colors active:scale-95',
                active ? 'text-accent' : 'text-text-muted-60'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="bottomNavIndicator"
                  className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              <Icon
                className={cn('size-5', active && 'drop-shadow-[0_0_8px_rgba(137,207,240,0.45)]')}
                strokeWidth={active ? 2.25 : 1.75}
                aria-hidden
              />
              <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
