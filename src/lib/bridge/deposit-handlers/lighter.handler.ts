/**
 * Lighter deposit handler — **Ethereum mainnet** USDC → `POST /lighter/deposit` (EIP-2612 permit + JWT).
 *
 * Aligns with backend contract: mainnet USDC, permit `spender` = Lighter deposit contract,
 * optional `asset_index` / `route_type` on the request body.
 *
 * @see LIGHTER_DEPOSIT_FE_INTEGRATION.md
 */

import { signPermitWithTurnkey } from '../signing';
import { depositService } from '../deposit.service';
import { getUSDCBalanceOnEthereum } from '../balance-api';
import { formatUSDCBalanceArbitrum } from '../balance';
import { createEthereumMainnetUsdcPermit, signUsdcPermit } from '../usdc-permit';
import { CHAIN_IDS } from '../types';
import { LIGHTER_ETH_DEPOSIT_CONTRACT } from '@/constants';
import type { BridgeStep, PermitData } from '../types';
import type {
  DepositHandler,
  RecipientContext,
  BridgeSignResult,
  DepositContext,
  DepositResult,
} from './deposit-handler.interface';

/** Server rejects `amount` below 1 USDC (6 decimals). @see LIGHTER_DEPOSIT_FE_INTEGRATION.md */
const LIGHTER_MIN_DEPOSIT_BASE_UNITS = BigInt(1_000_000);

export class LighterDepositHandler implements DepositHandler {
  readonly protocol = 'lighter';
  readonly destinationChainId = CHAIN_IDS.ETHEREUM;

  resolveRecipient(context: RecipientContext): string {
    return context.walletAddress;
  }

  async signBridgeTransaction(
    signatureStep: BridgeStep,
    walletAddress: string,
    organizationId: string
  ): Promise<BridgeSignResult> {
    const postBody = signatureStep.items[0]?.data?.post?.body;
    const executeKind = postBody?.kind || 'PERMIT';
    const executeApi = postBody?.api || 'relay';

    const permitData = signatureStep.items[0]?.data as PermitData;
    if (!permitData) {
      throw new Error('Permit data not found in signature step');
    }

    const signature = await signPermitWithTurnkey(permitData, walletAddress, organizationId);

    return { signature, executeKind, executeApi };
  }

  async executeDeposit(context: DepositContext): Promise<DepositResult> {
    const { walletAddress, organizationId, bridgeRequestId } = context;

    const mainnetBalance = await getUSDCBalanceOnEthereum(walletAddress as `0x${string}`);

    if (mainnetBalance < LIGHTER_MIN_DEPOSIT_BASE_UNITS) {
      throw new Error(
        `Insufficient Ethereum mainnet USDC for Lighter deposit. Minimum is 1 USDC, balance is ${formatUSDCBalanceArbitrum(mainnetBalance)} USDC. Bridge USDC to Ethereum mainnet first.`
      );
    }

    const balanceInUSDC = formatUSDCBalanceArbitrum(mainnetBalance);

    const permitResult = await createEthereumMainnetUsdcPermit(
      balanceInUSDC,
      walletAddress,
      LIGHTER_ETH_DEPOSIT_CONTRACT as `0x${string}`
    );

    if (!permitResult.success || !permitResult.typedData) {
      throw new Error(permitResult.error || 'Failed to create USDC permit');
    }

    const signatureResult = await signUsdcPermit(
      permitResult.typedData,
      walletAddress,
      organizationId
    );

    if (!signatureResult.success || !signatureResult.signature) {
      throw new Error(signatureResult.error || 'Failed to sign USDC permit');
    }

    const txHash = await depositService.depositToLighter({
      amount: mainnetBalance.toString(),
      permit: signatureResult.signature,
    });

    return {
      txHash,
      protocol: this.protocol,
      bridgeRequestId,
    };
  }
}
