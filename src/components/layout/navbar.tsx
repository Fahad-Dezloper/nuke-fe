'use client';

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
  { label: 'Funding Arb', href: '/' },
  { label: 'Automation', href: '/automation' },
  { label: 'Trade', href: '/trade', soon: true },
  { label: 'Portfolio', href: '/portfolio' },
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
    <header
      className={cn(
        'sticky top-0 z-50 w-full shrink-0 border-b border-border-white-10 bg-navbar',
        className
      )}
    >
      <div className="mx-auto flex h-12 items-center justify-between gap-6 px-4 md:px-5">
        <div className="flex items-center gap-8 min-w-0">
          {logo || (
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image src="/logo.png" alt="Nuke" width={26} height={26} className="rounded-sm" />
              <span className="text-sm font-bold text-text-primary tracking-tight hidden sm:inline">
                NUKE
              </span>
            </Link>
          )}
          <NavbarTabs items={navItems} className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
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

      <div className="md:hidden border-t border-border-white-10 px-3 py-2 overflow-x-auto custom-scrollbar">
        <div className="flex gap-1 min-w-max">
          {navItems.map((item) =>
            item.soon ? (
              <span
                key={item.href}
                className="px-3 py-1.5 text-xs font-medium text-text-muted-40 whitespace-nowrap"
              >
                {item.label}
                <span className="ml-1 text-[10px] opacity-70">Soon</span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-sm transition-colors',
                  pathname === item.href
                    ? 'text-text-primary bg-secondary'
                    : 'text-text-muted-60 hover:text-text-primary'
                )}
              >
                {item.label}
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
