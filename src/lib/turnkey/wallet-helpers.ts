import { Turnkey, SessionType } from '@turnkey/sdk-browser';
import { EthereumWallet } from '@turnkey/wallet-stamper';
import { SESSION_EXPIRATION_SECONDS } from '@/lib/constants';
import { TURNKEY_API_BASE_URL } from './constants';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import type { LoginResult } from './types';
import { WalletType, type SolanaWalletInterface } from '@turnkey/wallet-stamper';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';

/**
 * PhantomSolanaWallet implements the SolanaWalletInterface for Phantom wallet integration.
 * Wraps Phantom wallet functionality to work with Turnkey's wallet client system.
 */
export class PhantomSolanaWallet implements SolanaWalletInterface {
  type: WalletType.Solana = WalletType.Solana;

  /**
   * Creates a new PhantomSolanaWallet instance.
   *
   * @param publicKey - The Solana public key (hex-encoded)
   */
  constructor(private publicKey: string) {}

  /**
   * Gets the Solana public key.
   *
   * @returns Promise resolving to the public key string
   */
  async getPublicKey(): Promise<string> {
    return this.publicKey;
  }

  /**
   * Signs a message using the Phantom wallet.
   * Requires Phantom wallet to be installed and connected.
   *
   * @param message - The message to sign (UTF-8 string)
   * @returns Promise resolving to the signature as a hexadecimal string
   *
   * @throws {AppError} If Phantom wallet is not available or signing fails
   */
  async signMessage(message: string): Promise<string> {
    const encodedMessage = new TextEncoder().encode(message);

    if (!window.solana?.signMessage) {
      throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
        reason: 'Phantom wallet does not support signMessage',
      });
    }

    const signed = await window.solana.signMessage(encodedMessage, 'utf8');

    const hex = [...signed.signature].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex;
  }
}

/**
 * Logs in a user using an EVM (Ethereum Virtual Machine) wallet.
 * Creates or retrieves a Turnkey sub-organization for the wallet's public key,
 * then establishes a session for wallet operations.
 *
 * @returns Promise resolving to login result with success status, sub-organization ID, or error
 *
 * @throws {AppError} If wallet connection fails, public key is missing, or session creation fails
 *
 * @example
 * ```typescript
 * const result = await loginWithEVMWallet();
 * if (result.success) {
 *   console.log('Logged in with sub-org:', result.subOrgId);
 * }
 * ```
 */
export async function loginWithEVMWallet(): Promise<LoginResult> {
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

    const walletClient = turnkey.walletClient(new EthereumWallet());
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
 * Logs in a user using a Solana wallet (Phantom).
 * Connects to Phantom wallet, creates or retrieves a Turnkey sub-organization,
 * and establishes a session for wallet operations.
 *
 * @returns Promise resolving to login result with success status, sub-organization ID, or error
 *
 * @throws {AppError} If Phantom wallet is not installed, connection fails, or session creation fails
 *
 * @example
 * ```typescript
 * const result = await loginWithSolanaWallet();
 * if (result.success) {
 *   console.log('Logged in with sub-org:', result.subOrgId);
 * }
 * ```
 */
export async function loginWithSolanaWallet(): Promise<LoginResult> {
  try {
    // Check if Phantom is installed
    if (!window.solana?.isPhantom) {
      throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
        reason: 'Phantom wallet not found. Please install Phantom extension.',
      });
    }

    // Connect Phantom
    await window.solana.connect();
    const base58PubKey = window.solana.publicKey?.toString();
    if (!base58PubKey) {
      throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
        reason: 'Failed to get wallet public key from Phantom',
      });
    }

    // Ensure Buffer is available
    if (typeof window !== 'undefined' && !window.Buffer) {
      window.Buffer = Buffer;
    }

    // Convert base58 to hex
    const hexPubKey = Buffer.from(bs58.decode(base58PubKey)).toString('hex');

    const turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || '',
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const publicKey = await indexedDbClient?.getPublicKey();

    const walletClient = turnkey.walletClient(new PhantomSolanaWallet(hexPubKey));

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
        reason: 'Failed to establish session with Solana wallet',
      });
    }
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
      signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
    };
    Buffer?: typeof Buffer;
  }
}
