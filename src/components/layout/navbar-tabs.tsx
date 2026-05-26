/**
 * Navbar Tabs Component
 * Navigation tabs with active state and animations
 */

'use client';

import { motion } from 'framer-motion';
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

function NavTab({ item, isActive, index }: NavTabProps) {
  const content = (
    <>
      <span className="relative z-10">{item.label}</span>
      {item.soon && <span className="ml-2 text-xs text-text-muted-40 relative z-10">SOON</span>}

      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </>
  );

  if (item.disabled || item.soon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
        className="relative px-4 py-2 text-sm font-medium cursor-not-allowed opacity-60"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
      className="relative"
    >
      <Link
        href={item.href}
        className={cn(
          'relative px-4 py-2 text-sm font-medium transition-colors',
          'text-text-muted-60 hover:text-text-primary',
          isActive && 'text-text-primary'
        )}
      >
        {content}

        {/* Hover Effect */}
        <motion.div
          className="absolute inset-0 rounded-md bg-card/50 opacity-0"
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      </Link>
    </motion.div>
  );
}
