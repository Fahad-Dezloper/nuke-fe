export const GA_MEASUREMENT_ID = 'G-7BSQ80J91Q';

type GTagEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent({ action, category, label, value, ...rest }: GTagEvent): void {
  try {
    if (typeof window === 'undefined' || !window.gtag) return;

    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value,
      ...rest,
    });
  } catch {
    /* analytics must never break the app */
  }
}

export function trackPageView(url: string): void {
  try {
    if (typeof window === 'undefined' || !window.gtag) return;

    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  } catch {
    /* analytics must never break the app */
  }
}

// ─── Pre-defined event helpers ──────────────────────────────────────────────

export function trackLogin(method: string): void {
  trackEvent({ action: 'login', category: 'auth', label: method });
}

export function trackLogout(): void {
  trackEvent({ action: 'logout', category: 'auth' });
}

export function trackBridgeStarted(exchange: string, amount?: string): void {
  trackEvent({ action: 'bridge_started', category: 'hedge_flow', label: exchange, amount });
}

export function trackBridgeCompleted(exchange: string, txHash?: string): void {
  trackEvent({ action: 'bridge_completed', category: 'hedge_flow', label: exchange, tx_hash: txHash });
}

export function trackBridgeFailed(exchange: string, error: string): void {
  trackEvent({ action: 'bridge_failed', category: 'hedge_flow', label: exchange, error });
}

export function trackDepositStarted(exchange: string): void {
  trackEvent({ action: 'deposit_started', category: 'hedge_flow', label: exchange });
}

export function trackDepositCompleted(exchange: string, txHash?: string): void {
  trackEvent({ action: 'deposit_completed', category: 'hedge_flow', label: exchange, tx_hash: txHash });
}

export function trackDepositFailed(exchange: string, error: string): void {
  trackEvent({ action: 'deposit_failed', category: 'hedge_flow', label: exchange, error });
}

export function trackPositionOpened(asset: string, leverage?: number, margin?: string): void {
  trackEvent({
    action: 'position_opened',
    category: 'trading',
    label: asset,
    value: leverage,
    margin,
  });
}

export function trackPositionOpenFailed(asset: string, error: string): void {
  trackEvent({ action: 'position_open_failed', category: 'trading', label: asset, error });
}

export function trackPositionClosed(asset: string): void {
  trackEvent({ action: 'position_closed', category: 'trading', label: asset });
}

export function trackPositionCloseFailed(asset: string, error: string): void {
  trackEvent({ action: 'position_close_failed', category: 'trading', label: asset, error });
}

export function trackReferralCodeClaimed(): void {
  trackEvent({ action: 'referral_code_claimed', category: 'onboarding' });
}

export function trackBuilderCodeApproved(): void {
  trackEvent({ action: 'builder_code_approved', category: 'onboarding' });
}
