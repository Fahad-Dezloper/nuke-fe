'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'nuke-pwa-install-dismissed';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in navigator &&
          (navigator as Navigator & { standalone?: boolean }).standalone)
    );

    setIsStandalone(standalone);
    if (standalone) return;

    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
    setDeferredPrompt(null);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    else setVisible(false);
    setDeferredPrompt(null);
  }, [deferredPrompt, dismiss]);

  if (isStandalone || !visible || !deferredPrompt) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-3 z-[60] md:hidden',
        'bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)]',
        'rounded-md border border-border-white-10 bg-card/95 p-3 shadow-lg backdrop-blur-md'
      )}
      role="region"
      aria-label="Install app"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <Download className="size-5 text-accent" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">Install Nuke</p>
          <p className="mt-0.5 text-xs text-text-muted-60">
            Add to your home screen for a full-screen trading experience.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-text-muted-60 transition-colors hover:text-text-primary"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-text-muted-40 transition-colors hover:text-text-primary"
          aria-label="Dismiss install prompt"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
