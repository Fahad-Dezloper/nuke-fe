# Turnkey IndexedDB Wallet Management - Next.js Implementation Guide

## Overview

This guide explains how Turnkey's indexedDB wallet management works in the SvelteKit codebase and how to implement the same functionality in a Next.js application. The system supports **three login methods** (EVM Wallet, Solana Wallet, Google OAuth), and **automatically creates Turnkey wallets** (EVM + Solana) for all users regardless of login method.

## Architecture Overview

The implementation consists of three main layers:

1. **TurnkeyClient** (`client.ts`) - Core wallet management class
2. **Store Layer** (`turnkeyStore.ts`) - State management wrapper
3. **API Routes** - Server-side endpoints for Turnkey operations

## Key Concepts

### 1. Turnkey SDK Components

- **`@turnkey/sdk-browser`** - Client-side SDK for browser operations
- **`@turnkey/sdk-server`** - Server-side SDK for API operations
- **`@turnkey/wallet-stamper`** - Wallet authentication (EVM/Solana)
- **IndexedDB Client** - Stores keys and session data in browser's IndexedDB
- **Session Management** - Handles authentication and session persistence

### 2. Login Methods & Flow

The system supports **three login methods**, all of which create the same Turnkey wallets:

1. **EVM Wallet Login** (MetaMask, etc.)
   - User connects EVM wallet → Creates suborg with wallet's public key → Creates Turnkey wallets (EVM + Solana)

2. **Solana Wallet Login** (Phantom, etc.)
   - User connects Solana wallet → Creates suborg with wallet's public key → Creates Turnkey wallets (EVM + Solana)

3. **Google OAuth Login**
   - User logs in with Google → Creates suborg with OAuth token → Creates Turnkey wallets (EVM + Solana)

### 3. Core Flow

```
User Login (EVM/Solana/Google) 
  → Create/Get SubOrg 
  → Authenticate & Store Session in IndexedDB 
  → Load User Data 
  → Ensure Required Wallets Exist (Auto-create EVM + Solana)
  → Use Session-Based Keys for Signing
```

### 4. Session-Based Signing

- Keys are stored in browser's IndexedDB (encrypted by Turnkey)
- Session persists across page refreshes (10-day expiration)
- All transaction signing uses the session-based indexedDB client
- No need to reconnect wallet for each transaction

## Implementation Details

### Part 1: Dependencies

```json
{
  "dependencies": {
    "@turnkey/sdk-browser": "^5.2.3",
    "@turnkey/sdk-server": "^4.1.1",
    "@turnkey/wallet-stamper": "^1.0.7",
    "@turnkey/iframe-stamper": "^2.5.0",
    "jwt-decode": "^4.0.0",
    "ethers": "6",
    "bs58": "^6.0.0",
    "buffer": "^6.0.3"
  }
}
```

**Note**: `buffer` is needed for Solana wallet operations (base58 encoding/decoding).

### Part 2: Environment Variables

**Client-side (`.env.local` or `.env`):**
```env
NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID=your-org-id
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_EXPORT_IFRAME_URL=https://export.turnkey.com
```

**Server-side (`.env.local`):**
```env
TURNKEY_API_PUBLIC_KEY=your-api-public-key
TURNKEY_API_PRIVATE_KEY=your-api-private-key
TURNKEY_ORGANIZATION_ID=your-org-id
```

### Part 3: Core Client Implementation

Create `lib/turnkey/client.ts`:

```typescript
import { Turnkey } from '@turnkey/sdk-browser';
import { jwtDecode, type JwtPayload } from 'jwt-decode';

// Constants
const SESSION_EXPIRATION_SECONDS = 3600 * 24 * 10; // 10 days
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Types
export interface Wallet {
  walletId: string;
  walletName: string;
  accounts?: Array<{
    address: string;
    addressFormat: string;
    path: string;
    publicKey: string;
  }>;
}

export interface TurnkeyState {
  isLoggedIn: boolean;
  isLoading: boolean;
  userWallets: Wallet[];
  turnkeySubOrgId: string | null;
  publicKey: string | null;
  nonce: string | null;
}

export class TurnkeyClient {
  private turnkey: Turnkey;
  private state: TurnkeyState;
  private stateCallback: ((state: TurnkeyState) => void) | null = null;

  constructor(organizationId?: string) {
    this.turnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      defaultOrganizationId: organizationId || ''
    });

    this.state = {
      isLoggedIn: false,
      isLoading: true,
      userWallets: [],
      turnkeySubOrgId: null,
      publicKey: null,
      nonce: null
    };
  }

  getState(): TurnkeyState {
    return { ...this.state };
  }

  subscribe(callback: (state: TurnkeyState) => void) {
    this.stateCallback = callback;
    callback(this.state);

    return {
      updateState: (newState: Partial<TurnkeyState>) => {
        this.state = { ...this.state, ...newState };
        if (this.stateCallback) {
          this.stateCallback(this.state);
        }
      },
      unsubscribe: () => {
        this.stateCallback = null;
      }
    };
  }

  private updateState(newState: Partial<TurnkeyState>) {
    this.state = { ...this.state, ...newState };
    if (this.stateCallback) {
      this.stateCallback(this.state);
    }
  }

  // Initialize Turnkey - checks for existing session or prepares for login
  async initialize(): Promise<void> {
    try {
      this.updateState({ isLoading: true });

      if (this.isOAuthRedirectInProgress()) {
        await this.handleOAuthRedirect();
        return;
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const session = await this.turnkey.getSession();

      if (session && session.organizationId) {
        const sessionValid = await this.refreshSessionIfNeeded();
        if (sessionValid) {
          await this.loadUserData(session.organizationId);
        } else {
          await this.prepareForLogin();
        }
      } else {
        await this.handleOAuthRedirect();
      }
    } catch (error) {
      console.error('Initialization failed:', error);
      if (!this.isOAuthRedirectInProgress()) {
        await this.prepareForLogin();
      }
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  // Refresh session if expired
  async refreshSessionIfNeeded(): Promise<boolean> {
    try {
      const session = await this.turnkey.getSession();
      if (!session || !session.organizationId) {
        return false;
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      try {
        await indexedDbClient.getWallets({
          organizationId: session.organizationId
        });
        return true;
      } catch (error) {
        const publicKey = await indexedDbClient.getPublicKey();
        if (publicKey) {
          await indexedDbClient.refreshSession({
            sessionType: 'SESSION_TYPE_READ_WRITE',
            publicKey: publicKey,
            expirationSeconds: SESSION_EXPIRATION_SECONDS.toString()
          });
          return true;
        } else {
          console.error('No public key available for session refresh');
          return false;
        }
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
      return false;
    }
  }

  // Prepare for login - generates key pair and nonce
  async prepareForLogin(): Promise<void> {
    try {
      if (this.isOAuthRedirectInProgress()) {
        return;
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      await indexedDbClient.resetKeyPair();

      const publicKey = await indexedDbClient.getPublicKey();

      if (publicKey) {
        const nonce = await this.calculateSha256(publicKey);

        this.updateState({
          publicKey: publicKey,
          nonce: nonce,
          isLoggedIn: false
        });
      } else {
        console.error('No public key received from indexedDbClient');
      }
    } catch (error) {
      console.error('Failed to prepare for login:', error);
    }
  }

  // Load user wallets and data
  async loadUserData(subOrgId: string): Promise<void> {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const session = await this.turnkey.getSession();
      if (!session || !session.organizationId) {
        console.warn('No valid session found during loadUserData');
      }

      const walletsResponse = await indexedDbClient.getWallets({
        organizationId: subOrgId
      });

      const walletsWithAccounts = [];
      if (walletsResponse?.wallets) {
        for (const wallet of walletsResponse.wallets) {
          try {
            const accountsResponse = await indexedDbClient.getWalletAccounts({
              walletId: wallet.walletId
            });

            const walletWithAccounts = {
              ...wallet,
              accounts: accountsResponse?.accounts || []
            };

            walletsWithAccounts.push(walletWithAccounts);
          } catch (error) {
            console.error(`Failed to load accounts for wallet ${wallet.walletName}:`, error);
            walletsWithAccounts.push(wallet);
          }
        }
      }

      this.updateState({
        isLoggedIn: true,
        turnkeySubOrgId: subOrgId,
        userWallets: walletsWithAccounts
      });

      await this.ensureUserHasRequiredWallets();
    } catch (error) {
      console.error('Failed to load user data:', error);
      await this.prepareForLogin();
    }
  }

  // Handle OAuth redirect after Google login
  private async handleOAuthRedirect(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const idToken = hashParams.get('id_token');
        const state = hashParams.get('state');

        if (idToken && state) {
          const stateParams = new URLSearchParams(state);
          const provider = stateParams.get('provider');
          const flow = stateParams.get('flow');

          if (provider === 'google' && flow === 'redirect') {
            if (!this.state.publicKey) {
              const existingPublicKey = await this.checkExistingKeyPair();

              if (existingPublicKey) {
                const nonce = await this.calculateSha256(existingPublicKey);
                this.updateState({
                  publicKey: existingPublicKey,
                  nonce: nonce
                });
              } else {
                throw new Error('No public key available during OAuth redirect');
              }
            }

            const result = await this.loginWithGoogle(idToken);

            if (result.success) {
              window.history.replaceState(
                null,
                document.title,
                window.location.pathname + window.location.search
              );

              await this.loadUserData(result.subOrgId!);
              return;
            }
          }
        }
      }

      if (!this.isOAuthRedirectInProgress()) {
        await this.prepareForLogin();
      }
    } catch (error) {
      console.error('OAuth redirect handling failed:', error);
      if (!this.isOAuthRedirectInProgress()) {
        await this.prepareForLogin();
      }
    }
  }

  private isOAuthRedirectInProgress(): boolean {
    if (typeof window === 'undefined') return false;

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const idToken = hashParams.get('id_token');
    const state = hashParams.get('state');

    if (idToken && state) {
      const stateParams = new URLSearchParams(state);
      const provider = stateParams.get('provider');
      const flow = stateParams.get('flow');

      return provider === 'google' && flow === 'redirect';
    }

    return false;
  }

  // Google OAuth login
  async loginWithGoogle(googleCredential: string): Promise<{
    success: boolean;
    subOrgId?: string;
    wallets?: Wallet[];
    error?: string;
  }> {
    try {
      if (!this.state.publicKey) {
        throw new Error('Public key not available');
      }

      let targetSubOrgId: string;

      // Check if suborg exists
      const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterType: 'OIDC_TOKEN',
          filterValue: googleCredential
        })
      });

      const suborgsData = await getSuborgsResponse.json();

      if (suborgsData.organizationIds && suborgsData.organizationIds.length > 0) {
        targetSubOrgId = suborgsData.organizationIds[0];
      } else {
        // Create new suborg
        const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oauthProviders: [{ providerName: 'Google-Test', oidcToken: googleCredential }],
            apiKeys: []
          })
        });

        const createResult = await createSuborgResponse.json();
        targetSubOrgId = createResult.subOrganizationId;
      }

      // Authenticate and get session
      const authResponse = await fetch('/api/turnkey/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suborgID: targetSubOrgId,
          publicKey: this.state.publicKey,
          oidcToken: googleCredential
        })
      });

      const authResult = await authResponse.json();

      if (authResult.session) {
        const indexedDbClient = await this.turnkey.indexedDbClient();
        await indexedDbClient.init();
        await indexedDbClient.loginWithSession(authResult.session);

        await this.loadUserData(targetSubOrgId);

        return {
          success: true,
          subOrgId: targetSubOrgId,
          wallets: this.state.userWallets
        };
      } else {
        throw new Error('No session received from authentication');
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate Google OAuth URL
  generateGoogleAuthUrl(clientId: string, redirectUri: string): string {
    if (!this.state.publicKey) {
      throw new Error('Public key not available');
    }

    const nonce = this.state.nonce;
    if (!nonce) {
      throw new Error('Nonce not available');
    }

    const flow = 'redirect';

    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri.replace(/\/$/, ''));
    googleAuthUrl.searchParams.set('response_type', 'id_token');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('nonce', nonce);
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('state', `provider=google&flow=${flow}`);

    return googleAuthUrl.toString();
  }

  redirectToGoogle(clientId: string, redirectUri: string): void {
    const authUrl = this.generateGoogleAuthUrl(clientId, redirectUri);
    window.location.href = authUrl;
  }

  // Create wallet
  async createWallet(walletName: string): Promise<{
    success: boolean;
    wallet?: Wallet;
    error?: string;
  }> {
    try {
      if (!this.state.isLoggedIn || !this.state.turnkeySubOrgId) {
        throw new Error('User not logged in');
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const createWalletResponse = await indexedDbClient.createWallet({
        organizationId: this.state.turnkeySubOrgId,
        walletName: walletName,
        accounts: [
          {
            addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
            curve: 'CURVE_SECP256K1',
            path: "m/44'/60'/0'/0/0",
            pathFormat: 'PATH_FORMAT_BIP32'
          },
          {
            addressFormat: 'ADDRESS_FORMAT_SOLANA',
            curve: 'CURVE_ED25519',
            path: "m/44'/501'/0'/0/0",
            pathFormat: 'PATH_FORMAT_BIP32'
          }
        ]
      });

      const newWallet: Wallet = {
        walletId: createWalletResponse.walletId!,
        walletName: walletName,
        accounts: [
          ...createWalletResponse.addresses.map((address) => ({
            address: address,
            addressFormat: address.startsWith('0x')
              ? 'ADDRESS_FORMAT_ETHEREUM'
              : 'ADDRESS_FORMAT_SOLANA',
            path: address.startsWith('0x') ? "m/44'/60'/0'/0/0" : "m/44'/501'/0'/0/0",
            publicKey: this.state.publicKey!
          }))
        ]
      };

      this.updateState({
        userWallets: [...this.state.userWallets, newWallet]
      });

      return {
        success: true,
        wallet: newWallet
      };
    } catch (error: unknown) {
      console.error('Create wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Sign transaction
  async signTransaction(
    unsignedTransaction: string,
    walletID: string
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const signResult = await indexedDbClient.signTransaction({
        type: 'TRANSACTION_TYPE_ETHEREUM',
        timestampMs: Date.now().toString(),
        organizationId: this.state.turnkeySubOrgId!,
        signWith: walletID,
        unsignedTransaction
      });

      return {
        success: true,
        signature: signResult.activity.result.signTransactionResult?.signedTransaction
      };
    } catch (error: unknown) {
      console.error('Signing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Sign Solana transaction
  async signSolanaTransaction(
    unsignedTransaction: string, // hex-encoded
    walletAddress: string
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const session = await this.turnkey.getSession();
      if (!session?.organizationId) {
        throw new Error('No valid session');
      }

      const signResult = await indexedDbClient.signTransaction({
        type: 'TRANSACTION_TYPE_SOLANA',
        timestampMs: Date.now().toString(),
        organizationId: session.organizationId,
        signWith: walletAddress,
        unsignedTransaction
      });

      return {
        success: true,
        signature: signResult.activity.result.signTransactionResult?.signedTransaction
      };
    } catch (error: unknown) {
      console.error('Solana signing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Sign raw payload
  async signPayloadRaw(walletID: string, message: string) {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const walletAddress = (
        await indexedDbClient.getWalletAccounts({
          walletId: walletID
        })
      ).accounts[0].address;

      const addressType = walletAddress?.startsWith('0x') ? 'ETH' : 'SOL';

      const { keccak256, toUtf8Bytes } = await import('ethers');
      const hashedMessage = keccak256(toUtf8Bytes(message));

      const resp = await indexedDbClient.signRawPayload({
        signWith: walletAddress!,
        payload: hashedMessage,
        encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
        hashFunction: addressType === 'ETH' ? 'HASH_FUNCTION_NO_OP' : 'HASH_FUNCTION_NOT_APPLICABLE'
      });

      return {
        success: true,
        signature: {
          r: resp.r,
          s: resp.s,
          v: Number(resp.v)
        }
      };
    } catch (error: unknown) {
      console.error('Signing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Logout
  async logout(): Promise<boolean> {
    try {
      await this.turnkey.logout();

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.clear();

      this.updateState({
        isLoggedIn: false,
        isLoading: false,
        userWallets: [],
        turnkeySubOrgId: null,
        publicKey: null,
        nonce: null
      });

      await this.prepareForLogin();

      return true;
    } catch (error: unknown) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Helper methods
  private async calculateSha256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async checkExistingKeyPair(): Promise<string | null> {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();
      const publicKey = await indexedDbClient.getPublicKey();
      return publicKey;
    } catch (error) {
      return null;
    }
  }

  // Ensure user has required wallets (EVM + Solana)
  // This is called automatically after login, regardless of login method
  private async ensureUserHasRequiredWallets(): Promise<void> {
    try {
      if (this.state.userWallets.length === 0) {
        console.log('No wallets found, creating default wallet with both chains...');
        const createResult = await this.createWallet('Default Wallet');
        if (createResult.success) {
          console.log('Default wallet created successfully');
        } else {
          console.error('Failed to create default wallet:', createResult.error);
        }
        return;
      }

      const hasEthereumWallet = this.state.userWallets.some((wallet) =>
        wallet.accounts?.some(
          (account) =>
            account.addressFormat === 'ADDRESS_FORMAT_ETHEREUM' || account.address?.startsWith('0x')
        )
      );

      const hasSolanaWallet = this.state.userWallets.some((wallet) =>
        wallet.accounts?.some(
          (account) =>
            (account.addressFormat === 'ADDRESS_FORMAT_SOLANA' &&
              wallet.walletName !== 'Solana Memes Wallet') ||
            (account.address &&
              !account.address.startsWith('0x') &&
              account.address.length > 40 &&
              wallet.walletName !== 'Solana Memes Wallet')
        )
      );

      // Create Solana wallet if missing
      if (!hasSolanaWallet) {
        console.log('User does not have Solana wallet, creating Solana wallet...');
        const createResult = await this.createSolanaWallet();
        if (createResult.success) {
          console.log('Solana wallet created successfully');
        } else {
          console.error('Failed to create Solana wallet:', createResult.error);
        }
      }

      // Create Ethereum wallet if missing
      if (!hasEthereumWallet) {
        console.log('User does not have Ethereum wallet, creating Ethereum wallet...');
        const createResult = await this.createEthereumWallet();
        if (createResult.success) {
          console.log('Ethereum wallet created successfully');
        } else {
          console.error('Failed to create Ethereum wallet:', createResult.error);
        }
      }
    } catch (error) {
      console.error('Error ensuring user has required wallets:', error);
    }
  }

  // Create Solana-only wallet
  async createSolanaWallet(): Promise<{
    success: boolean;
    wallet?: Wallet;
    error?: string;
  }> {
    try {
      if (!this.state.isLoggedIn || !this.state.turnkeySubOrgId) {
        throw new Error('User not logged in');
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const createWalletResponse = await indexedDbClient.createWallet({
        organizationId: this.state.turnkeySubOrgId,
        walletName: 'Solana Wallet',
        accounts: [
          {
            addressFormat: 'ADDRESS_FORMAT_SOLANA',
            curve: 'CURVE_ED25519',
            path: "m/44'/501'/0'/0/0",
            pathFormat: 'PATH_FORMAT_BIP32'
          }
        ]
      });

      const newWallet: Wallet = {
        walletId: createWalletResponse.walletId!,
        walletName: 'Solana Wallet',
        accounts: createWalletResponse.addresses.map((address) => ({
          address: address,
          addressFormat: 'ADDRESS_FORMAT_SOLANA',
          path: "m/44'/501'/0'/0/0",
          publicKey: this.state.publicKey!
        }))
      };

      this.updateState({
        userWallets: [...this.state.userWallets, newWallet]
      });

      return {
        success: true,
        wallet: newWallet
      };
    } catch (error: unknown) {
      console.error('Create Solana wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Create Ethereum-only wallet
  async createEthereumWallet(): Promise<{
    success: boolean;
    wallet?: Wallet;
    error?: string;
  }> {
    try {
      if (!this.state.isLoggedIn || !this.state.turnkeySubOrgId) {
        throw new Error('User not logged in');
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const createWalletResponse = await indexedDbClient.createWallet({
        organizationId: this.state.turnkeySubOrgId,
        walletName: 'Ethereum Wallet',
        accounts: [
          {
            addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
            curve: 'CURVE_SECP256K1',
            path: "m/44'/60'/0'/0/0",
            pathFormat: 'PATH_FORMAT_BIP32'
          }
        ]
      });

      const newWallet: Wallet = {
        walletId: createWalletResponse.walletId!,
        walletName: 'Ethereum Wallet',
        accounts: createWalletResponse.addresses.map((address) => ({
          address: address,
          addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
          path: "m/44'/60'/0'/0/0",
          publicKey: this.state.publicKey!
        }))
      };

      this.updateState({
        userWallets: [...this.state.userWallets, newWallet]
      });

      return {
        success: true,
        wallet: newWallet
      };
    } catch (error: unknown) {
      console.error('Create Ethereum wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async getIndexedDbClient() {
    return await this.turnkey.indexedDbClient();
  }

  public async getSession() {
    return await this.turnkey.getSession();
  }
}

// Singleton instance
export const turnkeyClient = new TurnkeyClient(
  process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID
);
```

### Part 4: State Management (React Context/Store)

Create `lib/turnkey/store.ts` or use React Context:

```typescript
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { turnkeyClient, type TurnkeyState } from './client';

interface TurnkeyContextType {
  state: TurnkeyState;
  loginWithGoogle: () => Promise<boolean>;
  loginWithEVMWallet: () => Promise<boolean>;
  loginWithSolanaWallet: () => Promise<boolean>;
  logout: () => Promise<boolean>;
  signTransaction: (unsignedTx: string, walletId: string) => Promise<any>;
  createWallet: (name: string) => Promise<any>;
  checkSession: () => Promise<void>;
}

const TurnkeyContext = createContext<TurnkeyContextType | null>(null);

export function TurnkeyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TurnkeyState>(turnkeyClient.getState());

  useEffect(() => {
    // Subscribe to state changes
    const subscription = turnkeyClient.subscribe((newState) => {
      setState(newState);
    });

    // Initialize on mount
    if (typeof window !== 'undefined') {
      turnkeyClient.initialize();
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const state = turnkeyClient.getState();

    if (!state.publicKey) {
      await turnkeyClient.prepareForLogin();
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
    const redirectUri = window.location.origin + '/login';

    turnkeyClient.redirectToGoogle(clientId, redirectUri);
    return true;
  }, []);

  const logout = useCallback(async () => {
    const success = await turnkeyClient.logout();
    if (success) {
      setState(turnkeyClient.getState());
    }
    return success;
  }, []);

  const signTransaction = useCallback(
    async (unsignedTx: string, walletId: string) => {
      return await turnkeyClient.signTransaction(unsignedTx, walletId);
    },
    []
  );

  const createWallet = useCallback(async (name: string) => {
    const result = await turnkeyClient.createWallet(name);
    if (result.success) {
      setState(turnkeyClient.getState());
    }
    return result;
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const session = await turnkeyClient.getSession();

      if (session && session.organizationId) {
        const sessionValid = await turnkeyClient.refreshSessionIfNeeded();
        if (sessionValid) {
          await turnkeyClient.loadUserData(session.organizationId);
          setState(turnkeyClient.getState());
          return;
        }
      }

      await turnkeyClient.initialize();
      setState(turnkeyClient.getState());
    } catch (error) {
      console.error('Session check failed:', error);
      setState(turnkeyClient.getState());
    }
  }, []);

  const loginWithEVMWallet = useCallback(async () => {
    try {
      const { loginWithEVMWallet: loginEVM } = await import('@/lib/turnkey/wallet-helpers');
      const result = await loginEVM();
      
      if (result.success && result.subOrgId) {
        await turnkeyClient.loadUserData(result.subOrgId);
        setState(turnkeyClient.getState());
        return true;
      }
      return false;
    } catch (error) {
      console.error('EVM wallet login error:', error);
      return false;
    }
  }, []);

  const loginWithSolanaWallet = useCallback(async () => {
    try {
      const { loginWithSolanaWallet: loginSolana } = await import('@/lib/turnkey/wallet-helpers');
      const result = await loginSolana();
      
      if (result.success && result.subOrgId) {
        await turnkeyClient.loadUserData(result.subOrgId);
        setState(turnkeyClient.getState());
        return true;
      }
      return false;
    } catch (error) {
      console.error('Solana wallet login error:', error);
      return false;
    }
  }, []);

  return (
    <TurnkeyContext.Provider
      value={{
        state,
        loginWithGoogle,
        loginWithEVMWallet,
        loginWithSolanaWallet,
        logout,
        signTransaction,
        createWallet,
        checkSession
      }}
    >
      {children}
    </TurnkeyContext.Provider>
  );
}

export function useTurnkey() {
  const context = useContext(TurnkeyContext);
  if (!context) {
    throw new Error('useTurnkey must be used within TurnkeyProvider');
  }
  return context;
}
```

### Part 5: API Routes

#### `app/api/turnkey/getSuborg/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!
});

const apiClient = turnkey.apiClient();

export async function POST(request: NextRequest) {
  try {
    const { filterType, filterValue } = await request.json();

    const response = await apiClient.getSubOrgIds({
      organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
      filterType,
      filterValue
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get suborg error:', error);
    return NextResponse.json(
      { message: 'Something went wrong.' },
      { status: 500 }
    );
  }
}
```

#### `app/api/turnkey/createSuborg/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';
import { decode } from 'jwt-decode';
import type { JwtPayload } from 'jwt-decode';

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!
});

export async function POST(request: NextRequest) {
  try {
    const { oauthProviders, apiKeys } = await request.json();

    let decodedData = null;

    if (oauthProviders.length !== 0) {
      const decoded = decode(oauthProviders[0].oidcToken);
      if (decoded && typeof decoded === 'object' && 'email' in decoded) {
        decodedData = decoded as JwtPayload;
      }
    }

    const suborgResponse = await turnkey.apiClient().createSubOrganization({
      subOrganizationName: `suborg-${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: decodedData
            ? JSON.stringify({
                name: decodedData?.name,
                picture: decodedData?.picture,
                time: String(Date.now())
              })
            : `user-${String(Date.now())}`,
          userEmail: decodedData ? decodedData?.email : '',
          apiKeys: apiKeys || [],
          authenticators: [],
          oauthProviders: oauthProviders || []
        }
      ]
    });

    const { subOrganizationId } = suborgResponse;
    if (!subOrganizationId) {
      throw new Error('Expected a non-null subOrganizationId.');
    }

    return NextResponse.json({ subOrganizationId });
  } catch (error) {
    console.error('Create suborg error:', error);
    return NextResponse.json(
      { message: 'Something went wrong.' },
      { status: 500 }
    );
  }
}
```

#### `app/api/turnkey/auth/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';

const SESSION_EXPIRATION_SECONDS = 3600 * 24 * 10; // 10 days

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!
});

export async function POST(request: NextRequest) {
  try {
    const { suborgID, publicKey, oidcToken } = await request.json();

    const oauthResponse = await turnkey.apiClient().oauthLogin({
      oidcToken,
      publicKey,
      organizationId: suborgID,
      expirationSeconds: SESSION_EXPIRATION_SECONDS.toString()
    });

    const { session } = oauthResponse;

    if (!session) {
      throw new Error('session not available');
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Auth API error:', error);
    const err = error as Error;
    return NextResponse.json(
      {
        message: 'Something went wrong.',
        error: err.message,
        details: err.toString()
      },
      { status: 500 }
    );
  }
}
```

### Part 6: Wallet Login Helpers

Create `lib/turnkey/wallet-helpers.ts`:

```typescript
import { Turnkey, SessionType } from '@turnkey/sdk-browser';
import { EthereumWallet } from '@turnkey/wallet-stamper';
import { SESSION_EXPIRATION_SECONDS } from '@/lib/constants';
import bs58 from 'bs58';
import { Buffer } from 'buffer';

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
    const hex = [...signed.signature].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex;
  }
}

// EVM Wallet Login
export async function loginWithEVMWallet(): Promise<{
  success: boolean;
  subOrgId?: string;
  error?: string;
}> {
  try {
    // Ensure Buffer is available
    if (typeof window !== 'undefined' && !window.Buffer) {
      window.Buffer = Buffer;
    }

    const turnkey = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || ''
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
        filterValue: walletPublicKey
      })
    });

    const suborgsData = await getSuborgsResponse.json();

    // Create suborg if it doesn't exist
    if (!suborgsData.organizationIds || suborgsData.organizationIds.length <= 0) {
      const apiKeys = [
        {
          apiKeyName: 'Wallet Auth - Embedded Wallet',
          publicKey: walletPublicKey,
          curveType: 'API_KEY_CURVE_SECP256K1' as const
        }
      ];

      const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: apiKeys,
          oauthProviders: []
        })
      });

      const createResult = await createSuborgResponse.json();
      console.log('Suborg created with id: ', createResult.subOrganizationId);
    }

    // Login with wallet
    await walletClient.loginWithWallet({
      publicKey,
      sessionType: SessionType.READ_WRITE,
      expirationSeconds: SESSION_EXPIRATION_SECONDS.toString()
    });

    const session = await turnkey.getSession();
    if (session && session.organizationId) {
      return {
        success: true,
        subOrgId: session.organizationId
      };
    } else {
      throw new Error('Failed to connect wallet');
    }
  } catch (error: unknown) {
    console.error('EVM wallet login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Solana Wallet Login (Phantom)
export async function loginWithSolanaWallet(): Promise<{
  success: boolean;
  subOrgId?: string;
  error?: string;
}> {
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
      apiBaseUrl: 'https://api.turnkey.com',
      defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || ''
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const publicKey = await indexedDbClient?.getPublicKey();

    const walletClient = turnkey.walletClient(new PhantomSolanaWallet(hexPubKey));

    // Check if suborg exists
    const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterType: 'PUBLIC_KEY',
        filterValue: hexPubKey
      })
    });

    const suborgsData = await getSuborgsResponse.json();

    // Create suborg if it doesn't exist
    if (!suborgsData.organizationIds || suborgsData.organizationIds.length === 0) {
      const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: [
            {
              apiKeyName: 'Wallet Auth - Solana Phantom',
              publicKey: hexPubKey,
              curveType: 'API_KEY_CURVE_ED25519'
            }
          ],
          oauthProviders: []
        })
      });

      const createResult = await createSuborgResponse.json();
      console.log('Created new suborg:', createResult.subOrganizationId);
    }

    // Login with wallet
    await walletClient.loginWithWallet({
      publicKey,
      sessionType: SessionType.READ_WRITE,
      expirationSeconds: SESSION_EXPIRATION_SECONDS.toString()
    });

    const session = await turnkey.getSession();
    if (session && session.organizationId) {
      return {
        success: true,
        subOrgId: session.organizationId
      };
    } else {
      throw new Error('Failed to connect wallet');
    }
  } catch (error: unknown) {
    console.error('Solana wallet login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
      signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
    };
    Buffer?: typeof Buffer;
  }
}
```

### Part 7: Usage in Components

#### Login Page (`app/login/page.tsx`)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTurnkey } from '@/lib/turnkey/store';
import { loginWithEVMWallet, loginWithSolanaWallet } from '@/lib/turnkey/wallet-helpers';

export default function LoginPage() {
  const { state, loginWithGoogle, checkSession } = useTurnkey();
  const router = useRouter();
  const [loading, setLoading] = useState<'evm' | 'solana' | 'google' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Handle OAuth redirect
    if (typeof window !== 'undefined' && window.location.hash) {
      checkSession();
    } else {
      checkSession();
    }
  }, [checkSession]);

  useEffect(() => {
    if (state.isLoggedIn) {
      router.push('/');
    }
  }, [state.isLoggedIn, router]);

  const handleEVMWalletLogin = async () => {
    try {
      setLoading('evm');
      setError('');
      
      const result = await loginWithEVMWallet();
      
      if (result.success && result.subOrgId) {
        // Load user data and ensure wallets are created
        await checkSession();
      } else {
        setError(result.error || 'Failed to connect wallet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const handleSolanaWalletLogin = async () => {
    try {
      setLoading('solana');
      setError('');
      
      const result = await loginWithSolanaWallet();
      
      if (result.success && result.subOrgId) {
        // Load user data and ensure wallets are created
        await checkSession();
      } else {
        setError(result.error || 'Failed to connect wallet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading('google');
      setError('');
      await loginWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(null);
    }
  };

  if (state.isLoading) {
    return <div>Loading...</div>;
  }

  if (state.isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="text-3xl font-bold text-white text-center">Sign in to your account</h2>
          <p className="mt-2 text-sm text-gray-400 text-center">
            Connect your wallet or use Google to access your account
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* EVM Wallet Button */}
          <button
            onClick={handleEVMWalletLogin}
            disabled={loading !== null}
            className="w-full flex justify-center items-center px-4 py-3 border border-gray-600 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'evm' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
                Connect with EVM Wallet
              </>
            )}
          </button>

          {/* Solana Wallet Button */}
          <button
            onClick={handleSolanaWalletLogin}
            disabled={loading !== null}
            className="w-full flex justify-center items-center px-4 py-3 border border-gray-600 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'solana' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Connecting...
              </>
            ) : (
              <>
                <span className="mr-3">👻</span>
                Connect with Phantom
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full flex justify-center items-center px-4 py-3 border border-gray-600 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Using in a Component

```typescript
'use client';

import { useTurnkey } from '@/lib/turnkey/store';
import { Turnkey } from '@turnkey/sdk-browser';
import bs58 from 'bs58';
import { Buffer } from 'buffer';

export default function WalletComponent() {
  const { state, signTransaction } = useTurnkey();

  // Sign Ethereum transaction using session-based keys
  const handleSignEthereum = async () => {
    if (state.userWallets.length === 0) return;

    // Find Ethereum wallet
    const ethWallet = state.userWallets.find((wallet) =>
      wallet.accounts?.some((acc) => acc.addressFormat === 'ADDRESS_FORMAT_ETHEREUM')
    );

    if (!ethWallet || !ethWallet.accounts?.[0]) return;

    const unsignedTx = '0x...'; // Your unsigned transaction
    const result = await signTransaction(unsignedTx, ethWallet.accounts[0].address);
    
    if (result.success) {
      console.log('Signed transaction:', result.signature);
    }
  };

  // Sign Solana transaction using session-based keys
  const handleSignSolana = async () => {
    if (state.userWallets.length === 0) return;

    // Find Solana wallet
    const solWallet = state.userWallets.find((wallet) =>
      wallet.accounts?.some(
        (acc) =>
          acc.addressFormat === 'ADDRESS_FORMAT_SOLANA' &&
          wallet.walletName !== 'Solana Memes Wallet'
      )
    );

    if (!solWallet || !solWallet.accounts?.[0]) return;

    try {
      // Ensure Buffer is available
      if (typeof window !== 'undefined' && !window.Buffer) {
        window.Buffer = Buffer;
      }

      const turnkey = new Turnkey({
        apiBaseUrl: 'https://api.turnkey.com',
        defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID || ''
      });

      const indexedDbClient = await turnkey.indexedDbClient();
      await indexedDbClient.init();

      const session = await turnkey.getSession();
      if (!session?.organizationId) {
        throw new Error('No valid session');
      }

      // Your unsigned Solana transaction (base58 encoded)
      const encodedTransaction = '...'; // base58 encoded
      
      // Convert to hex for Turnkey
      const decodedData = bs58.decode(encodedTransaction);
      const hexTransaction = Buffer.from(decodedData).toString('hex');

      const signature = await indexedDbClient.signTransaction({
        type: 'TRANSACTION_TYPE_SOLANA',
        timestampMs: Date.now().toString(),
        organizationId: session.organizationId,
        signWith: solWallet.accounts[0].address,
        unsignedTransaction: hexTransaction
      });

      const signedTransaction = signature.activity.result.signTransactionResult?.signedTransaction;

      if (signedTransaction) {
        // Convert back to base58
        const signedBytes = Buffer.from(signedTransaction, 'hex');
        const finalSignedTx = bs58.encode(signedBytes);
        console.log('Signed Solana transaction:', finalSignedTx);
      }
    } catch (error) {
      console.error('Solana signing error:', error);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Your Wallets</h2>
      
      {state.userWallets.map((wallet) => (
        <div key={wallet.walletId} className="mb-4 p-4 border rounded">
          <p className="font-semibold">{wallet.walletName}</p>
          {wallet.accounts?.map((account) => (
            <div key={account.address} className="mt-2">
              <p className="text-sm text-gray-600">
                {account.addressFormat}: {account.address}
              </p>
            </div>
          ))}
        </div>
      ))}

      <div className="mt-6 space-x-4">
        <button
          onClick={handleSignEthereum}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Sign Ethereum Transaction
        </button>
        <button
          onClick={handleSignSolana}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Sign Solana Transaction
        </button>
      </div>
    </div>
  );
}
```

### Session-Based Signing Explained

**Key Points:**
1. **No Wallet Reconnection Needed**: Once logged in, the session is stored in IndexedDB
2. **Automatic Key Access**: The indexedDB client automatically uses the stored keys
3. **Works Across Page Refreshes**: Session persists, so signing works after refresh
4. **Same for All Login Methods**: Whether you logged in with EVM wallet, Solana wallet, or Google, the signing process is identical

**How It Works:**
```typescript
// 1. Get indexedDB client (uses stored session automatically)
const indexedDbClient = await turnkey.indexedDbClient();
await indexedDbClient.init();

// 2. Get current session (from IndexedDB)
const session = await turnkey.getSession();

// 3. Sign transaction using wallet address (keys retrieved from IndexedDB)
const result = await indexedDbClient.signTransaction({
  type: 'TRANSACTION_TYPE_SOLANA', // or 'TRANSACTION_TYPE_ETHEREUM'
  timestampMs: Date.now().toString(),
  organizationId: session.organizationId,
  signWith: walletAddress, // Address of the wallet to sign with
  unsignedTransaction: hexTransaction
});
```

The `signWith` parameter is the **wallet address** (not wallet ID), and Turnkey automatically:
- Looks up the private key in IndexedDB
- Signs the transaction
- Returns the signed transaction

This is why you don't need to reconnect the original wallet (MetaMask/Phantom) for each transaction - the keys are stored in Turnkey's IndexedDB.

### Part 8: App Setup

In `app/layout.tsx`:

```typescript
import { TurnkeyProvider } from '@/lib/turnkey/store';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TurnkeyProvider>{children}</TurnkeyProvider>
      </body>
    </html>
  );
}
```

## Key Features

### 1. **Three Login Methods**
- **EVM Wallet**: Connect MetaMask or any EVM wallet
- **Solana Wallet**: Connect Phantom or any Solana wallet
- **Google OAuth**: Traditional email/password login
- All methods create the same Turnkey wallets (EVM + Solana)

### 2. **Automatic Wallet Creation**
- After any login method, system automatically ensures user has:
  - One Ethereum wallet (SECP256K1)
  - One Solana wallet (ED25519)
- Wallets are created in Turnkey sub-organization
- Keys stored securely in browser's IndexedDB

### 3. **IndexedDB Storage**
- Keys and session data stored in browser's IndexedDB
- Persists across page refreshes
- No server-side key storage
- Encrypted by Turnkey

### 4. **Session Management**
- Automatic session refresh
- 10-day session expiration
- Session-based signing (no need to reconnect wallet)
- Works with all three login methods

### 5. **Wallet Operations**
- Create wallets (Ethereum, Solana)
- List wallets and accounts
- Sign transactions using session-based keys
- Export wallets (via iframe)

### 6. **Multi-Chain Support**
- Ethereum (SECP256K1) - EVM chains
- Solana (ED25519) - Solana blockchain
- Different address formats handled automatically

## Important Notes

1. **Client-Side Only**: IndexedDB operations must run in the browser
2. **Session Persistence**: Sessions are stored in IndexedDB and persist across refreshes
3. **Multiple Login Methods**: All three methods (EVM/Solana/Google) create the same Turnkey wallets
4. **Automatic Wallet Creation**: `ensureUserHasRequiredWallets()` runs after every login
5. **OAuth Flow**: Uses Google OAuth with redirect flow
6. **Sub-Organizations**: Each user gets their own sub-organization (one per login method)
7. **Key Management**: Private keys never leave the browser (stored in IndexedDB)
8. **Session-Based Signing**: All transactions use session keys from IndexedDB, no wallet reconnection needed
9. **Buffer Polyfill**: Required for Solana operations (base58 encoding)

## Security Considerations

- Private keys are stored in browser's IndexedDB (encrypted by Turnkey)
- Sessions are scoped to the organization
- OAuth tokens are used for authentication
- All signing operations happen client-side

## Testing

1. **EVM Wallet Login**
   - Connect MetaMask/wallet
   - Verify suborg creation
   - Verify EVM + Solana wallets are created
   - Test transaction signing

2. **Solana Wallet Login**
   - Connect Phantom wallet
   - Verify suborg creation
   - Verify EVM + Solana wallets are created
   - Test transaction signing

3. **Google OAuth Login**
   - Test OAuth redirect flow
   - Verify suborg creation
   - Verify EVM + Solana wallets are created
   - Test transaction signing

4. **Session Persistence**
   - Test session persistence after refresh
   - Test session refresh mechanism
   - Test automatic wallet creation on re-login

5. **Transaction Signing**
   - Test Ethereum transaction signing
   - Test Solana transaction signing
   - Verify session-based signing works

6. **Logout and Re-login**
   - Test logout clears session
   - Test re-login with same method
   - Test switching between login methods

## Troubleshooting

- **Session not persisting**: Check IndexedDB permissions in browser
- **OAuth redirect failing**: Verify redirect URI matches Google OAuth config
- **EVM wallet not connecting**: Check if MetaMask/wallet is installed and unlocked
- **Solana wallet not connecting**: Check if Phantom is installed
- **Wallets not auto-creating**: Check `ensureUserHasRequiredWallets()` is called after login
- **Signing errors**: Ensure wallet address matches the chain type (EVM vs Solana)
- **Suborg creation failing**: Check API keys and permissions
- **Buffer not defined**: Add buffer polyfill for Solana operations
- **Base58 decode errors**: Ensure bs58 library is installed and Buffer is available
