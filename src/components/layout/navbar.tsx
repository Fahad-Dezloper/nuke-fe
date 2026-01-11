'use client';

/**
 * Navbar Component
 * Main navigation bar with logo, tabs, and user actions
 */

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface NavItem {
  label: string;
  href: string;
  soon?: boolean;
}

interface NavbarProps {
  logo?: React.ReactNode;
  navItems?: NavItem[];
  onConnectWallet?: () => void;
  className?: string;
}

const defaultNavItems: NavItem[] = [
  { label: 'FUNDING ARBITRAGE', href: '/' },
  { label: 'TRADE', href: '/trade', soon: true },
  { label: 'PORTFOLIO', href: '/portfolio', soon: true },
];

export function Navbar({
  logo,
  navItems = defaultNavItems,
  onConnectWallet,
  className,
}: NavbarProps) {
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border-white-10',
        'bg-gradient-to-r from-background via-background to-background/95',
        'backdrop-blur-md supports-[backdrop-filter]:bg-background/80',
        className
      )}>
      <div className=' mx-auto flex py-2 items-center justify-between px-3 md:px-4 lg:px-5'>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className='flex items-center'>
          {logo || (
            <Link
              href='/'
              className='flex items-center gap-2 group'>
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className='text-lg font-bold text-primary tracking-tight flex items-center gap-1'>
                <Image
                  src='/logo.png'
                  alt='logo'
                  width={40}
                  height={40}
                />
                Nuke
              </motion.span>
            </Link>
          )}
        </motion.div>

        {/* Navigation Tabs */}
        {/* <nav className='hidden md:flex items-center gap-1'>
          {navItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <NavTab
                key={item.href}
                item={item}
                isActive={isActive}
                index={index}
              />
            );
          })}
        </nav> */}

        {/* User Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className='flex items-center gap-2.5'>
          <motion.button
            onClick={onConnectWallet}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className='px-3.5 py-1.5 rounded-sm bg-white text-background hover:bg-white/90 font-medium text-sm transition-colors shadow-sm'>
            CONNECT WALLET
          </motion.button>
        </motion.div>
      </div>
    </motion.header>
  );
}

interface NavTabProps {
  item: NavItem;
  isActive: boolean;
  index: number;
}

function NavTab({ item, isActive, index }: NavTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
      className='relative'>
      <Link
        href={item.href}
        className={cn(
          'relative z-10 block px-3 py-1.5 text-sm font-medium transition-colors',
          'text-text-muted-60 hover:text-text-primary',
          isActive && 'text-text-primary',
          item.soon && 'cursor-not-allowed opacity-60 pointer-events-none'
        )}>
        {item.label}
        {item.soon && (
          <span className='ml-2 text-xs text-text-muted-40'>SOON</span>
        )}

        {/* Active Indicator */}
        {isActive && (
          <motion.div
            layoutId='activeTab'
            className='absolute bottom-0 left-0 right-0 h-0.5 bg-accent z-10'
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </Link>

      {/* Hover Effect - Behind the link */}
      {!item.soon && (
        <motion.div
          className='absolute inset-0 rounded-md bg-card/50 opacity-0 pointer-events-none'
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  );
}
