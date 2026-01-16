/**
 * Turnkey Client
 * Core wallet management class for Turnkey IndexedDB operations
 */

import { Turnkey } from '@turnkey/sdk-browser';
import type {
  Wallet,
  TurnkeyState,
  LoginResult,
  WalletCreationResult,
  SignTransactionResult,
} from './types';
import { TURNKEY_API_BASE_URL } from './constants';
import { SessionManager } from './session-manager';
import { OAuthHandler } from './oauth-handler';
import { WalletManager } from './wallet-manager';
import { isOAuthRedirectInProgress, calculateSha256 } from './utils';

export class TurnkeyClient {
  private turnkey: Turnkey;
  private state: TurnkeyState;
  private stateCallback: ((state: TurnkeyState) => void) | null = null;
  private sessionManager: SessionManager;
  private oauthHandler: OAuthHandler;
  private walletManager: WalletManager;

  constructor(organizationId?: string) {
    this.turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId: organizationId || '',
    });

    this.state = {
      isLoggedIn: false,
      isLoading: true,
      userWallets: [],
      turnkeySubOrgId: null,
      publicKey: null,
      nonce: null,
    };

    // Initialize managers
    this.sessionManager = new SessionManager(this.turnkey);
    this.oauthHandler = new OAuthHandler(
      this.turnkey,
      () => this.state.publicKey,
      () => this.state.nonce,
      () => this.checkExistingKeyPair(),
      calculateSha256
    );
    this.walletManager = new WalletManager(
      this.turnkey,
      () => this.state,
      (wallets) => this.updateState({ userWallets: wallets })
    );
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
      },
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

      if (isOAuthRedirectInProgress()) {
        await this.oauthHandler.handleOAuthRedirect(
          (credential) => this.oauthHandler.loginWithGoogle(credential),
          (subOrgId) => this.loadUserData(subOrgId),
          () => this.prepareForLogin()
        );
        return;
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const session = await this.turnkey.getSession();

      if (session && session.organizationId) {
        const sessionValid = await this.sessionManager.refreshSessionIfNeeded();
        if (sessionValid) {
          await this.loadUserData(session.organizationId);
        } else {
          await this.prepareForLogin();
        }
      } else {
        await this.oauthHandler.handleOAuthRedirect(
          (credential) => this.oauthHandler.loginWithGoogle(credential),
          (subOrgId) => this.loadUserData(subOrgId),
          () => this.prepareForLogin()
        );
      }
    } catch (error) {
      console.error('Initialization failed:', error);
      if (!isOAuthRedirectInProgress()) {
        await this.prepareForLogin();
      }
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  // Refresh session if expired
  async refreshSessionIfNeeded(): Promise<boolean> {
    return this.sessionManager.refreshSessionIfNeeded();
  }

  // Prepare for login - generates key pair and nonce
  async prepareForLogin(): Promise<void> {
    try {
      if (isOAuthRedirectInProgress()) {
        return;
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      await indexedDbClient.resetKeyPair();

      const publicKey = await indexedDbClient.getPublicKey();

      if (publicKey) {
        const nonce = await calculateSha256(publicKey);

        this.updateState({
          publicKey: publicKey,
          nonce: nonce,
          isLoggedIn: false,
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
        organizationId: subOrgId,
      });

      const walletsWithAccounts: Wallet[] = [];
      if (walletsResponse?.wallets) {
        for (const wallet of walletsResponse.wallets) {
          try {
            const accountsResponse = await indexedDbClient.getWalletAccounts({
              walletId: wallet.walletId,
            });

            const walletWithAccounts: Wallet = {
              ...wallet,
              accounts: (accountsResponse?.accounts || []).map((account) => ({
                address: account.address || '',
                addressFormat: account.addressFormat || '',
                path: account.path || '',
                publicKey: account.publicKey || this.state.publicKey || '',
              })),
            };

            walletsWithAccounts.push(walletWithAccounts);
          } catch (error) {
            console.error(
              `Failed to load accounts for wallet ${wallet.walletName}:`,
              error
            );
            walletsWithAccounts.push(wallet);
          }
        }
      }

      this.updateState({
        isLoggedIn: true,
        turnkeySubOrgId: subOrgId,
        userWallets: walletsWithAccounts,
      });

      await this.walletManager.ensureUserHasRequiredWallets();
    } catch (error) {
      console.error('Failed to load user data:', error);
      await this.prepareForLogin();
    }
  }

  // Google OAuth login
  async loginWithGoogle(googleCredential: string): Promise<LoginResult> {
    const result = await this.oauthHandler.loginWithGoogle(googleCredential);
    
    if (result.success && result.subOrgId) {
      // Load user data after successful login
      await this.loadUserData(result.subOrgId);
      return {
        ...result,
        wallets: this.state.userWallets,
      };
    }
    
    return result;
  }

  // Generate Google OAuth URL
  generateGoogleAuthUrl(clientId: string, redirectUri: string): string {
    return this.oauthHandler.generateGoogleAuthUrl(clientId, redirectUri);
  }

  redirectToGoogle(clientId: string, redirectUri: string): void {
    this.oauthHandler.redirectToGoogle(clientId, redirectUri);
  }

  // Create wallet with both EVM and Solana accounts
  async createWallet(walletName: string): Promise<WalletCreationResult> {
    return this.walletManager.createWallet(walletName);
  }

  // Sign Ethereum transaction
  async signTransaction(
    unsignedTransaction: string,
    walletID: string
  ): Promise<SignTransactionResult> {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const signResult = await indexedDbClient.signTransaction({
        type: 'TRANSACTION_TYPE_ETHEREUM',
        timestampMs: Date.now().toString(),
        organizationId: this.state.turnkeySubOrgId!,
        signWith: walletID,
        unsignedTransaction,
      });

      return {
        success: true,
        signature:
          signResult.activity.result.signTransactionResult?.signedTransaction,
      };
    } catch (error: unknown) {
      console.error('Signing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Sign Solana transaction
  async signSolanaTransaction(
    unsignedTransaction: string, // hex-encoded
    walletAddress: string
  ): Promise<SignTransactionResult> {
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
        unsignedTransaction,
      });

      return {
        success: true,
        signature:
          signResult.activity.result.signTransactionResult?.signedTransaction,
      };
    } catch (error: unknown) {
      console.error('Solana signing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
        nonce: null,
      });

      await this.prepareForLogin();

      return true;
    } catch (error: unknown) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Helper methods
  private async checkExistingKeyPair(): Promise<string | null> {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();
      const publicKey = await indexedDbClient.getPublicKey();
      return publicKey;
    } catch {
      return null;
    }
  }

  // Expose wallet manager methods for convenience
  async createSolanaWallet(): Promise<WalletCreationResult> {
    return this.walletManager.createSolanaWallet();
  }

  async createEthereumWallet(): Promise<WalletCreationResult> {
    return this.walletManager.createEthereumWallet();
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
