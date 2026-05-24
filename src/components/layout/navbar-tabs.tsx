'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface NavTabItem {
  label: string;
  href: string;
  soon?: boolean;
  disabled?: boolean;
}

interface NavbarTabsProps {
  items: NavTabItem[];
  className?: string;
}

export function NavbarTabs({ items, className }: NavbarTabsProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex items-center gap-1', className)}>
      {items.map((item) => {
        const isActive = pathname === item.href;

        if (item.disabled || item.soon) {
          return (
            <span
              key={item.href}
              className="px-3 py-1.5 text-sm font-medium text-text-muted-40 cursor-not-allowed"
            >
              {item.label}
              {item.soon && (
                <span className="ml-1.5 text-[10px] text-text-muted-40">Soon</span>
              )}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-sm transition-colors',
              isActive
                ? 'text-text-primary bg-secondary'
                : 'text-text-muted-60 hover:text-text-primary hover:bg-secondary/60'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
