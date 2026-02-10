import type { Wallet } from './types';
import { ADDRESS_FORMATS } from './constants';

/**
 * Extracts the first EVM (Ethereum) address from an array of user wallets.
 * Searches through all wallets and their accounts to find an address that matches
 * the Ethereum address format (starts with '0x' or has ADDRESS_FORMAT_ETHEREUM format).
 *
 * @param wallets - Array of user wallets to search through
 * @returns The first EVM address found, or undefined if no EVM address exists
 *
 * @example
 * ```typescript
 * const wallets = [/* wallet objects *\/];
 * const evmAddress = getEVMAddress(wallets);
 * if (evmAddress) {
 *   console.log('EVM address:', evmAddress);
 * }
 * ```
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
        account.addressFormat === ADDRESS_FORMATS.ETHEREUM || account.address?.startsWith('0x')
    );

    if (evmAccount?.address) {
      return evmAccount.address;
    }
  }

  return undefined;
}

/**
 * Extracts the first Solana address from an array of user wallets.
 * Searches through all wallets and their accounts to find an address that matches
 * the Solana address format (ADDRESS_FORMAT_SOLANA or non-hex address longer than 40 chars).
 *
 * @param wallets - Array of user wallets to search through
 * @returns The first Solana address found, or undefined if no Solana address exists
 *
 * @example
 * ```typescript
 * const wallets = [/* wallet objects *\/];
 * const solanaAddress = getSolanaAddress(wallets);
 * if (solanaAddress) {
 *   console.log('Solana address:', solanaAddress);
 * }
 * ```
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
        (account.address && !account.address.startsWith('0x') && account.address.length > 40)
    );

    if (solanaAccount?.address) {
      return solanaAccount.address;
    }
  }

  return undefined;
}
