'use client';

import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-lg border border-border-white-10 bg-card/60">
        <WifiOff className="size-8 text-text-muted-60" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-text-primary">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-text-muted-60">
          Nuke needs a network connection for live market data and trading. Reconnect to
          continue.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg border border-border-white-10 bg-card/80 px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-card"
      >
        Try again
      </button>
      <Link
        href="/"
        className="text-sm text-accent underline-offset-4 hover:underline"
      >
        Go to home
      </Link>
    </div>
  );
}
