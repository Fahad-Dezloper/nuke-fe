/**
 * Balance API Client
 *
 * Client-side functions that fetch token balances via our API route
 * instead of directly hitting RPCs. Keeps RPC URLs server-side only.
 *
 * Drop-in replacements for:
 *  - getUSDCBalanceOnBase
 *  - getUSDCBalanceOnArbitrum
 *  - getTokenBalance / getTokenDecimals
 *  - getUSDCBalanceOnSolana
 */

import type { Address } from 'viem';

interface EvmBalanceResponse {
  balance: string;
  decimals: number;
  error?: string;
}

interface SolanaBalanceResponse {
  balance: string;
  error?: string;
}

async function fetchBalance(
  body: Record<string, unknown>
): Promise<EvmBalanceResponse | SolanaBalanceResponse> {
  const res = await fetch('/api/balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Balance API error (${res.status})`);
  }

  return data;
}

// ── EVM (Base / Arbitrum) ───────────────────────────────────────────

export async function getTokenBalance(
  address: Address,
  tokenAddress: Address,
  chainId: number
): Promise<bigint> {
  const chain = chainId === 8453 ? 'base' : 'arbitrum';
  const data = (await fetchBalance({
    chain,
    walletAddress: address,
    tokenAddress,
  })) as EvmBalanceResponse;

  return BigInt(data.balance);
}

export async function getTokenDecimals(
  tokenAddress: Address,
  chainId: number
): Promise<number> {
  const chain = chainId === 8453 ? 'base' : 'arbitrum';
  const data = (await fetchBalance({
    chain,
    walletAddress: '0x0000000000000000000000000000000000000000',
    tokenAddress,
  })) as EvmBalanceResponse;

  return data.decimals;
}

export async function getUSDCBalanceOnBase(address: Address): Promise<bigint> {
  const data = (await fetchBalance({
    chain: 'base',
    walletAddress: address,
  })) as EvmBalanceResponse;

  return BigInt(data.balance);
}

export async function getUSDCBalanceOnArbitrum(
  address: Address
): Promise<bigint> {
  const data = (await fetchBalance({
    chain: 'arbitrum',
    walletAddress: address,
  })) as EvmBalanceResponse;

  return BigInt(data.balance);
}

// ── Solana ──────────────────────────────────────────────────────────

export async function getUSDCBalanceOnSolana(
  walletAddress: string
): Promise<bigint> {
  const data = (await fetchBalance({
    chain: 'solana',
    walletAddress,
  })) as SolanaBalanceResponse;

  return BigInt(data.balance);
}
