/**
 * Hyperliquid Deposit Handler
 *
 * Fund Leg flow: Base → Arbitrum → Hyperliquid
 *
 * Bridge: EIP-2612 Permit signing, bridge to Arbitrum via Relay
 * Deposit: USDC permit on Arbitrum → Hyperliquid deposit API
 */

import { signPermitWithTurnkey } from '../signing';
import { depositService } from '../deposit.service';
import {
  getUSDCBalanceOnArbitrum,
  formatUSDCBalanceArbitrum,
} from '../balance';
import { createUsdcPermit, signUsdcPermit } from '../usdc-permit';
import { CHAIN_IDS, MIN_DEPOSIT_AMOUNT } from '../types';
import type { BridgeStep, PermitData } from '../types';
import { HYPERLIQUID_ROUTER_CONTRACT } from '@/constants';
import type {
  DepositHandler,
  RecipientContext,
  BridgeSignResult,
  DepositContext,
  DepositResult,
} from './deposit-handler.interface';

/**
 * Hyperliquid Deposit Handler
 *
 * Handles the complete fund-leg flow for Hyperliquid:
 * 1. Bridge: Base USDC → Arbitrum USDC (EIP-2612 Permit via Relay)
 * 2. Deposit: Arbitrum USDC → Hyperliquid (permit + deposit API)
 */
export class HyperliquidDepositHandler implements DepositHandler {
  readonly protocol = 'hyperliquid';
  readonly destinationChainId = CHAIN_IDS.ARBITRUM;

  /**
   * Recipient for Hyperliquid bridge is the user's EVM address
   * (funds go to the same address on Arbitrum)
   */
  resolveRecipient(context: RecipientContext): string {
    return context.walletAddress;
  }

  /**
   * Sign using EIP-2612 Permit for Arbitrum bridge
   */
  async signBridgeTransaction(
    signatureStep: BridgeStep,
    walletAddress: string,
    organizationId: string
  ): Promise<BridgeSignResult> {
    // Extract execute parameters from post.body in quote response
    const postBody = signatureStep.items[0]?.data?.post?.body;
    const executeKind = postBody?.kind || 'PERMIT';
    const executeApi = postBody?.api || 'relay';

    // Extract EIP-2612 permit data
    const permitData = signatureStep.items[0]?.data as PermitData;
    if (!permitData) {
      throw new Error('Permit data not found in signature step');
    }

    // Sign with Turnkey
    const signature = await signPermitWithTurnkey(
      permitData,
      walletAddress,
      organizationId
    );

    return { signature, executeKind, executeApi };
  }

  /**
   * Execute Hyperliquid deposit: Arbitrum USDC → Hyperliquid
   *
   * Steps:
   * 1. Check USDC balance on Arbitrum
   * 2. Create EIP-2612 permit for Hyperliquid router
   * 3. Sign the permit
   * 4. Submit deposit via API
   */
  async executeDeposit(context: DepositContext): Promise<DepositResult> {
    const { walletAddress, organizationId, bridgeRequestId } = context;

    // 1. Check Arbitrum USDC balance
    const arbitrumBalance = await getUSDCBalanceOnArbitrum(walletAddress as `0x${string}`);

    if (arbitrumBalance < BigInt(MIN_DEPOSIT_AMOUNT)) {
      throw new Error(
        `Insufficient balance for deposit. Minimum is ${MIN_DEPOSIT_AMOUNT / 1_000_000} USDC, but balance is ${formatUSDCBalanceArbitrum(arbitrumBalance)} USDC`
      );
    }

    // 2. Create USDC permit for Hyperliquid router
    const balanceInUSDC = formatUSDCBalanceArbitrum(arbitrumBalance);
    const spenderAddress = HYPERLIQUID_ROUTER_CONTRACT;

    const permitResult = await createUsdcPermit(
      balanceInUSDC,
      walletAddress,
      spenderAddress
    );

    if (!permitResult.success || !permitResult.typedData) {
      throw new Error(permitResult.error || 'Failed to create USDC permit');
    }

    // 3. Sign the permit
    const signatureResult = await signUsdcPermit(
      permitResult.typedData,
      walletAddress,
      organizationId
    );

    if (!signatureResult.success || !signatureResult.signature) {
      throw new Error(signatureResult.error || 'Failed to sign USDC permit');
    }

    // 4. Submit deposit to Hyperliquid
    const txHash = await depositService.deposit({
      amount: arbitrumBalance.toString(),
      userAddress: walletAddress,
      permit: signatureResult.signature,
    });

    return {
      txHash,
      protocol: this.protocol,
      bridgeRequestId,
    };
  }
}
