/**
 * Backpack Deposit Handler
 *
 * Fund flow: Solana USDC (wallet) → Backpack perp collateral via backend-built
 * partially-signed Solana transaction (no bridge).
 */

import { backpackDepositService } from '@/lib/bridge/backpack-deposit.service';
import { signAndSubmitBackpackDeposit } from '../solana-utils';
import { CHAIN_IDS } from '../types';
import type { BridgeStep } from '../types';
import type {
  DepositHandler,
  RecipientContext,
  BridgeSignResult,
  DepositContext,
  DepositResult,
} from './deposit-handler.interface';

export class BackpackDepositHandler implements DepositHandler {
  readonly protocol = 'backpack';
  readonly destinationChainId = CHAIN_IDS.SOLANA;

  resolveRecipient(context: RecipientContext): string {
    if (!context.solanaRecipientAddress) {
      throw new Error(
        'No Solana wallet address found. Please ensure you have a Solana wallet connected.'
      );
    }
    return context.solanaRecipientAddress;
  }

  async signBridgeTransaction(
    _signatureStep: BridgeStep,
    _walletAddress: string,
    _organizationId: string
  ): Promise<BridgeSignResult> {
    throw new Error('Backpack margin funding does not use a bridge signature step');
  }

  async executeDeposit(context: DepositContext): Promise<DepositResult> {
    const { organizationId, bridgeRequestId, solanaRecipientAddress, depositAmountMicros } =
      context;

    if (!solanaRecipientAddress) {
      throw new Error(
        'No Solana wallet address found. Please ensure you have a Solana wallet connected.'
      );
    }

    if (!depositAmountMicros || depositAmountMicros <= BigInt(0)) {
      throw new Error('Deposit amount is required for Backpack funding');
    }

    const base64Tx = await backpackDepositService.getPartiallySignedTransaction(
      depositAmountMicros
    );

    const txSig = await signAndSubmitBackpackDeposit(
      base64Tx,
      solanaRecipientAddress,
      organizationId
    );

    return {
      txHash: txSig,
      protocol: this.protocol,
      bridgeRequestId,
    };
  }
}
