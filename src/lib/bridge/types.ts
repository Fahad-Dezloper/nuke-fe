/**
 * Bridge Types
 * Type definitions for bridge operations (Base to Arbitrum/Solana)
 */

/**
 * Chain IDs
 */
export const CHAIN_IDS = {
  BASE: 8453,
  ARBITRUM: 42161,
  SOLANA: 792703809,
} as const;

/**
 * Token addresses
 */
export const TOKEN_ADDRESSES = {
  BASE_USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ARBITRUM_USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  SOLANA_USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Base58 encoded Solana mint address
} as const;

/**
 * Quote Request
 */
export interface QuoteRequest {
  user: string; // User's EVM address (0x...)
  // originChainId: number; // 8453 for Base
  destinationChainId: number; // 42161 for Arbitrum
  // originCurrency: string; // Token address on Base
  // destinationCurrency: string; // Token address on Arbitrum
  amount: string; // Amount to bridge (in wei/smallest unit)
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
  usePermit?: boolean; // true to use permit-based approval
  recipient?: string; // Recipient address (defaults to user if not specified)
  // permitExpiry?: number; // Permit expiry in seconds (default: 600 = 10 min)
  // slippageTolerance?: string; // Slippage in basis points (e.g., "50" = 0.5%)
}

/**
 * Quote Response Step
 */
export interface BridgeStep {
  id: string; // "deposit", "approve", "authorize", etc.
  action: string; // User-facing action text
  description: string; // Description of the step
  kind: 'transaction' | 'signature'; // Type of step
  requestId: string; // Unique identifier for this request
  items: BridgeStepItem[]; // Array of items to execute
}

export interface BridgeStepItem {
  status: 'complete' | 'incomplete';
  data: any; // Transaction data or signature data
  check?: {
    endpoint: string;
    method: string;
  };
}

/**
 * Quote Response
 */
export interface QuoteResponse {
  steps: BridgeStep[];
  fees: {
    gas?: FeeInfo;
    relayer?: FeeInfo;
    relayerGas?: FeeInfo;
    relayerService?: FeeInfo;
    app?: FeeInfo;
    subsidized?: FeeInfo;
  };
  details: {
    operation: string;
    sender: string;
    recipient: string;
    currencyIn: CurrencyAmount;
    currencyOut: CurrencyAmount;
    [key: string]: any;
  };
  protocol?: {
    v2?: {
      orderId: string;
      orderData: any;
      paymentDetails: any;
    };
  };
}

export interface FeeInfo {
  amount: string;
  currency: string;
  [key: string]: any;
}

export interface CurrencyAmount {
  amount: string;
  currency: string;
  [key: string]: any;
}

/**
 * Permit Data (EIP-712)
 */
export interface PermitData {
  chain: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    types: {
      [key: string]: {
        name: string;
        type: string;
      }[];
    };
    value: {
      owner: string;
      spender: string;
      value: string;
      nonce: number;
      deadline: number;
      [key: string]: any;
    };
  }
}

/**
 * Execute Permit Request
 */
export interface ExecutePermitRequest {
  signature: string; // Hex-encoded signature (0x...) - 65 bytes (r + s + v)
  kind: string; // Permit kind/type: "PERMIT" or "PERMIT2" for Arbitrum, "eip3009" for Solana
  requestId: string; // The requestId from the signature step in quote response
  api: string; // API identifier: "relay" for Arbitrum, "swap" for Solana
}

/**
 * TransferWithAuthorization Data (EIP-3009) for Solana
 */
export interface TransferWithAuthorizationData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: {
    TransferWithAuthorization: Array<{ name: string; type: string }>;
    EIP712Domain?: Array<{ name: string; type: string }>;
  };
  primaryType: 'TransferWithAuthorization';
  value: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string; // bytes32 hex string
  };
}

/**
 * Execute Permit Response
 */
export interface ExecutePermitResponse {
  transactionHash?: string;
  status: string;
  [key: string]: any;
}

/**
 * Bridge Status
 */
export type BridgeStatus =
  | 'idle'
  | 'checking-balance'
  | 'getting-quote'
  | 'signing-permit'
  | 'executing-permit'
  | 'waiting-finality'
  | 'depositing'
  | 'success'
  | 'error';

/**
 * Relay Status Response
 */
export type RelayStatus =
  | 'waiting' // Waiting for deposit confirmation
  | 'pending' // Deposit confirmed, pending destination chain submission
  | 'submitted' // Destination transaction submitted
  | 'success' // Successful fill on destination
  | 'delayed' // Destination fill delayed, still processing
  | 'refunded' // Successfully refunded
  | 'failure'; // Unsuccessful fill

export interface RelayStatusResponse {
  status: RelayStatus;
  details?: string;
  inTxHashes?: string[]; // Incoming transaction hashes
  txHashes?: string[]; // Outgoing transaction hashes
  updatedAt?: number; // Last timestamp the data was updated
  originChainId?: number;
  destinationChainId?: number;
}

/**
 * Bridge Error
 */
export interface BridgeError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Deposit Request
 */
export interface DepositRequest {
  amount: string; // Amount in smallest unit (6 decimals for USDC) as string
  userAddress: string; // User's EVM address (0x...)
  permit: {
    v: number; // Recovery id (0 or 1, typically 27 or 28)
    r: Uint8Array; // 32-byte array (signature r component)
    s: Uint8Array; // 32-byte array (signature s component)
    deadline: number; // Deadline as string (U256 format)
  };
}

/**
 * Deposit Response
 */
export type DepositResponse = string; // Transaction hash

/**
 * Minimum deposit amount (10 USDC = 10,000,000 in smallest unit)
 */
export const MIN_DEPOSIT_AMOUNT = 10_000_000;
