import { Turnkey, SessionType } from '@turnkey/sdk-browser';
import { EthereumWallet } from '@turnkey/wallet-stamper';
import { SESSION_EXPIRATION_SECONDS } from '@/lib/constants';
import { TURNKEY_API_BASE_URL } from './constants';
import { Buffer } from 'buffer';
import type { LoginResult } from './types';
import { WalletType, type SolanaWalletInterface } from '@turnkey/wallet-stamper';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';
import { ScopedEthereumWallet } from './scoped-ethereum-wallet';
import type { Eip1193Requester } from '@/lib/wallet-discovery/eip6963';
import { connectInjectedSolana, type SolanaWalletKind } from '@/lib/wallet-discovery/solana-injected';

/**
 * Turnkey stamping surface for injected Solana wallets (Phantom, Solflare, Backpack, …).
 */
export class InjectedSolanaWallet implements SolanaWalletInterface {
  type: WalletType.Solana = WalletType.Solana;

  constructor(
    private readonly hexPublicKey: string,
    private readonly signBytes: (msg: Uint8Array) => Promise<Uint8Array>
  ) {}

  async getPublicKey(): Promise<string> {
    return this.hexPublicKey;
  }

  async signMessage(message: string): Promise<string> {
    const encoded = new TextEncoder().encode(message);
    const sig = await this.signBytes(encoded);
    return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

/** @deprecated Use {@link InjectedSolanaWallet}. */
export const PhantomSolanaWallet = InjectedSolanaWallet;

/**
 * Logs in with an EVM wallet via wallet stamper. When `eip1193Provider` is set (EIP-6963),
 * that provider is used; otherwise `window.ethereum` via Turnkey {@link EthereumWallet}.
 */
export async function loginWithEVMWallet(
  eip1193Provider?: Eip1193Requester
): Promise<LoginResult> {
  try {
    if (typeof window !== 'undefined' && !window.Buffer) {
      window.Buffer = Buffer;
    }

    const turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || '',
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const publicKey = await indexedDbClient?.getPublicKey();

    const ethereumInterface = eip1193Provider
      ? new ScopedEthereumWallet(eip1193Provider)
      : new EthereumWallet();
    const walletClient = turnkey.walletClient(ethereumInterface);
    const walletPublicKey = await walletClient.getPublicKey();

    if (!publicKey || !walletPublicKey) {
      throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
        reason: 'No public key found from wallet',
      });
    }

    const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterType: 'PUBLIC_KEY',
        filterValue: walletPublicKey,
      }),
    });

    const suborgsData = await getSuborgsResponse.json();

    if (!suborgsData.organizationIds || suborgsData.organizationIds.length <= 0) {
      const apiKeys = [
        {
          apiKeyName: 'Wallet Auth - Embedded Wallet',
          publicKey: walletPublicKey,
          curveType: 'API_KEY_CURVE_SECP256K1' as const,
        },
      ];

      const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: apiKeys,
          oauthProviders: [],
        }),
      });

      const createResult = await createSuborgResponse.json();
      console.log('Suborg created with id: ', createResult.subOrganizationId);
    }

    await walletClient.loginWithWallet({
      publicKey,
      sessionType: SessionType.READ_WRITE,
      expirationSeconds: SESSION_EXPIRATION_SECONDS.toString(),
    });

    const session = await turnkey.getSession();
    if (session && session.organizationId) {
      return {
        success: true,
        subOrgId: session.organizationId,
      };
    } else {
      throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
        reason: 'Failed to establish session with wallet',
      });
    }
  } catch (error: unknown) {
    const appError = toAppError(error, ErrorCode.AUTH_INVALID_CREDENTIALS);
    console.error('EVM wallet login error:', appError);
    return {
      success: false,
      error: getUserMessage(appError),
    };
  }
}

/**
 * Logs in with an injected Solana wallet (Phantom, Solflare, or Backpack).
 * When `kind` is omitted, Phantom is assumed (prior behavior).
 */
export async function loginWithSolanaWallet(kind?: SolanaWalletKind): Promise<LoginResult> {
  try {
    const resolved: SolanaWalletKind = kind ?? 'phantom';

    const { hexPubKey, signBytes } = await connectInjectedSolana(resolved);

    if (typeof window !== 'undefined' && !window.Buffer) {
      window.Buffer = Buffer;
    }

    const turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || '',
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const embeddedPublicKey = await indexedDbClient?.getPublicKey();

    const walletClient = turnkey.walletClient(new InjectedSolanaWallet(hexPubKey, signBytes));

    const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterType: 'PUBLIC_KEY',
        filterValue: hexPubKey,
      }),
    });

    const suborgsData = await getSuborgsResponse.json();

    if (!suborgsData.organizationIds || suborgsData.organizationIds.length === 0) {
      const labels: Record<SolanaWalletKind, string> = {
        phantom: 'Solana Phantom',
        solflare: 'Solana Solflare',
        backpack: 'Solana Backpack',
      };
      const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: [
            {
              apiKeyName: `Wallet Auth - ${labels[resolved]}`,
              publicKey: hexPubKey,
              curveType: 'API_KEY_CURVE_ED25519',
            },
          ],
          oauthProviders: [],
        }),
      });
      const createResult = await createSuborgResponse.json();
      console.log('Created new suborg:', createResult.subOrganizationId);
    }

    await walletClient.loginWithWallet({
      publicKey: embeddedPublicKey,
      sessionType: SessionType.READ_WRITE,
      expirationSeconds: SESSION_EXPIRATION_SECONDS.toString(),
    });

    const session = await turnkey.getSession();
    if (session && session.organizationId) {
      return {
        success: true,
        subOrgId: session.organizationId,
      };
    }

    throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
      reason: 'Failed to establish session with Solana wallet',
    });
  } catch (error: unknown) {
    const appError = toAppError(error, ErrorCode.AUTH_INVALID_CREDENTIALS);
    console.error('Solana wallet login error:', appError);
    return {
      success: false,
      error: getUserMessage(appError),
    };
  }
}

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      publicKey?: { toString: () => string };
      signMessage: (
        message: Uint8Array,
        encoding?: string
      ) => Promise<{ signature: Uint8Array }>;
    };
    Buffer?: typeof Buffer;
  }
}

export type { SolanaWalletKind } from '@/lib/wallet-discovery/solana-injected';
