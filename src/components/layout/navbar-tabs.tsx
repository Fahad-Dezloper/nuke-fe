/**
 * Navbar Tabs Component
 * Navigation tabs with active state
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavActive, type NavItem } from '@/lib/navigation';

export type NavTabItem = Pick<NavItem, 'label' | 'href' | 'soon'> & {
  disabled?: boolean;
};

interface NavbarTabsProps {
  items: NavTabItem[];
  className?: string;
}

export function NavbarTabs({ items, className }: NavbarTabsProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('hidden md:flex items-center gap-1', className)}>
      {items.map((item, index) => {
        const isActive = isNavActive(pathname, item.href);
        return <NavTab key={item.href} item={item} isActive={isActive} index={index} />;
      })}
    </nav>
  );
}

interface NavTabProps {
  item: NavTabItem;
  isActive: boolean;
  index: number;
}

function NavTab({ item, isActive, index: _index }: NavTabProps) {
  const content = (
    <>
      <span className={`relative z-10 ${isActive ? 'text-accent' : 'text-muted-40'}`}>
        {item.label}
      </span>
      {item.soon && <span className="ml-2 text-xs text-text-muted-40 relative z-10">SOON</span>}
    </>
  );

  if (item.disabled || item.soon) {
    return (
      <div className="relative px-4 py-2 text-sm font-medium cursor-not-allowed opacity-60">
        {content}
      </div>
    );
  }

  return (
    <div className="relative">
      <Link
        href={item.href}
        className={cn(
          'relative px-4 py-2 text-sm font-medium transition-colors',
          'text-text-muted-60 hover:text-text-primary',
          isActive && 'text-text-primary'
        )}
      >
        {content}
      </Link>
    </div>
  );
}
