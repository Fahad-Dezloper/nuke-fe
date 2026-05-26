'use client';

/**
 * Navbar Component
 * Main navigation bar with logo, tabs (desktop), and user actions
 */

import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { ConnectWalletButton } from '@/components/ui/connect-wallet-button';
import { WalletStatus } from '@/components/ui/wallet-status';
import { DepositButton } from '@/components/ui/deposit-button';
import { useTurnkey, getEVMAddress } from '@/lib/turnkey';
import { NavbarTabs } from '@/components/layout/navbar-tabs';
import { NAV_ITEMS, type NavItem } from '@/lib/navigation';

interface NavbarProps {
  logo?: React.ReactNode;
  navItems?: NavItem[];
  onConnectWallet?: () => void;
  className?: string;
}

export function Navbar({
  logo,
  navItems = NAV_ITEMS,
  onConnectWallet,
  className,
}: NavbarProps) {
  const { state } = useTurnkey();

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'sticky top-0 z-50 w-full shrink-0 border-b border-border-white-10',
        'bg-linear-to-r from-background via-background to-background/95',
        'backdrop-blur-md supports-backdrop-filter:bg-background/80',
        'pt-[env(safe-area-inset-top,0px)]',
        className
      )}
    >
      <div className="mx-auto flex items-center justify-between gap-2 px-3 py-2 md:px-4 md:py-2 lg:px-5">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex min-w-0 shrink items-center"
        >
          {logo || (
            <Link href="/" className="group flex items-center gap-1.5 md:gap-2">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1 font-bold tracking-tight text-primary"
              >
                <Image
                  src="/logo.png"
                  alt="Nuke"
                  width={36}
                  height={36}
                  className="size-8 md:size-10"
                  priority
                />
                <span className="hidden text-sm sm:inline md:text-base">Nuke</span>
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
          className="flex shrink-0 items-center gap-1.5 md:gap-2.5"
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
    </motion.header>
  );
}
