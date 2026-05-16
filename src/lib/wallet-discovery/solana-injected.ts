'use client';

/** Identifiers for known browser-injected Solana wallets (no adapters). */

export type SolanaWalletKind = 'phantom' | 'solflare' | 'backpack';

export type DetectedSolanaWallet = {
  kind: SolanaWalletKind;
  name: string;
};

type SolSignResult = { signature: Uint8Array };

/** Minimal Phantom / Standard Wallet–like surface we need for Turnkey stamping. */
type InjectedSolana = {
  connect?: (opts?: unknown) => Promise<void>;
  publicKey?: { toString(): string };
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<SolSignResult>;
  isPhantom?: boolean;
  isSolflare?: boolean;
};

function asInjected(v: unknown): InjectedSolana | null {
  if (v && typeof v === 'object' && 'signMessage' in v) {
    return v as InjectedSolana;
  }
  return null;
}

/**
 * List Solana browser extensions we can drive with connect + signMessage.
 */
export function listDetectedSolanaWallets(): DetectedSolanaWallet[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const w = window as Window & {
    solana?: InjectedSolana;
    solflare?: InjectedSolana;
    backpack?: { solana?: InjectedSolana } & InjectedSolana;
  };

  const out: DetectedSolanaWallet[] = [];

  if (w.solana?.isPhantom) {
    out.push({ kind: 'phantom', name: 'Phantom' });
  }

  if (
    w.solflare &&
    typeof (w.solflare as InjectedSolana).signMessage === 'function'
  ) {
    out.push({ kind: 'solflare', name: 'Solflare' });
  }

  const backpackSol = asInjected(w.backpack?.solana) ?? asInjected(w.backpack);
  if (backpackSol?.signMessage) {
    out.push({ kind: 'backpack', name: 'Backpack' });
  }

  return out;
}

/**
 * Resolve the injected provider for a given kind. Connects as needed and returns
 * base58 address + hex-encoded ed25519 pubkey + bound signMessage (utf8 bytes).
 */
export async function connectInjectedSolana(kind: SolanaWalletKind): Promise<{
  base58Address: string;
  hexPubKey: string;
  signBytes: (messageUtf8: Uint8Array) => Promise<Uint8Array>;
}> {
  const w = window as Window & {
    solana?: InjectedSolana;
    solflare?: InjectedSolana;
    backpack?: { solana?: InjectedSolana } & InjectedSolana;
  };

  let provider: InjectedSolana | null = null;

  if (kind === 'phantom') {
    if (!w.solana?.isPhantom) {
      throw new Error('Phantom is not available in this browser');
    }
    provider = w.solana;
  } else if (kind === 'solflare') {
    if (!w.solflare?.signMessage) {
      throw new Error('Solflare is not available in this browser');
    }
    provider = w.solflare;
  } else {
    provider = asInjected(w.backpack?.solana) ?? asInjected(w.backpack);
    if (!provider?.signMessage) {
      throw new Error('Backpack is not available in this browser');
    }
  }

  await provider.connect?.();

  const base58PubKey = provider.publicKey?.toString();
  if (!base58PubKey) {
    throw new Error('Could not read Solana wallet public key');
  }

  const bs58 = (await import('bs58')).default;
  const { Buffer } = await import('buffer');
  const hexPubKey = Buffer.from(bs58.decode(base58PubKey)).toString('hex');

  const signBytes = async (messageUtf8: Uint8Array) => {
    if (!provider?.signMessage) {
      throw new Error('Wallet does not support signMessage');
    }
    const signed = await provider.signMessage(messageUtf8, 'utf8');
    return signed.signature;
  };

  return { base58Address: base58PubKey, hexPubKey, signBytes };
}
