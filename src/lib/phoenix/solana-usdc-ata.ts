/**
 * Solana USDC ATA helpers for Phoenix deposits.
 * Rise `buildDepositIxs` creates the Phoenix canonical ATA but not the wallet USDC ATA
 * that Ember debits — new Turnkey wallets often lack one.
 */

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { TOKEN_ADDRESSES } from '@/lib/bridge/types';

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
  process.env.SOLANA_RPC_URL?.trim() ||
  'https://api.mainnet-beta.solana.com';

/** Minimum SOL to cover ATA rent + deposit tx fees on a fresh wallet. */
export const PHOENIX_DEPOSIT_MIN_SOL_LAMPORTS = 5_000_000; // 0.005 SOL

export async function getSolanaUsdcAtaAddress(walletAddress: string): Promise<PublicKey> {
  const wallet = new PublicKey(walletAddress);
  const usdcMint = new PublicKey(TOKEN_ADDRESSES.SOLANA_USDC);
  return getAssociatedTokenAddress(usdcMint, wallet);
}

export async function usdcAtaExists(walletAddress: string): Promise<boolean> {
  const { Connection } = await import('@solana/web3.js');
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const ata = await getSolanaUsdcAtaAddress(walletAddress);
  const info = await connection.getAccountInfo(ata);
  return info != null;
}

/**
 * Idempotent create for the wallet's USDC ATA (EPjF…).
 * Safe to prepend even when the account already exists.
 */
export async function buildUsdcAtaIdempotentIx(
  walletAddress: string,
  feePayerAddress?: string
): Promise<TransactionInstruction> {
  const wallet = new PublicKey(walletAddress);
  const payer = new PublicKey(feePayerAddress?.trim() || walletAddress);
  const usdcMint = new PublicKey(TOKEN_ADDRESSES.SOLANA_USDC);
  const ata = await getAssociatedTokenAddress(usdcMint, wallet);
  return createAssociatedTokenAccountIdempotentInstruction(payer, ata, wallet, usdcMint);
}

export async function getSolBalanceLamports(walletAddress: string): Promise<bigint> {
  const { Connection } = await import('@solana/web3.js');
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const lamports = await connection.getBalance(new PublicKey(walletAddress), 'confirmed');
  return BigInt(lamports);
}
