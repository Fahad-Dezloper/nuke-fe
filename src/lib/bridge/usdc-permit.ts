/**
 * USDC Permit Utility
 * Handles EIP-2612 permit signing for USDC on Arbitrum using Turnkey
 */

import { createPublicClient, http, type Address } from 'viem';
import { arbitrum, mainnet } from 'viem/chains';
import { TURNKEY_API_BASE_URL } from '@/lib/turnkey/constants';
import { ErrorCode, createError, toAppError } from '@/lib/errors';
import { TOKEN_ADDRESSES, CHAIN_IDS } from './types';

/**
 * USDC Permit Data Structure (EIP-2612)
 */
export interface UsdcPermitData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: {
    Permit: Array<{ name: string; type: string }>;
    EIP712Domain: Array<{ name: string; type: string }>;
  };
  primaryType: string;
  message: {
    owner: string;
    spender: string;
    value: string;
    nonce: number;
    deadline: number;
  };
}

/**
 * Permit Result
 */
export interface PermitResult {
  success: boolean;
  typedData?: UsdcPermitData;
  deadline?: string;
  error?: string;
}

/**
 * Permit Signature Components
 */
export interface PermitSignatureComponents {
  v: number;
  r: Uint8Array;
  s: Uint8Array;
  deadline: number;
}

/**
 * Permit Signature Result
 */
export interface PermitSignatureResult {
  success: boolean;
  signature?: PermitSignatureComponents;
  error?: string;
}

/**
 * Get Arbitrum RPC URL from environment or use default
 */
function getArbitrumRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ||
    process.env.NEXT_PUBLIC_ARBITRUM_JSON_RPC_URL ||
    'https://arb1.arbitrum.io/rpc'
  );
}

/**
 * Create Arbitrum public client
 */
function createArbitrumPublicClient() {
  const rpcUrl = getArbitrumRpcUrl();

  return createPublicClient({
    chain: {
      ...arbitrum,
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
 * Get user's USDC nonce from Arbitrum contract
 * @param userAddress - User's wallet address
 * @returns User's current nonce
 */
function getEthereumRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ||
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    'https://ethereum.publicnode.com'
  );
}

function createEthereumMainnetPublicClient() {
  const rpcUrl = getEthereumRpcUrl();
  return createPublicClient({
    chain: {
      ...mainnet,
      rpcUrls: {
        default: {
          http: [rpcUrl],
        },
      },
    },
    transport: http(rpcUrl),
  });
}

/** USDC `nonces(owner)` on Ethereum mainnet (for `POST /lighter/deposit` permits). */
export async function getEthereumMainnetUsdcNonce(userAddress: string): Promise<number> {
  try {
    const client = createEthereumMainnetPublicClient();
    const nonce = await client.readContract({
      address: TOKEN_ADDRESSES.ETHEREUM_USDC as Address,
      abi: [
        {
          name: 'nonces',
          type: 'function',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: 'nonce', type: 'uint256' }],
          stateMutability: 'view',
        },
      ],
      functionName: 'nonces',
      args: [userAddress as `0x${string}`],
    });
    return Number(nonce);
  } catch (error) {
    console.error('Error getting Ethereum mainnet USDC nonce:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get USDC nonce on Ethereum');
  }
}

/**
 * EIP-2612 permit typed data for **native USDC on Ethereum mainnet** (Lighter `POST /lighter/deposit`).
 * @see LIGHTER_DEPOSIT_FE_INTEGRATION.md
 */
export async function createEthereumMainnetUsdcPermit(
  amount: string,
  userAddress: string,
  spenderAddress: string,
  deadlineMinutes: number = 30
): Promise<PermitResult> {
  try {
    if (!userAddress) throw new Error('User address is required');
    if (!spenderAddress) throw new Error('Spender address is required');

    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000)).toString();
    const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;
    const nonce = await getEthereumMainnetUsdcNonce(userAddress);

    const permitData: UsdcPermitData = {
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: CHAIN_IDS.ETHEREUM,
        verifyingContract: TOKEN_ADDRESSES.ETHEREUM_USDC as `0x${string}`,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: userAddress,
        spender: spenderAddress,
        value: amountInSmallestUnit,
        nonce,
        deadline,
      },
    };

    return {
      success: true,
      typedData: permitData,
      deadline: deadline.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error creating Ethereum mainnet USDC permit:', error);
    return { success: false, error: errorMessage };
  }
}

export async function getUsdcNonce(userAddress: string): Promise<number> {
  try {
    const client = createArbitrumPublicClient();

    const nonce = await client.readContract({
      address: TOKEN_ADDRESSES.ARBITRUM_USDC as Address,
      abi: [
        {
          name: 'nonces',
          type: 'function',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: 'nonce', type: 'uint256' }],
          stateMutability: 'view',
        },
      ],
      functionName: 'nonces',
      args: [userAddress as `0x${string}`],
    });

    return Number(nonce);
  } catch (error) {
    console.error('Error getting USDC nonce:', error);
    // Fallback to timestamp if contract call fails (shouldn't happen in production)
    throw new Error(error instanceof Error ? error.message : 'Failed to get USDC nonce');
  }
}

/**
 * Create USDC permit data structure
 * @param amount - Amount in USDC (will be converted to smallest unit)
 * @param userAddress - User's wallet address
 * @param feePayerAddress - Fee payer/spender address (Hyperliquid deposit contract)
 * @param deadlineMinutes - Deadline in minutes from now (default: 30)
 * @returns Permit data structure
 */
export async function createUsdcPermit(
  amount: string,
  userAddress: string,
  spenderAddress: string,
  deadlineMinutes: number = 30
): Promise<PermitResult> {
  try {
    if (!userAddress) {
      throw new Error('User address is required');
    }

    if (!spenderAddress) {
      throw new Error('Spender address is required');
    }

    // Convert amount to smallest unit (USDC has 6 decimals)
    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000)).toString();

    // Get deadline (30 minutes from now by default)
    const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

    // Get user's nonce
    const nonce = await getUsdcNonce(userAddress);

    // Create permit data structure
    const permitData: UsdcPermitData = {
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: CHAIN_IDS.ARBITRUM,
        verifyingContract: TOKEN_ADDRESSES.ARBITRUM_USDC as `0x${string}`,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: userAddress,
        spender: spenderAddress,
        value: amountInSmallestUnit,
        nonce: nonce,
        deadline: deadline,
      },
    };

    return {
      success: true,
      typedData: permitData,
      deadline: deadline.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error creating USDC permit:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sign USDC permit with Turnkey
 * @param permitData - EIP-2612 permit data structure
 * @param walletAddress - Turnkey wallet address to sign with
 * @param organizationId - Turnkey organization ID
 * @returns Signature components (v, r, s) and deadline
 */
export async function signUsdcPermit(
  permitData: UsdcPermitData,
  walletAddress: string,
  organizationId: string
): Promise<PermitSignatureResult> {
  try {

    if (!walletAddress) {
      throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
    }

    if (!organizationId) {
      throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
    }

    // Import Turnkey and TurnkeySigner dynamically
    const { Turnkey } = await import('@turnkey/sdk-browser');
    const { TurnkeySigner } = await import('@turnkey/ethers');

    let turnkey: InstanceType<typeof Turnkey>;
    let indexedDbClient: Awaited<ReturnType<typeof turnkey.indexedDbClient>>;
    let signer: InstanceType<typeof TurnkeySigner>;

    // Initialize Turnkey client
    try {
      turnkey = new Turnkey({
        apiBaseUrl: TURNKEY_API_BASE_URL,
        defaultOrganizationId: organizationId,
      });

      indexedDbClient = await turnkey.indexedDbClient();
      await indexedDbClient.init();
    } catch (error) {
      throw createError(
        ErrorCode.TURNKEY_CLIENT_INIT_FAILED,
        { organizationId },
        toAppError(error)
      );
    }

    // Create TurnkeySigner
    try {
      signer = new TurnkeySigner({
        client: indexedDbClient,
        organizationId: organizationId,
        signWith: walletAddress,
      });
    } catch (error) {
      throw createError(
        ErrorCode.TURNKEY_SIGNER_CREATE_FAILED,
        { walletAddress, organizationId },
        toAppError(error)
      );
    }

    // Sign the EIP-712 typed data
    // Remove EIP712Domain from types as ethers handles it internally via the domain param
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { EIP712Domain: _, ...typesWithoutDomain } = permitData.types;

    let signature: string;
    try {
      signature = await signer.signTypedData(
        permitData.domain,
        typesWithoutDomain,
        permitData.message
      );
    } catch (error) {
      throw createError(ErrorCode.TURNKEY_SIGNATURE_FAILED, { walletAddress }, toAppError(error));
    }

    // Ensure signature is in the correct format (0x + 130 hex chars)
    if (!signature.startsWith('0x')) {
      signature = `0x${signature}`;
    }

    // Verify signature length (should be 65 bytes = 130 hex chars + 0x)
    if (signature.length !== 132) {
      throw new Error(
        `Invalid signature length: ${signature.length}. Expected 132 characters (0x + 130 hex)`
      );
    }

    // Parse signature into v, r, s components
    // Signature format: 0x + r (32 bytes = 64 hex chars) + s (32 bytes = 64 hex chars) + v (1 byte = 2 hex chars)
    const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
    const rHex = sig.slice(0, 64);
    const sHex = sig.slice(64, 128);
    const vHex = sig.slice(128, 130);
    const v = parseInt(vHex, 16);

    // Convert r and s hex strings to Uint8Array (32 bytes each)
    // Each pair of hex chars represents one byte
    const rBytes = new Uint8Array(rHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
    const sBytes = new Uint8Array(sHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);

    // Ensure r and s are 32 bytes
    if (rBytes.length !== 32 || sBytes.length !== 32) {
      throw new Error('Invalid signature format: r or s is not 32 bytes');
    }

    return {
      success: true,
      signature: {
        v: v,
        r: rBytes,
        s: sBytes,
        deadline: permitData.message.deadline,
      },
    };
  } catch (error) {
    console.error('Error signing USDC permit with Turnkey:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
