import type { LucideIcon } from 'lucide-react';
import { Bot, LineChart, TrendingUp, Wallet } from 'lucide-react';

export interface NavItem {
  label: string;
  shortLabel: string;
  href: string;
  soon?: boolean;
  icon: LucideIcon;
}

/** Shared navigation config for navbar (desktop) and bottom nav (mobile). */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'FUNDING ARBITRAGE',
    shortLabel: 'Arbitrage',
    href: '/',
    icon: TrendingUp,
  },
  {
    label: 'AUTOMATION',
    shortLabel: 'Automation',
    href: '/automation',
    icon: Bot,
    soon: true
  },
  // {
  //   label: 'TRADE',
  //   shortLabel: 'Trade',
  //   href: '/trade',
  //   soon: true,
  //   icon: LineChart,
  // },
  {
    label: 'PORTFOLIO',
    shortLabel: 'Portfolio',
    href: '/portfolio',
    icon: Wallet,
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
