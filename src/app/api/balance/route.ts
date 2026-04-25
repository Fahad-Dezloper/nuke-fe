/**
 * Balance API Route
 *
 * Server-side balance checking for all chains (Base, Arbitrum, Ethereum, Solana).
 * Keeps RPC URLs private — clients never see them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Address, type Chain } from 'viem';
import { base, arbitrum, mainnet } from 'viem/chains';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { CHAIN_IDS, TOKEN_ADDRESSES } from '@/lib/bridge/types';

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

function getEvmRpcUrl(chainId: number): string {
  switch (chainId) {
    case CHAIN_IDS.BASE:
      return (
        process.env.BASE_RPC_URL ||
        process.env.NEXT_PUBLIC_BASE_RPC_URL ||
        process.env.NEXT_PUBLIC_BASE_JSON_RPC_URL ||
        'https://base.drpc.org'
      );
    case CHAIN_IDS.ARBITRUM:
      return (
        process.env.ARBITRUM_RPC_URL ||
        process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ||
        process.env.NEXT_PUBLIC_ARBITRUM_JSON_RPC_URL ||
        'https://arb1.arbitrum.io/rpc'
      );
    case CHAIN_IDS.ETHEREUM:
      return (
        process.env.ETHEREUM_RPC_URL ||
        process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ||
        'https://ethereum.publicnode.com'
      );
    default:
      throw new Error(`Unsupported EVM chain ID: ${chainId}`);
  }
}

function getSolanaRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    'https://api.mainnet-beta.solana.com'
  );
}

function getEvmChain(chainId: number): Chain {
  switch (chainId) {
    case CHAIN_IDS.BASE:
      return base;
    case CHAIN_IDS.ARBITRUM:
      return arbitrum;
    case CHAIN_IDS.ETHEREUM:
      return mainnet;
    default:
      throw new Error(`Unsupported EVM chain ID: ${chainId}`);
  }
}

async function getEvmTokenBalance(
  address: Address,
  tokenAddress: Address,
  chainId: number
): Promise<bigint> {
  const chain = getEvmChain(chainId);
  const rpcUrl = getEvmRpcUrl(chainId);

  const client = createPublicClient({
    chain: { ...chain, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  });

  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  return balance as bigint;
}

async function getEvmTokenDecimals(
  tokenAddress: Address,
  chainId: number
): Promise<number> {
  const chain = getEvmChain(chainId);
  const rpcUrl = getEvmRpcUrl(chainId);

  const client = createPublicClient({
    chain: { ...chain, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  });

  const decimals = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  return Number(decimals);
}

async function getSolanaUsdcBalance(walletAddress: string): Promise<bigint> {
  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  const walletPubkey = new PublicKey(walletAddress);
  const usdcMint = new PublicKey(TOKEN_ADDRESSES.SOLANA_USDC);

  const ataAddress = await getAssociatedTokenAddress(usdcMint, walletPubkey);
  const tokenAccountInfo = await connection.getTokenAccountBalance(ataAddress);

  if (!tokenAccountInfo.value) {
    return BigInt(0);
  }

  return BigInt(tokenAccountInfo.value.amount);
}

type BalanceRequest =
  | { chain: 'solana'; walletAddress: string }
  | { chain: 'base' | 'arbitrum' | 'ethereum'; walletAddress: string; tokenAddress?: string };

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (!text) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    let body: BalanceRequest;
    try {
      body = JSON.parse(text) as BalanceRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (!body.chain || !body.walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: chain, walletAddress' },
        { status: 400 }
      );
    }

    if (body.chain === 'solana') {
      try {
        const balance = await getSolanaUsdcBalance(body.walletAddress);
        return NextResponse.json({ balance: balance.toString() });
      } catch (error) {
        console.error('Error getting Solana USDC balance:', error);
        return NextResponse.json({ balance: '0' });
      }
    }

    const chainId =
      body.chain === 'base'
        ? CHAIN_IDS.BASE
        : body.chain === 'ethereum'
          ? CHAIN_IDS.ETHEREUM
          : CHAIN_IDS.ARBITRUM;
    const tokenAddress =
      (body.tokenAddress as Address) ??
      (body.chain === 'base'
        ? TOKEN_ADDRESSES.BASE_USDC
        : body.chain === 'ethereum'
          ? TOKEN_ADDRESSES.ETHEREUM_USDC
          : TOKEN_ADDRESSES.ARBITRUM_USDC);

    try {
      const [balance, decimals] = await Promise.all([
        getEvmTokenBalance(
          body.walletAddress as Address,
          tokenAddress as Address,
          chainId
        ),
        getEvmTokenDecimals(tokenAddress as Address, chainId),
      ]);

      return NextResponse.json({
        balance: balance.toString(),
        decimals,
      });
    } catch (error) {
      const chainName =
        body.chain === 'base' ? 'Base' : body.chain === 'ethereum' ? 'Ethereum' : 'Arbitrum';
      console.error(`Error getting token balance on ${chainName}:`, error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : `Failed to get token balance on ${chainName}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Balance API error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
