/**
 * Turnkey Solana Message Signing for Pacifica
 * Signs messages using TurnkeySigner from @turnkey/solana
 */

import bs58 from 'bs58';
import { Buffer } from 'buffer';
import {
    ErrorCode,
    createError,
    toAppError,
} from '@/lib/errors';
import { TURNKEY_API_BASE_URL } from '@/lib/turnkey/constants';

/**
 * Signs a Solana message using TurnkeySigner from @turnkey/solana
 * 
 * For Pacifica API, we need to sign a message (compact JSON string) with Ed25519
 * and return a Base58-encoded signature.
 * 
 * This uses TurnkeySigner.signMessage() which directly signs the message bytes
 * without needing to create a transaction.
 */
export async function signPacificaMessageWithTurnkey(
    messageBytes: Uint8Array,
    walletAddress: string,
    organizationId: string
): Promise<string> {
    try {
        if (!walletAddress) {
            throw createError(ErrorCode.WALLET_ADDRESS_REQUIRED);
        }

        if (!organizationId) {
            throw createError(ErrorCode.AUTH_ORGANIZATION_NOT_FOUND);
        }

        // Ensure Buffer is available
        if (typeof window !== 'undefined' && !window.Buffer) {
            window.Buffer = Buffer;
        }

        // Import required libraries
        const { Turnkey } = await import('@turnkey/sdk-browser');
        const { TurnkeySigner } = await import('@turnkey/solana');

        let turnkey: InstanceType<typeof Turnkey>;
        let indexedDbClient: Awaited<ReturnType<typeof turnkey.indexedDbClient>>;
        let signer: InstanceType<typeof TurnkeySigner>;

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

        const session = await turnkey.getSession();
        if (!session?.organizationId) {
            throw createError(ErrorCode.AUTH_SESSION_EXPIRED);
        }

        try {
            // Create TurnkeySigner instance with the indexedDbClient
            signer = new TurnkeySigner({
                organizationId: session.organizationId,
                client: indexedDbClient,
            });
        } catch (error) {
            throw createError(
                ErrorCode.TURNKEY_SIGNER_CREATE_FAILED,
                { walletAddress, organizationId },
                toAppError(error)
            );
        }

        // Sign the message directly using TurnkeySigner.signMessage()
        // This returns a Uint8Array signature (64 bytes for Ed25519)
        let signature: Uint8Array;
        try {
            signature = await signer.signMessage(
                messageBytes,
                walletAddress,
                session.organizationId
            );
        } catch (error) {
            throw createError(
                ErrorCode.WALLET_SIGNING_FAILED,
                { walletAddress, reason: 'Failed to sign message with TurnkeySigner' },
                toAppError(error)
            );
        }

        if (!signature || signature.length === 0) {
            throw createError(ErrorCode.WALLET_SIGNING_FAILED, {
                walletAddress,
                reason: 'No signature received from TurnkeySigner',
            });
        }

        // Convert signature (Uint8Array) to Base58 string
        return bs58.encode(signature);
    } catch (error) {
        console.error('Error signing Pacifica message with Turnkey:', error);
        throw toAppError(error, ErrorCode.WALLET_SIGNING_FAILED);
    }
}
