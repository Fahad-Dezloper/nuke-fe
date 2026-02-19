/**
 * Pacifica Deposit Handler
 *
 * Fund Leg flow: Base → Solana → Pacifica
 *
 * Bridge: EIP-3009 TransferWithAuthorization signing, bridge to Solana via Relay
 * Deposit: Partially-signed Solana tx → user signs → submit to Solana
 */

import { signTransferWithAuthorizationWithTurnkey } from '../solana-signing';
import { pacificaDepositService } from '../pacifica-deposit.service';
import { getUSDCBalanceOnSolana } from '../balance-api';
import {
  formatUSDCBalanceSolana,
  signAndSubmitPacificaDeposit,
} from '../solana-utils';
import { CHAIN_IDS, MIN_DEPOSIT_AMOUNT, PACIFICA_GAS_REIMBURSEMENT } from '../types';
import type { BridgeStep, TransferWithAuthorizationData } from '../types';
import type {
  DepositHandler,
  RecipientContext,
  BridgeSignResult,
  DepositContext,
  DepositResult,
} from './deposit-handler.interface';

/**
 * Pacifica Deposit Handler
 *
 * Handles the complete fund-leg flow for Pacifica:
 * 1. Bridge: Base USDC → Solana USDC (EIP-3009 TransferWithAuthorization via Relay)
 * 2. Deposit: Solana USDC → Pacifica (partially-signed tx + user signature)
 */
export class PacificaDepositHandler implements DepositHandler {
  readonly protocol = 'pacifica';
  readonly destinationChainId = CHAIN_IDS.SOLANA;

  /**
   * Recipient for Pacifica bridge is the user's Solana address
   * (funds go to the Solana chain)
   */
  resolveRecipient(context: RecipientContext): string {
    if (!context.solanaRecipientAddress) {
      throw new Error(
        'No Solana wallet address found. Please ensure you have a Solana wallet connected.'
      );
    }
    return context.solanaRecipientAddress;
  }

  /**
   * Sign using EIP-3009 TransferWithAuthorization for Solana bridge
   */
  async signBridgeTransaction(
    signatureStep: BridgeStep,
    walletAddress: string,
    organizationId: string
  ): Promise<BridgeSignResult> {
    // Extract execute parameters from post.body in quote response
    const postBody = signatureStep.items[0]?.data?.post?.body;
    const executeKind = postBody?.kind || 'eip3009';
    const executeApi = postBody?.api || 'swap';

    // Extract EIP-3009 TransferWithAuthorization data (nested in data.sign)
    const signData = signatureStep.items[0]?.data?.sign as TransferWithAuthorizationData;
    if (!signData) {
      throw new Error('TransferWithAuthorization data not found in signature step');
    }

    // Sign with Turnkey
    const signature = await signTransferWithAuthorizationWithTurnkey(
      signData,
      walletAddress,
      organizationId
    );

    return { signature, executeKind, executeApi };
  }

  /**
   * Execute Pacifica deposit: Solana USDC → Pacifica
   *
   * Steps:
   * 1. Check USDC balance on Solana
   * 2. Get partially signed tx from backend
   * 3. Sign with user's wallet and submit to Solana
   */
  async executeDeposit(context: DepositContext): Promise<DepositResult> {
    const { organizationId, bridgeRequestId, solanaRecipientAddress } = context;

    if (!solanaRecipientAddress) {
      throw new Error(
        'No Solana wallet address found. Please ensure you have a Solana wallet connected.'
      );
    }

    // 1. Check Solana USDC balance
    const solanaBalance = await getUSDCBalanceOnSolana(solanaRecipientAddress);

    const minRequired = BigInt(MIN_DEPOSIT_AMOUNT) + BigInt(PACIFICA_GAS_REIMBURSEMENT);
    if (solanaBalance < minRequired) {
      throw new Error(
        `Insufficient balance for Pacifica deposit. Need at least ${formatUSDCBalanceSolana(minRequired)} USDC (including 0.2 USDC gas reimbursement), but balance is ${formatUSDCBalanceSolana(solanaBalance)} USDC`
      );
    }

    // 2. Get partially signed transaction from backend
    const partiallySignedTx = await pacificaDepositService.getPartiallySignedTransaction({
      user_address: solanaRecipientAddress,
      amount: solanaBalance.toString(),
    });

    // 3. Sign with user's wallet and submit to Solana
    const txSignature = await signAndSubmitPacificaDeposit(
      partiallySignedTx,
      solanaRecipientAddress,
      organizationId
    );

    return {
      txHash: txSignature,
      protocol: this.protocol,
      bridgeRequestId,
    };
  }
}
