'use client';

/**
 * EIP-6963 Ethereum provider discovery + optional legacy window.ethereum fallback.
 */

export type Eip1193Requester = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export type Eip6963ProviderDetail = {
  info: {
    uuid: string;
    rdns: string;
    name: string;
    icon: string;
  };
  provider: Eip1193Requester;
};

declare global {
  interface WindowEventMap {
    'eip6963:announceProvider': CustomEvent<Eip6963ProviderDetail>;
  }
}

function sortProviders(list: Eip6963ProviderDetail[]): Eip6963ProviderDetail[] {
  return [...list].sort((a, b) => a.info.name.localeCompare(b.info.name));
}

/**
 * Subscribe to EIP-6963 announcements. Dispatches requestProvider immediately.
 * After `legacyAfterMs`, if nothing was announced but `window.ethereum` exists,
 * a synthetic provider is appended.
 */
export function subscribeEip6963Providers(
  onList: (providers: Eip6963ProviderDetail[]) => void,
  opts?: { legacyAfterMs?: number }
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const legacyAfterMs = opts?.legacyAfterMs ?? 400;
  const byUuid = new Map<string, Eip6963ProviderDetail>();

  const flush = () => {
    let list = sortProviders(Array.from(byUuid.values()));
    if (
      list.length === 0 &&
      window.ethereum &&
      typeof window.ethereum.request === 'function'
    ) {
      list = [
        {
          info: {
            uuid: 'nuke-browser-ethereum-legacy',
            rdns: 'io.nuke.legacyEthereum',
            name: 'Injected Ethereum wallet',
            icon: '',
          },
          provider: window.ethereum as unknown as Eip1193Requester,
        },
      ];
    }
    onList(list);
  };

  const onAnnounce = (ev: WindowEventMap['eip6963:announceProvider']) => {
    byUuid.set(ev.detail.info.uuid, ev.detail);
    flush();
  };

  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new CustomEvent('eip6963:requestProvider'));

  const legacyTimer =
    legacyAfterMs > 0
      ? window.setTimeout(() => {
          flush();
        }, legacyAfterMs)
      : null;

  return () => {
    window.removeEventListener('eip6963:announceProvider', onAnnounce);
    if (legacyTimer !== null) {
      clearTimeout(legacyTimer);
    }
  };
}
