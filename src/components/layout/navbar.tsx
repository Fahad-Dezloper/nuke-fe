'use client';

/**
 * Navbar Component
 * Main navigation bar with logo, tabs (desktop), and user actions
 */

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

export function Navbar({ logo, navItems = NAV_ITEMS, onConnectWallet, className }: NavbarProps) {
  const { state } = useTurnkey();

  return (
    <header className="bg-[#1B1B1B] px-12">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-8">
          {/* LOGO */}
          {logo || (
            <Link href="/" className="group flex items-center gap-1.5 md:gap-2">
              <span className="flex items-center gap-1 font-bold tracking-tight text-primary">
                <Image
                  src="/logo.png"
                  alt="Nuke"
                  width={36}
                  height={36}
                  className="size-8 md:size-14"
                  priority
                />
              </span>
            </Link>
          )}
          <NavbarTabs items={navItems} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2.5">
          {state.isLoggedIn ? (
            <>
              <DepositButton size="sm" walletAddress={getEVMAddress(state.userWallets)} />
              <WalletStatus />
            </>
          ) : (
            <ConnectWalletButton onClick={onConnectWallet} size="sm" />
          )}
        </div>
      </div>
    </header>
  );
}
