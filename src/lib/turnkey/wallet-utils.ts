/**
 * Wallet Utilities
 * Helper functions for extracting wallet addresses
 */

import type { Wallet } from './types';
import { ADDRESS_FORMATS } from './constants';

/**
 * Get the first EVM (Ethereum) address from user wallets
 * @param wallets - Array of user wallets
 * @returns EVM address string or undefined if not found
 */
export function getEVMAddress(wallets: Wallet[]): string | undefined {
    if (!wallets || wallets.length === 0) {
        return undefined;
    }

    for (const wallet of wallets) {
        if (!wallet.accounts || wallet.accounts.length === 0) {
            continue;
        }

        // Look for Ethereum address format
        const evmAccount = wallet.accounts.find(
            (account) =>
                account.addressFormat === ADDRESS_FORMATS.ETHEREUM ||
                account.address?.startsWith('0x')
        );

        if (evmAccount?.address) {
            return evmAccount.address;
        }
    }

    return undefined;
}

/**
 * Get the first Solana address from user wallets
 * @param wallets - Array of user wallets
 * @returns Solana address string or undefined if not found
 */
export function getSolanaAddress(wallets: Wallet[]): string | undefined {
    if (!wallets || wallets.length === 0) {
        return undefined;
    }

    for (const wallet of wallets) {
        if (!wallet.accounts || wallet.accounts.length === 0) {
            continue;
        }

        // Look for Solana address format
        const solanaAccount = wallet.accounts.find(
            (account) =>
                account.addressFormat === ADDRESS_FORMATS.SOLANA ||
                (account.address &&
                    !account.address.startsWith('0x') &&
                    account.address.length > 40)
        );

        if (solanaAccount?.address) {
            return solanaAccount.address;
        }
    }

    return undefined;
}
