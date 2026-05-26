'use client';

import type { ReactNode } from 'react';
import { BottomNav } from '@/components/layout/bottom-nav';

interface AppShellProps {
  navbar: ReactNode;
  children: ReactNode;
}

/**
 * Mobile-first app shell: top navbar, scrollable main, fixed bottom nav on small screens.
 */
export function AppShell({ navbar, children }: AppShellProps) {
  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden">
      {navbar}
      <main className="app-main flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      <BottomNav />
    </div>
  );
}
