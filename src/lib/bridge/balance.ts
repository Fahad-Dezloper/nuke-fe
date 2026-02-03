/**
 * Balance Utility
 * Generic ERC20 token balance checking using viem
 * Supports multiple chains (Base, Arbitrum, etc.)
 */

import { createPublicClient, http, type Address, type Chain } from 'viem';
import { base, arbitrum } from 'viem/chains';
import { TOKEN_ADDRESSES, CHAIN_IDS } from './types';

/**
 * Chain configuration
 */
interface ChainConfig {
    chain: Chain;
    rpcUrl: string;
}

/**
 * Get RPC URL for a chain from environment or use default
 */
function getRpcUrl(chainId: number): string {
    switch (chainId) {
        case CHAIN_IDS.BASE:
            return (
                process.env.NEXT_PUBLIC_BASE_RPC_URL ||
                process.env.NEXT_PUBLIC_BASE_JSON_RPC_URL ||
                'https://base.drpc.org'
            );
        case CHAIN_IDS.ARBITRUM:
            return (
                process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ||
                process.env.NEXT_PUBLIC_ARBITRUM_JSON_RPC_URL ||
                'https://arb1.arbitrum.io/rpc'
            );
        default:
            throw new Error(`Unsupported chain ID: ${chainId}`);
    }
}

/**
 * Get chain configuration
 */
function getChainConfig(chainId: number): ChainConfig {
    let chain: Chain;
    switch (chainId) {
        case CHAIN_IDS.BASE:
            chain = base;
            break;
        case CHAIN_IDS.ARBITRUM:
            chain = arbitrum;
            break;
        default:
            throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const rpcUrl = getRpcUrl(chainId);

    return {
        chain,
        rpcUrl,
    };
}

/**
 * Create public client for a specific chain
 */
function createPublicClientForChain(chainId: number) {
    const { chain, rpcUrl } = getChainConfig(chainId);

    return createPublicClient({
        chain: {
            ...chain,
            rpcUrls: {
                default: {
                    http: [rpcUrl],
                },
            },
        },
        transport: http(rpcUrl),
    });
}

/**
 * ERC20 ABI for balanceOf function
 */
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

/**
 * Get ERC20 token balance on any chain
 * @param address - Wallet address to check balance for
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (8453 for Base, 42161 for Arbitrum)
 * @returns Balance in smallest unit
 */
export async function getTokenBalance(
    address: Address,
    tokenAddress: Address,
    chainId: number
): Promise<bigint> {
    try {
        const publicClient = createPublicClientForChain(chainId);

        const balance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
        });

        return balance as bigint;
    } catch (error) {
        const chainName = chainId === CHAIN_IDS.BASE ? 'Base' : 'Arbitrum';
        console.error(`Error getting token balance on ${chainName}:`, error);
        throw new Error(
            error instanceof Error
                ? error.message
                : `Failed to get token balance on ${chainName}`
        );
    }
}

/**
 * Get ERC20 token decimals on any chain
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (8453 for Base, 42161 for Arbitrum)
 * @returns Number of decimals
 */
export async function getTokenDecimals(
    tokenAddress: Address,
    chainId: number
): Promise<number> {
    try {
        const publicClient = createPublicClientForChain(chainId);

        const decimals = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'decimals',
        });

        return Number(decimals);
    } catch (error) {
        const chainName = chainId === CHAIN_IDS.BASE ? 'Base' : 'Arbitrum';
        console.error(`Error getting token decimals on ${chainName}:`, error);
        // Default to 6 for USDC if error
        return 6;
    }
}

/**
 * Format token balance for display
 * @param balance - Balance in smallest unit
 * @param decimals - Number of decimals (default: 6 for USDC)
 * @returns Formatted balance string
 */
export function formatTokenBalance(
    balance: bigint,
    decimals: number = 6
): string {
    const divisor = BigInt(10 ** decimals);
    const wholePart = balance / divisor;
    const fractionalPart = balance % divisor;

    // Use typeof to avoid ES2020 BigInt literal syntax for 0n
    if (fractionalPart === BigInt(0)) {
        return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    // Remove trailing zeros
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    return trimmedFractional
        ? `${wholePart}.${trimmedFractional}`
        : wholePart.toString();
}

// Convenience functions for Base USDC
/**
 * Get USDC balance on Base
 * @param address - Wallet address to check balance for
 * @returns Balance in smallest unit (6 decimals for USDC)
 */
export async function getUSDCBalanceOnBase(
    address: Address
): Promise<bigint> {
    return getTokenBalance(
        address,
        TOKEN_ADDRESSES.BASE_USDC as Address,
        CHAIN_IDS.BASE
    );
}

/**
 * Get USDC decimals on Base
 * @returns Number of decimals (6 for USDC)
 */
export async function getUSDCDecimalsOnBase(): Promise<number> {
    return getTokenDecimals(
        TOKEN_ADDRESSES.BASE_USDC as Address,
        CHAIN_IDS.BASE
    );
}

/**
 * Format USDC balance for display (Base)
 * @param balance - Balance in smallest unit
 * @param decimals - Number of decimals (default: 6 for USDC)
 * @returns Formatted balance string
 */
export function formatUSDCBalance(
    balance: bigint,
    decimals: number = 6
): string {
    return formatTokenBalance(balance, decimals);
}

// Convenience functions for Arbitrum USDC
/**
 * Get USDC balance on Arbitrum
 * @param address - Wallet address to check balance for
 * @returns Balance in smallest unit (6 decimals for USDC)
 */
export async function getUSDCBalanceOnArbitrum(
    address: Address
): Promise<bigint> {
    return getTokenBalance(
        address,
        TOKEN_ADDRESSES.ARBITRUM_USDC as Address,
        CHAIN_IDS.ARBITRUM
    );
}

/**
 * Get USDC decimals on Arbitrum
 * @returns Number of decimals (6 for USDC)
 */
export async function getUSDCDecimalsOnArbitrum(): Promise<number> {
    return getTokenDecimals(
        TOKEN_ADDRESSES.ARBITRUM_USDC as Address,
        CHAIN_IDS.ARBITRUM
    );
}

/**
 * Format USDC balance for display (Arbitrum)
 * @param balance - Balance in smallest unit
 * @param decimals - Number of decimals (default: 6 for USDC)
 * @returns Formatted balance string
 */
export function formatUSDCBalanceArbitrum(
    balance: bigint,
    decimals: number = 6
): string {
    return formatTokenBalance(balance, decimals);
}
