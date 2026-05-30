/**
 * Solana Bridge Signing Utility
 * Handles EIP-3009 TransferWithAuthorization signing for Solana bridge using Turnkey
 */

import { TURNKEY_API_BASE_URL } from '@/lib/turnkey/constants';
import { ErrorCode, createError, toAppError } from '@/lib/errors';
import type { TransferWithAuthorizationData } from './types';

/**
 * Sign EIP-3009 TransferWithAuthorization data with Turnkey
 * @param signData - EIP-3009 formatted TransferWithAuthorization data
 * @param walletAddress - Wallet address to sign with
 * @param organizationId - Turnkey organization ID
 * @returns Hex-encoded signature (0x + 130 hex chars)
 */
export async function signTransferWithAuthorizationWithTurnkey(
  signData: TransferWithAuthorizationData,
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
        client: indexedDbClient as any,
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

    // Ensure chainId is set correctly (Base = 8453)
    const domain = {
      ...signData.domain,
      chainId: signData.domain.chainId || 8453,
    };

    // Build types with EIP712Domain if not present
    const types = {
      TransferWithAuthorization: signData.types.TransferWithAuthorization,
      // EIP712Domain: signData.types.EIP712Domain || [
      //   { name: 'name', type: 'string' },
      //   { name: 'version', type: 'string' },
      //   { name: 'chainId', type: 'uint256' },
      //   { name: 'verifyingContract', type: 'address' },
      // ],
    };

    // Sign the EIP-712 typed data
    // Note: For EIP-3009, we use 'value' field as the message, not 'message'
    let signature: string;
    try {
      signature = await signer.signTypedData(
        domain,
        types,
        signData.value // Use 'value' field for EIP-3009
      );
    } catch (error) {
      throw createError(ErrorCode.TURNKEY_SIGNATURE_FAILED, { walletAddress }, toAppError(error));
    }

    // Ensure signature is in the correct format (0x + 130 hex chars)
    if (!signature.startsWith('0x')) {
      return `0x${signature}`;
    }

    // Verify signature length (should be 65 bytes = 130 hex chars + 0x)
    if (signature.length !== 132) {
      throw new Error(
        `Invalid signature length: ${signature.length}. Expected 132 characters (0x + 130 hex)`
      );
    }

    return signature;
  } catch (error) {
    console.error('Error signing TransferWithAuthorization with Turnkey:', error);
    throw toAppError(error, ErrorCode.TURNKEY_SIGNATURE_FAILED);
  }
}
