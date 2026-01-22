/**
 * Wallet Manager
 * Handles wallet creation and management
 */

import { Turnkey } from '@turnkey/sdk-browser';
import type { Wallet, WalletCreationResult, TurnkeyState } from './types';
import {
  WALLET_NAMES,
  ADDRESS_FORMATS,
  CURVES,
  PATH_FORMATS,
  DERIVATION_PATHS,
} from './constants';

export class WalletManager {
  constructor(
    private turnkey: Turnkey,
    private getState: () => TurnkeyState,
    private updateWallets: (wallets: Wallet[]) => void
  ) {}

  /**
   * Create wallet with both EVM and Solana accounts
   */
  async createWallet(walletName: string): Promise<WalletCreationResult> {
    try {
      const state = this.getState();
      if (!state.isLoggedIn || !state.turnkeySubOrgId) {
        throw new Error('User not logged in');
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
            path: address.startsWith('0x')
              ? DERIVATION_PATHS.ETHEREUM
              : DERIVATION_PATHS.SOLANA,
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
      console.error('Create wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create Solana-only wallet
   */
  async createSolanaWallet(): Promise<WalletCreationResult> {
    try {
      const state = this.getState();
      if (!state.isLoggedIn || !state.turnkeySubOrgId) {
        throw new Error('User not logged in');
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
      console.error('Create Solana wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create Ethereum-only wallet
   */
  async createEthereumWallet(): Promise<WalletCreationResult> {
    try {
      const state = this.getState();
      if (!state.isLoggedIn || !state.turnkeySubOrgId) {
        throw new Error('User not logged in');
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
      console.error('Create Ethereum wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if user has required wallets (EVM + Solana)
   */
  hasRequiredWallets(wallets: Wallet[]): {
    hasEthereum: boolean;
    hasSolana: boolean;
  } {
    const hasEthereum = wallets.some((wallet) =>
      wallet.accounts?.some(
        (account) =>
          account.addressFormat === ADDRESS_FORMATS.ETHEREUM ||
          account.address?.startsWith('0x')
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
   * Ensure user has required wallets (EVM + Solana)
   */
  async ensureUserHasRequiredWallets(): Promise<void> {
    try {
      const wallets = this.getState().userWallets;

      if (wallets.length === 0) {
        console.log(
          'No wallets found, creating default wallet with both chains...'
        );
        const createResult = await this.createWallet(WALLET_NAMES.DEFAULT);
        if (createResult.success) {
          console.log('Default wallet created successfully');
        } else {
          console.error(
            'Failed to create default wallet:',
            createResult.error
          );
        }
        return;
      }

      const { hasEthereum, hasSolana } = this.hasRequiredWallets(wallets);

      // Create Solana wallet if missing
      if (!hasSolana) {
        console.log(
          'User does not have Solana wallet, creating Solana wallet...'
        );
        const createResult = await this.createSolanaWallet();
        if (createResult.success) {
          console.log('Solana wallet created successfully');
        } else {
          console.error('Failed to create Solana wallet:', createResult.error);
        }
      }

      // Create Ethereum wallet if missing
      if (!hasEthereum) {
        console.log(
          'User does not have Ethereum wallet, creating Ethereum wallet...'
        );
        const createResult = await this.createEthereumWallet();
        if (createResult.success) {
          console.log('Ethereum wallet created successfully');
        } else {
          console.error(
            'Failed to create Ethereum wallet:',
            createResult.error
          );
        }
      }
    } catch (error) {
      console.error('Error ensuring user has required wallets:', error);
    }
  }
}
