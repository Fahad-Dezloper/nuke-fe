import { Turnkey } from '@turnkey/sdk-browser';
import type { Wallet, WalletCreationResult, TurnkeyState } from './types';
import { WALLET_NAMES, ADDRESS_FORMATS, CURVES, PATH_FORMATS, DERIVATION_PATHS } from './constants';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';

/**
 * WalletManager handles wallet creation and management operations for Turnkey.
 * Provides methods to create wallets with different blockchain support (Ethereum, Solana, or both).
 */
export class WalletManager {
  /**
   * Creates a new WalletManager instance.
   *
   * @param turnkey - Turnkey SDK instance
   * @param getState - Function to get current Turnkey state
   * @param updateWallets - Function to update wallets in state
   */
  constructor(
    private turnkey: Turnkey,
    private getState: () => TurnkeyState,
    private updateWallets: (wallets: Wallet[]) => void
  ) {}

  /**
   * Creates a new wallet with both Ethereum and Solana account support.
   * The wallet will have accounts for both blockchain networks.
   *
   * @param walletName - Name for the new wallet
   * @returns Promise resolving to wallet creation result with success status and wallet data or error
   *
   * @throws {AppError} If user is not logged in or wallet creation fails
   *
   * @example
   * ```typescript
   * const result = await walletManager.createWallet('My Multi-Chain Wallet');
   * if (result.success) {
   *   console.log('Wallet created:', result.wallet);
   * }
   * ```
   */
  async createWallet(walletName: string): Promise<WalletCreationResult> {
    try {
      const state = this.getState();
      if (!state.isLoggedIn || !state.turnkeySubOrgId) {
        throw createError(ErrorCode.AUTH_NOT_LOGGED_IN);
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const createWalletResponse = await indexedDbClient.createWallet({
        organizationId: state.turnkeySubOrgId,
        walletName: walletName,
        accounts: [
          {
            addressFormat: ADDRESS_FORMATS.ETHEREUM,
            curve: CURVES.SECP256K1,
            path: DERIVATION_PATHS.ETHEREUM,
            pathFormat: PATH_FORMATS.BIP32,
          },
          {
            addressFormat: ADDRESS_FORMATS.SOLANA,
            curve: CURVES.ED25519,
            path: DERIVATION_PATHS.SOLANA,
            pathFormat: PATH_FORMATS.BIP32,
          },
        ],
      });

      const newWallet: Wallet = {
        walletId: createWalletResponse.walletId!,
        walletName: walletName,
        accounts: [
          ...createWalletResponse.addresses.map((address) => ({
            address: address,
            addressFormat: address.startsWith('0x')
              ? ADDRESS_FORMATS.ETHEREUM
              : ADDRESS_FORMATS.SOLANA,
            path: address.startsWith('0x') ? DERIVATION_PATHS.ETHEREUM : DERIVATION_PATHS.SOLANA,
            publicKey: state.publicKey!,
          })),
        ],
      };

      const currentWallets = this.getState().userWallets;
      this.updateWallets([...currentWallets, newWallet]);

      return {
        success: true,
        wallet: newWallet,
      };
    } catch (error: unknown) {
      const appError = toAppError(error, ErrorCode.WALLET_NOT_AVAILABLE);
      console.error('Create wallet error:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Creates a new wallet with only Solana account support.
   * The wallet will have a single Solana account using ED25519 curve.
   *
   * @returns Promise resolving to wallet creation result with success status and wallet data or error
   *
   * @throws {AppError} If user is not logged in or wallet creation fails
   *
   * @example
   * ```typescript
   * const result = await walletManager.createSolanaWallet();
   * if (result.success) {
   *   console.log('Solana wallet created:', result.wallet);
   * }
   * ```
   */
  async createSolanaWallet(): Promise<WalletCreationResult> {
    try {
      const state = this.getState();
      if (!state.isLoggedIn || !state.turnkeySubOrgId) {
        throw createError(ErrorCode.AUTH_NOT_LOGGED_IN);
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const createWalletResponse = await indexedDbClient.createWallet({
        organizationId: state.turnkeySubOrgId,
        walletName: WALLET_NAMES.SOLANA,
        accounts: [
          {
            addressFormat: ADDRESS_FORMATS.SOLANA,
            curve: CURVES.ED25519,
            path: DERIVATION_PATHS.SOLANA,
            pathFormat: PATH_FORMATS.BIP32,
          },
        ],
      });

      const newWallet: Wallet = {
        walletId: createWalletResponse.walletId!,
        walletName: WALLET_NAMES.SOLANA,
        accounts: createWalletResponse.addresses.map((address) => ({
          address: address,
          addressFormat: ADDRESS_FORMATS.SOLANA,
          path: DERIVATION_PATHS.SOLANA,
          publicKey: state.publicKey!,
        })),
      };

      const currentWallets = this.getState().userWallets;
      this.updateWallets([...currentWallets, newWallet]);

      return {
        success: true,
        wallet: newWallet,
      };
    } catch (error: unknown) {
      const appError = toAppError(error, ErrorCode.WALLET_NOT_AVAILABLE);
      console.error('Create Solana wallet error:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Creates a new wallet with only Ethereum account support.
   * The wallet will have a single Ethereum account using SECP256K1 curve.
   *
   * @returns Promise resolving to wallet creation result with success status and wallet data or error
   *
   * @throws {AppError} If user is not logged in or wallet creation fails
   *
   * @example
   * ```typescript
   * const result = await walletManager.createEthereumWallet();
   * if (result.success) {
   *   console.log('Ethereum wallet created:', result.wallet);
   * }
   * ```
   */
  async createEthereumWallet(): Promise<WalletCreationResult> {
    try {
      const state = this.getState();
      if (!state.isLoggedIn || !state.turnkeySubOrgId) {
        throw createError(ErrorCode.AUTH_NOT_LOGGED_IN);
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      const createWalletResponse = await indexedDbClient.createWallet({
        organizationId: state.turnkeySubOrgId,
        walletName: WALLET_NAMES.ETHEREUM,
        accounts: [
          {
            addressFormat: ADDRESS_FORMATS.ETHEREUM,
            curve: CURVES.SECP256K1,
            path: DERIVATION_PATHS.ETHEREUM,
            pathFormat: PATH_FORMATS.BIP32,
          },
        ],
      });

      const newWallet: Wallet = {
        walletId: createWalletResponse.walletId!,
        walletName: WALLET_NAMES.ETHEREUM,
        accounts: createWalletResponse.addresses.map((address) => ({
          address: address,
          addressFormat: ADDRESS_FORMATS.ETHEREUM,
          path: DERIVATION_PATHS.ETHEREUM,
          publicKey: state.publicKey!,
        })),
      };

      const currentWallets = this.getState().userWallets;
      this.updateWallets([...currentWallets, newWallet]);

      return {
        success: true,
        wallet: newWallet,
      };
    } catch (error: unknown) {
      const appError = toAppError(error, ErrorCode.WALLET_NOT_AVAILABLE);
      console.error('Create Ethereum wallet error:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }

  /**
   * Checks if the provided wallets include both Ethereum and Solana support.
   * Examines all wallets and their accounts to determine if both blockchain types are present.
   *
   * @param wallets - Array of wallets to check
   * @returns Object indicating whether Ethereum and Solana wallets are present:
   *   - hasEthereum: True if at least one Ethereum account exists
   *   - hasSolana: True if at least one Solana account exists
   *
   * @example
   * ```typescript
   * const { hasEthereum, hasSolana } = walletManager.hasRequiredWallets(wallets);
   * if (!hasEthereum) {
   *   await walletManager.createEthereumWallet();
   * }
   * ```
   */
  hasRequiredWallets(wallets: Wallet[]): {
    hasEthereum: boolean;
    hasSolana: boolean;
  } {
    const hasEthereum = wallets.some((wallet) =>
      wallet.accounts?.some(
        (account) =>
          account.addressFormat === ADDRESS_FORMATS.ETHEREUM || account.address?.startsWith('0x')
      )
    );

    const hasSolana = wallets.some((wallet) =>
      wallet.accounts?.some(
        (account) =>
          (account.addressFormat === ADDRESS_FORMATS.SOLANA &&
            wallet.walletName !== 'Solana Memes Wallet') ||
          (account.address &&
            !account.address.startsWith('0x') &&
            account.address.length > 40 &&
            wallet.walletName !== 'Solana Memes Wallet')
      )
    );

    return { hasEthereum, hasSolana };
  }

  /**
   * Ensures the user has wallets for both Ethereum and Solana blockchains.
   * If no wallets exist, creates a default multi-chain wallet.
   * If wallets exist but are missing Ethereum or Solana support, creates the missing wallet type.
   * This method is typically called after user login to ensure proper wallet setup.
   *
   * @returns Promise that resolves when wallet verification/creation is complete
   *
   * @example
   * ```typescript
   * await walletManager.ensureUserHasRequiredWallets();
   * // User now has both Ethereum and Solana wallets
   * ```
   */
  async ensureUserHasRequiredWallets(): Promise<void> {
    try {
      const wallets = this.getState().userWallets;

      if (wallets.length === 0) {
        console.log('No wallets found, creating default wallet with both chains...');
        const createResult = await this.createWallet(WALLET_NAMES.DEFAULT);
        if (createResult.success) {
          console.log('Default wallet created successfully');
        } else {
          console.error('Failed to create default wallet:', createResult.error);
        }
        return;
      }

      const { hasEthereum, hasSolana } = this.hasRequiredWallets(wallets);

      // Create Solana wallet if missing
      if (!hasSolana) {
        console.log('User does not have Solana wallet, creating Solana wallet...');
        const createResult = await this.createSolanaWallet();
        if (createResult.success) {
          console.log('Solana wallet created successfully');
        } else {
          console.error('Failed to create Solana wallet:', createResult.error);
        }
      }

      if (!hasEthereum) {
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
}
