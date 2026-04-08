import { Buffer } from 'buffer';
import { ErrorCode, createError, toAppError } from '@/lib/errors';
import { TURNKEY_API_BASE_URL } from '@/lib/turnkey/constants';
import { ensureBuffer, uint8ArrayToBase64 } from './base64';

/**
 * Signs bytes with the user's Turnkey Solana wallet (ed25519) and returns a Base64 signature,
 * as required by Backpack (`X-Signature`).
 */
export async function signBackpackMessageWithTurnkey(
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

    // Ensure Buffer is available (needed for base64 + Turnkey libs in browser)
    ensureBuffer();
    if (typeof window !== 'undefined' && !(window as unknown as { Buffer?: typeof Buffer }).Buffer) {
      (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
    }

    const { Turnkey } = await import('@turnkey/sdk-browser');
    const { TurnkeySigner } = await import('@turnkey/solana');

    const turnkey = new Turnkey({
      apiBaseUrl: TURNKEY_API_BASE_URL,
      defaultOrganizationId: organizationId,
    });

    const indexedDbClient = await turnkey.indexedDbClient();
    await indexedDbClient.init();

    const session = await turnkey.getSession();
    if (!session?.organizationId) {
      throw createError(ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const signer = new TurnkeySigner({
      organizationId: session.organizationId,
      client: indexedDbClient,
    });

    const signatureBytes = await signer.signMessage(
      messageBytes,
      walletAddress,
      session.organizationId
    );

    if (!signatureBytes || signatureBytes.length === 0) {
      throw createError(ErrorCode.WALLET_SIGNING_FAILED, {
        walletAddress,
        reason: 'No signature received from TurnkeySigner',
      });
    }

    return uint8ArrayToBase64(signatureBytes);
  } catch (error) {
    console.error('Error signing Backpack message with Turnkey:', error);
    throw toAppError(error, ErrorCode.WALLET_SIGNING_FAILED);
  }
}

