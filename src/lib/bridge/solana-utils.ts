/**
 * Solana Utilities for Pacifica Deposit
 * Handles Solana-specific operations: balance checking, transaction signing, submission
 */

import { TOKEN_ADDRESSES } from './types';

// Solana RPC endpoint (mainnet-beta) — loaded from env to avoid leaking API keys
const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  (() => {
    console.error('[solana-utils] NEXT_PUBLIC_SOLANA_RPC_URL is not set');
    return 'https://api.mainnet-beta.solana.com'; // public fallback (rate-limited)
  })();

/**
 * Get USDC balance on Solana for a given wallet address
 * @param walletAddress - Solana wallet address (base58)
 * @returns Balance in smallest unit (6 decimals)
 */
export async function getUSDCBalanceOnSolana(walletAddress: string): Promise<bigint> {
    try {
        // Dynamically import @solana/web3.js
        const { Connection, PublicKey } = await import('@solana/web3.js');

        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const walletPubkey = new PublicKey(walletAddress);
        const usdcMint = new PublicKey(TOKEN_ADDRESSES.SOLANA_USDC);

        // Get associated token account address
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        const ataAddress = await getAssociatedTokenAddress(usdcMint, walletPubkey);

        // Get token account balance
        const tokenAccountInfo = await connection.getTokenAccountBalance(ataAddress);

        if (!tokenAccountInfo.value) {
            return BigInt(0);
        }

        return BigInt(tokenAccountInfo.value.amount);
    } catch (error) {
        console.error('Error getting USDC balance on Solana:', error);
        // Return 0 if account doesn't exist or error occurs
        return BigInt(0);
    }
}

/**
 * Format Solana USDC balance to human readable string
 * @param balance - Balance in smallest unit (6 decimals)
 * @returns Formatted balance string (e.g., "100.50")
 */
export function formatUSDCBalanceSolana(balance: bigint): string {
    const decimals = 6;
    const divisor = BigInt(10 ** decimals);
    const wholePart = balance / divisor;
    const fractionalPart = balance % divisor;

    // Pad fractional part with leading zeros
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

    // Remove trailing zeros but keep at least 2 decimal places
    const trimmedFractional = fractionalStr.replace(/0+$/, '').padEnd(2, '0');

    return `${wholePart}.${trimmedFractional}`;
}

/**
 * Deserialize a Base64 encoded Solana transaction (bincode serialized)
 * @param base64Transaction - Base64 encoded transaction from BE
 * @returns Deserialized Transaction object
 */
export async function deserializeSolanaTransaction(base64Transaction: string): Promise<{
    transaction: InstanceType<typeof import('@solana/web3.js').Transaction>;
    serializedMessage: Uint8Array;
}> {
    const { Transaction } = await import('@solana/web3.js');

    // Decode Base64 to Uint8Array
    const binaryString = atob(base64Transaction);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Deserialize the transaction
    // Note: BE uses bincode::serialize which is compatible with Transaction.from()
    const transaction = Transaction.from(bytes);

    // Get the serialized message for signing
    const serializedMessage = transaction.serializeMessage();

    return { transaction, serializedMessage };
}

/**
 * Add a signature to a partially signed transaction
 * @param transaction - The transaction object
 * @param signature - The signature bytes (64 bytes for Ed25519)
 * @param publicKey - The public key that signed
 */
export async function addSignatureToTransaction(
    transaction: InstanceType<typeof import('@solana/web3.js').Transaction>,
    signature: Uint8Array,
    publicKeyBase58: string
): Promise<void> {
    const { PublicKey } = await import('@solana/web3.js');

    const publicKey = new PublicKey(publicKeyBase58);
    transaction.addSignature(publicKey, Buffer.from(signature));
}

/**
 * Submit a fully signed transaction to Solana
 * @param transaction - The fully signed transaction
 * @returns Transaction signature (txHash)
 */
export async function submitSolanaTransaction(
    transaction: InstanceType<typeof import('@solana/web3.js').Transaction>
): Promise<string> {
    const { Connection } = await import('@solana/web3.js');

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Serialize the transaction
    const rawTransaction = transaction.serialize();

    // Send the transaction
    const txSignature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');

    if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return txSignature;
}

/**
 * Sign a Solana transaction message using Turnkey
 * @param serializedMessage - The serialized message to sign
 * @param walletAddress - Solana wallet address
 * @param organizationId - Turnkey organization ID
 * @returns Signature as Uint8Array (64 bytes)
 */
export async function signSolanaMessageWithTurnkey(
    serializedMessage: Uint8Array,
    walletAddress: string,
    organizationId: string
): Promise<Uint8Array> {
    const { Buffer } = await import('buffer');
    const { Turnkey } = await import('@turnkey/sdk-browser');
    const { TurnkeySigner } = await import('@turnkey/solana');

    // Ensure Buffer is available globally
    if (typeof window !== 'undefined' && !window.Buffer) {
        window.Buffer = Buffer;
    }

    const TURNKEY_API_BASE_URL = 'https://api.turnkey.com';

    const turnkey = new Turnkey({
        apiBaseUrl: TURNKEY_API_BASE_URL,
        defaultOrganizationId: organizationId,
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const session = await turnkey.getSession();
    if (!session?.organizationId) {
        throw new Error('Turnkey session expired');
    }

    const signer = new TurnkeySigner({
        organizationId: session.organizationId,
        client: indexedDbClient,
    });

    // Sign the message
    const signature = await signer.signMessage(
        serializedMessage,
        walletAddress,
        session.organizationId
    );

    return signature;
}

/**
 * Complete flow: Deserialize, co-sign with user, and submit Backpack deposit transaction.
 *
 * Backend returns a legacy Solana transaction (base64) that is already partially signed
 * by the server fee payer. The client adds the user's signature and submits.
 */
export async function signAndSubmitBackpackDeposit(
  base64Transaction: string,
  userWalletAddress: string,
  organizationId: string
): Promise<string> {
  const { transaction, serializedMessage } = await deserializeSolanaTransaction(base64Transaction);

  const userSignature = await signSolanaMessageWithTurnkey(
    serializedMessage,
    userWalletAddress,
    organizationId
  );

  await addSignatureToTransaction(transaction, userSignature, userWalletAddress);
  return submitSolanaTransaction(transaction);
}

/**
 * Complete flow: Deserialize, sign with user, and submit transaction
 * @param base64Transaction - Base64 encoded partially signed transaction from BE
 * @param userWalletAddress - User's Solana wallet address
 * @param organizationId - Turnkey organization ID
 * @returns Transaction signature (txHash)
 */
export async function signAndSubmitPacificaDeposit(
    base64Transaction: string,
    userWalletAddress: string,
    organizationId: string
): Promise<string> {
    // 1. Deserialize the transaction
    const { transaction, serializedMessage } = await deserializeSolanaTransaction(base64Transaction);

    // 2. Sign with user's wallet via Turnkey
    const userSignature = await signSolanaMessageWithTurnkey(
        serializedMessage,
        userWalletAddress,
        organizationId
    );

    // 3. Add user's signature to the transaction
    await addSignatureToTransaction(transaction, userSignature, userWalletAddress);

    // 4. Submit the fully signed transaction
    const txSignature = await submitSolanaTransaction(transaction);

    return txSignature;
}
