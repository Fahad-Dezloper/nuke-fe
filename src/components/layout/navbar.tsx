'use client';

/**
 * Navbar Component
 * Main navigation bar with logo, tabs, and user actions
 */

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { ConnectWalletButton } from '@/components/ui/connect-wallet-button';
import { WalletStatus } from '@/components/ui/wallet-status';
import { DepositButton } from '@/components/ui/deposit-button';
import { useTurnkey, getEVMAddress } from '@/lib/turnkey';
import { NavbarTabs } from '@/components/layout/navbar-tabs';

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
  { label: 'AUTOMATION', href: '/automation' },
  { label: 'TRADE', href: '/trade', soon: true },
  { label: 'PORTFOLIO', href: '/portfolio' },
];

export function Navbar({
  logo,
  navItems = defaultNavItems,
  onConnectWallet,
  className,
}: NavbarProps) {
  const { state } = useTurnkey();
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border-white-10',
        'bg-linear-to-r from-background via-background to-background/95',
        'backdrop-blur-md supports-backdrop-filter:bg-background/80',
        className
      )}
    >
      <div className=" mx-auto flex py-2 items-center justify-between px-3 md:px-4 lg:px-5">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center"
        >
          {logo || (
            <Link href="/" className="flex items-center gap-2 group">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="font-bold text-primary tracking-tight flex items-center gap-1"
              >
                <Image src="/logo.png" alt="logo" width={40} height={40} />
                Nuke
              </motion.span>
            </Link>
          )}
        </motion.div>

        <NavbarTabs items={navItems} />

        {/* User Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center gap-2.5"
        >
          {state.isLoggedIn ? (
            <>
              <DepositButton size="sm" walletAddress={getEVMAddress(state.userWallets)} />
              <WalletStatus />
            </>
          ) : (
            <ConnectWalletButton onClick={onConnectWallet} size="sm" />
          )}
        </motion.div>
      </div>
      <div className="md:hidden border-t border-border-white-10 bg-background/95 px-2 py-1.5 overflow-x-auto">
        <div className="flex gap-1 min-w-max justify-center">
          {navItems.map((item) =>
            item.soon ? (
              <span
                key={item.href}
                className="px-3 py-1.5 text-[11px] font-medium text-text-muted-40 whitespace-nowrap"
              >
                {item.label}
                <span className="ml-1 text-[10px]">SOON</span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors',
                  pathname === item.href
                    ? 'text-text-primary bg-card/60 border border-border-white-10'
                    : 'text-text-muted-60 hover:text-text-primary hover:bg-card/50'
                )}
              >
                {item.label}
              </Link>
            )
          )}
        </div>
      </div>
    </motion.header>
  );
}
