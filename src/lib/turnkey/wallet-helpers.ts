/**
 * Wallet Helpers
 * Helper functions for EVM and Solana wallet authentication
 */

import { Turnkey, SessionType } from '@turnkey/sdk-browser';
import { EthereumWallet } from '@turnkey/wallet-stamper';
import { SESSION_EXPIRATION_SECONDS } from '@/lib/constants';
import { TURNKEY_API_BASE_URL } from './constants';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import type { LoginResult } from './types';

// Solana Wallet Interface (for Phantom)
import { WalletType, type SolanaWalletInterface } from '@turnkey/wallet-stamper';

export class PhantomSolanaWallet implements SolanaWalletInterface {
  type: WalletType.Solana = WalletType.Solana;

  constructor(private publicKey: string) {}

  async getPublicKey(): Promise<string> {
    return this.publicKey;
  }

  async signMessage(message: string): Promise<string> {
    const encodedMessage = new TextEncoder().encode(message);

    if (!window.solana?.signMessage) {
      throw new Error('Wallet does not support signMessage');
    }

    const signed = await window.solana.signMessage(encodedMessage, 'utf8');

    // Convert Uint8Array to hex
    const hex = [...signed.signature]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex;
  }
}

// EVM Wallet Login
export async function loginWithEVMWallet(): Promise<LoginResult> {
  try {
    // Ensure Buffer is available
    if (typeof window !== 'undefined' && !window.Buffer) {
      window.Buffer = Buffer;
    }

    const turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId:
        process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || '',
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const publicKey = await indexedDbClient?.getPublicKey();

    const walletClient = turnkey.walletClient(new EthereumWallet());
    const walletPublicKey = await walletClient.getPublicKey();

    if (!publicKey || !walletPublicKey) {
      throw new Error('No public key found');
    }

    // Check if suborg exists
    const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterType: 'PUBLIC_KEY',
        filterValue: walletPublicKey,
      }),
    });

    const suborgsData = await getSuborgsResponse.json();

    // Create suborg if it doesn't exist
    if (
      !suborgsData.organizationIds ||
      suborgsData.organizationIds.length <= 0
    ) {
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

    // Login with wallet
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
      throw new Error('Failed to connect wallet');
    }
  } catch (error: unknown) {
    console.error('EVM wallet login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Solana Wallet Login (Phantom)
export async function loginWithSolanaWallet(): Promise<LoginResult> {
  try {
    // Check if Phantom is installed
    if (!window.solana?.isPhantom) {
      throw new Error('Phantom Wallet not found');
    }

    // Connect Phantom
    await window.solana.connect();
    const base58PubKey = window.solana.publicKey?.toString();
    if (!base58PubKey) throw new Error('Failed to get wallet public key');

    // Ensure Buffer is available
    if (typeof window !== 'undefined' && !window.Buffer) {
      window.Buffer = Buffer;
    }

    // Convert base58 to hex
    const hexPubKey = Buffer.from(bs58.decode(base58PubKey)).toString('hex');

    const turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId:
        process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || '',
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const publicKey = await indexedDbClient?.getPublicKey();

    const walletClient = turnkey.walletClient(
      new PhantomSolanaWallet(hexPubKey)
    );

    // Check if suborg exists
    const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterType: 'PUBLIC_KEY',
        filterValue: hexPubKey,
      }),
    });

    const suborgsData = await getSuborgsResponse.json();

    // Create suborg if it doesn't exist
    if (
      !suborgsData.organizationIds ||
      suborgsData.organizationIds.length === 0
    ) {
      const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: [
            {
              apiKeyName: 'Wallet Auth - Solana Phantom',
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

    // Login with wallet
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
      throw new Error('Failed to connect wallet');
    }
  } catch (error: unknown) {
    console.error('Solana wallet login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Extend Window interface for Solana
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      publicKey?: { toString: () => string };
      signMessage: (
        message: Uint8Array,
        encoding: string
      ) => Promise<{ signature: Uint8Array }>;
    };
    Buffer?: typeof Buffer;
  }
}
