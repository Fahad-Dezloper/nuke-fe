'use client';

import type { ReactNode } from 'react';
import { SerwistProvider } from '@serwist/next/react';
import { PwaInstallBanner } from '@/components/pwa/pwa-install-banner';

interface PWAProviderProps {
  children?: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === 'development'}
      register
      reloadOnOnline
    >
      {children}
      <PwaInstallBanner />
    </SerwistProvider>
  );
}
