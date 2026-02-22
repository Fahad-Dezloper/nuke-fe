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
import { isOAuthRedirectInProgress, extractOAuthParams, calculateSha256 } from './utils';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';
import { KeyFormat } from '@turnkey/iframe-stamper';

/**
 * TurnkeyClient is the main client for interacting with Turnkey wallet services.
 * Manages authentication, wallet operations, session management, and transaction signing.
 * Provides a unified interface for all Turnkey-related operations.
 */
export class TurnkeyClient {
  private turnkey: Turnkey;
  private state: TurnkeyState;
  private stateCallback: ((state: TurnkeyState) => void) | null = null;
  private sessionManager: SessionManager;
  private oauthHandler: OAuthHandler;
  private walletManager: WalletManager;

  /**
   * Creates a new TurnkeyClient instance.
   *
   * @param organizationId - Optional Turnkey organization ID (defaults to env variable)
   */
  constructor(organizationId?: string) {
    this.turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId: organizationId || '',
    });

    this.state = {
      isLoggedIn: false,
      isLoading: true,
      isLoggingIn: false,
      isCreatingWallet: false,
      userWallets: [],
      turnkeySubOrgId: null,
      publicKey: null,
      nonce: null,
      googleIdToken: null,
    };

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

  /**
   * Gets the current Turnkey state.
   *
   * @returns A copy of the current state object
   */
  getState(): TurnkeyState {
    return { ...this.state };
  }

  /**
   * Subscribes to state changes.
   * The callback will be invoked whenever the state is updated.
   *
   * @param callback - Function to call when state changes
   * @returns Object with updateState and unsubscribe methods
   *
   * @example
   * ```typescript
   * const subscription = turnkeyClient.subscribe((newState) => {
   *   console.log('State updated:', newState);
   * });
   * // Later...
   * subscription.unsubscribe();
   * ```
   */
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

  /**
   * Updates the internal state and notifies subscribers.
   *
   * @param newState - Partial state object with properties to update
   */
  updateState(newState: Partial<TurnkeyState>) {
    this.state = { ...this.state, ...newState };
    if (this.stateCallback) {
      this.stateCallback(this.state);
    }
  }

  /**
   * Initializes the Turnkey client.
   * Checks for existing sessions, handles OAuth redirects, and prepares for login if needed.
   * This should be called when the application starts.
   *
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * ```typescript
   * await turnkeyClient.initialize();
   * const state = turnkeyClient.getState();
   * if (state.isLoggedIn) {
   *   // User is already logged in
   * }
   * ```
   */
  async initialize(): Promise<void> {
    try {
      this.updateState({ isLoading: true });

      if (isOAuthRedirectInProgress()) {
        const { idToken: googleIdToken } = extractOAuthParams();
        await this.oauthHandler.handleOAuthRedirect(
          (credential, publicKey) => this.oauthHandler.loginWithGoogle(credential, publicKey),
          (subOrgId) => this.loadUserData(subOrgId),
          () => this.prepareForLogin()
        );
        if (googleIdToken && this.state.isLoggedIn) {
          this.updateState({ googleIdToken });
        }
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
        const { idToken: googleIdToken } = extractOAuthParams();
        await this.oauthHandler.handleOAuthRedirect(
          (credential, publicKey) => this.oauthHandler.loginWithGoogle(credential, publicKey),
          (subOrgId) => this.loadUserData(subOrgId),
          () => this.prepareForLogin()
        );
        if (googleIdToken && this.state.isLoggedIn) {
          this.updateState({ googleIdToken });
        }
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

  /**
   * Refreshes the current session if it has expired or is invalid.
   *
   * @returns Promise resolving to true if session is valid or was refreshed, false otherwise
   */
  async refreshSessionIfNeeded(): Promise<boolean> {
    return this.sessionManager.refreshSessionIfNeeded();
  }

  /**
   * Prepares the client for login by resetting the key pair and generating a new public key.
   * This should be called before initiating a login flow.
   *
   * @returns Promise that resolves when preparation is complete
   */
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

  /**
   * Loads user data including wallets and account information.
   * Fetches all wallets for the user and their associated accounts,
   * then ensures required wallets (Ethereum and Solana) exist.
   *
   * @param subOrgId - Turnkey sub-organization ID
   * @returns Promise that resolves when user data is loaded
   *
   * @throws {AppError} If session is invalid or data loading fails
   */
  async loadUserData(subOrgId: string): Promise<void> {
    try {
      this.updateState({ isLoggingIn: true });

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const session = await this.turnkey.getSession();
      if (!session || !session.organizationId) {
        throw createError(ErrorCode.AUTH_SESSION_EXPIRED, {
          reason: 'No valid session found during loadUserData',
        });
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
            console.error(`Failed to load accounts for wallet ${wallet.walletName}:`, error);
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

      this.updateState({ isLoggingIn: false });
    } catch (error) {
      console.error('Failed to load user data:', error);
      this.updateState({ isLoggingIn: false });
      await this.prepareForLogin();
    }
  }

  /**
   * Logs in a user with Google OAuth credential.
   * Performs OAuth authentication and loads user data upon success.
   *
   * @param googleCredential - Google OAuth ID token (JWT)
   * @returns Promise resolving to login result with success status, sub-organization ID, wallets, or error
   */
  async loginWithGoogle(googleCredential: string): Promise<LoginResult> {
    this.updateState({ isLoggingIn: true, googleIdToken: googleCredential });

    try {
      const result = await this.oauthHandler.loginWithGoogle(googleCredential);

      if (result.success && result.subOrgId) {
        await this.loadUserData(result.subOrgId);
        return {
          ...result,
          wallets: this.state.userWallets,
        };
      }

      this.updateState({ isLoggingIn: false });
      return result;
    } catch (error) {
      this.updateState({ isLoggingIn: false });
      throw error;
    }
  }

  /**
   * Generates a Google OAuth authentication URL.
   *
   * @param clientId - Google OAuth client ID
   * @param redirectUri - URI to redirect to after authentication
   * @returns The complete Google OAuth authentication URL
   */
  generateGoogleAuthUrl(clientId: string, redirectUri: string): string {
    return this.oauthHandler.generateGoogleAuthUrl(clientId, redirectUri);
  }

  /**
   * Redirects the browser to Google OAuth authentication page.
   *
   * @param clientId - Google OAuth client ID
   * @param redirectUri - URI to redirect to after authentication
   */
  redirectToGoogle(clientId: string, redirectUri: string): void {
    this.oauthHandler.redirectToGoogle(clientId, redirectUri);
  }

  /**
   * Creates a new wallet with the specified name.
   * The wallet will support both Ethereum and Solana accounts.
   *
   * @param walletName - Name for the new wallet
   * @returns Promise resolving to wallet creation result
   */
  async createWallet(walletName: string): Promise<WalletCreationResult> {
    this.updateState({ isCreatingWallet: true });

    try {
      const result = await this.walletManager.createWallet(walletName);
      this.updateState({ isCreatingWallet: false });
      return result;
    } catch (error) {
      this.updateState({ isCreatingWallet: false });
      throw error;
    }
  }

  /**
   * Signs an Ethereum transaction using the specified wallet.
   *
   * @param unsignedTransaction - The unsigned Ethereum transaction (hex-encoded)
   * @param walletID - The wallet ID to sign with
   * @returns Promise resolving to sign result with success status and signature or error
   *
   * @throws {AppError} If session is invalid, wallet not found, or signing fails
   */
  async signTransaction(
    unsignedTransaction: string,
    walletID: string
  ): Promise<SignTransactionResult> {
    try {
      if (!this.state.turnkeySubOrgId) {
        throw createError(ErrorCode.AUTH_NOT_LOGGED_IN);
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const signResult = await indexedDbClient.signTransaction({
        type: 'TRANSACTION_TYPE_ETHEREUM',
        timestampMs: Date.now().toString(),
        organizationId: this.state.turnkeySubOrgId,
        signWith: walletID,
        unsignedTransaction,
      });

      return {
        success: true,
        signature: signResult.activity.result.signTransactionResult?.signedTransaction,
      };
    } catch (error: unknown) {
      const appError = toAppError(error, ErrorCode.WALLET_SIGNING_FAILED);
      console.error('Signing failed:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Signs a Solana transaction using the specified wallet address.
   *
   * @param unsignedTransaction - The unsigned Solana transaction (hex-encoded)
   * @param walletAddress - The wallet address to sign with
   * @returns Promise resolving to sign result with success status and signature or error
   *
   * @throws {AppError} If session is invalid, wallet not found, or signing fails
   */
  async signSolanaTransaction(
    unsignedTransaction: string, // hex-encoded
    walletAddress: string
  ): Promise<SignTransactionResult> {
    try {
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const session = await this.turnkey.getSession();
      if (!session?.organizationId) {
        throw createError(ErrorCode.AUTH_SESSION_EXPIRED);
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
        signature: signResult.activity.result.signTransactionResult?.signedTransaction,
      };
    } catch (error: unknown) {
      const appError = toAppError(error, ErrorCode.WALLET_SIGNING_FAILED);
      console.error('Solana signing failed:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Logs out the current user.
   * Clears the Turnkey session and resets the client state.
   *
   * @returns Promise resolving to true if logout was successful, false otherwise
   */
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

  /**
   * Creates a new Solana-only wallet.
   *
   * @returns Promise resolving to wallet creation result
   */
  async createSolanaWallet(): Promise<WalletCreationResult> {
    this.updateState({ isCreatingWallet: true });

    try {
      const result = await this.walletManager.createSolanaWallet();
      this.updateState({ isCreatingWallet: false });
      return result;
    } catch (error) {
      this.updateState({ isCreatingWallet: false });
      throw error;
    }
  }

  /**
   * Creates a new Ethereum-only wallet.
   *
   * @returns Promise resolving to wallet creation result
   */
  async createEthereumWallet(): Promise<WalletCreationResult> {
    this.updateState({ isCreatingWallet: true });

    try {
      const result = await this.walletManager.createEthereumWallet();
      this.updateState({ isCreatingWallet: false });
      return result;
    } catch (error) {
      this.updateState({ isCreatingWallet: false });
      throw error;
    }
  }

  /**
   * Gets the Turnkey IndexedDB client instance.
   * Used for direct access to Turnkey's IndexedDB operations.
   *
   * @returns Promise resolving to the IndexedDB client
   */
  public async getIndexedDbClient() {
    return await this.turnkey.indexedDbClient();
  }

  /**
   * Gets the current Turnkey session.
   *
   * @returns Promise resolving to the current session object, or null if no session exists
   */
  public async getSession() {
    return await this.turnkey.getSession();
  }

  /**
   * Creates an iframe client for wallet export.
   * The iframe handles secure display of private key material.
   *
   * @param iframeContainer - DOM element to mount the Turnkey export iframe into
   * @param iframeUrl - URL of the Turnkey export iframe (defaults to env or https://export.turnkey.com)
   * @returns Promise resolving to the iframe client instance
   */
  public async createExportIframeClient(
    iframeContainer: HTMLElement,
    iframeUrl?: string
  ) {
    const url =
      iframeUrl ||
      process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL ||
      'https://export.turnkey.com';

    return await this.turnkey.iframeClient({
      iframeContainer,
      iframeUrl: url,
    });
  }

  /**
   * Exports a wallet account's private key via Turnkey's secure iframe flow.
   * The private key is rendered inside the iframe and never exposed to the application.
   *
   * @param address - The wallet address to export
   * @param iframeContainer - DOM element to mount the export iframe into
   * @param iframeUrl - Optional custom export iframe URL
   * @returns Promise resolving to success status
   *
   * @throws {Error} If not logged in, session is invalid, or export fails
   */
  public async exportWalletAccount(
    address: string,
    iframeContainer: HTMLElement,
    keyFormat: KeyFormat = KeyFormat.Hexadecimal,
    iframeUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.isLoggedIn || !this.state.turnkeySubOrgId) {
        throw new Error('Not logged in');
      }

      // Create iframe client
      const iframeClient = await this.createExportIframeClient(
        iframeContainer,
        iframeUrl
      );

      // Get session
      const session = await this.turnkey.getSession();
      if (!session?.organizationId) {
        throw new Error('No valid session');
      }

      // Get indexedDb client
      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      // Export the wallet account
      const exportResponse = await indexedDbClient.exportWalletAccount({
        address,
        targetPublicKey: `${iframeClient?.iframePublicKey}`,
      });

      if (exportResponse?.exportBundle) {
        // Inject the export bundle into the iframe for secure display
        await iframeClient?.injectKeyExportBundle(
          exportResponse.exportBundle,
          session.organizationId,
          keyFormat
        );
        return { success: true };
      }

      return { success: false, error: 'No export bundle received' };
    } catch (error) {
      console.error('Export wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }
}

export const turnkeyClient = new TurnkeyClient(process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID);
