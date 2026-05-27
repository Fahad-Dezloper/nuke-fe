/**
 * Phoenix deposit handler — direct Solana USDC → Phoenix (no relay bridge), Turnkey-signed Rise ixs.
 */

import { SOLANA_DIRECT_MIN_DEPOSIT_MICROS } from '@/constants';
import { CHAIN_IDS, MIN_DEPOSIT_AMOUNT, PACIFICA_GAS_REIMBURSEMENT } from '../types';
import { getUSDCBalanceOnSolana } from '../balance-api';
import { formatUSDCBalanceSolana } from '../solana-utils';
import { phoenixService, PhoenixServiceError } from '@/lib/services/phoenix';
import { isPhoenixFeePayerConfigured } from '@/lib/phoenix/env';
import type { BridgeStep } from '../types';
import type {
  DepositHandler,
  RecipientContext,
  BridgeSignResult,
  DepositContext,
  DepositResult,
} from './deposit-handler.interface';

export class PhoenixDepositHandler implements DepositHandler {
  readonly protocol = 'phoenix';
  readonly destinationChainId = CHAIN_IDS.SOLANA;

  resolveRecipient(context: RecipientContext): string {
    if (!context.solanaRecipientAddress) {
      throw new Error('No Solana wallet address found for Phoenix deposit.');
    }
    return context.solanaRecipientAddress;
  }

  async signBridgeTransaction(
    _signatureStep: BridgeStep,
    _walletAddress: string,
    _organizationId: string
  ): Promise<BridgeSignResult> {
    throw new Error('Phoenix does not use relay bridge signing.');
  }

  async executeDeposit(context: DepositContext): Promise<DepositResult> {
    const { organizationId, bridgeRequestId, solanaRecipientAddress, depositAmountMicros } =
      context;

    if (!solanaRecipientAddress) {
      throw new Error('No Solana wallet address found for Phoenix deposit.');
    }

    if (!phoenixService.isTradingEnabled()) {
      throw new PhoenixServiceError('Phoenix trading is disabled.');
    }

    const solanaBalance = await getUSDCBalanceOnSolana(solanaRecipientAddress);
    const gasBuffer = isPhoenixFeePayerConfigured() ? BigInt(0) : BigInt(PACIFICA_GAS_REIMBURSEMENT);

    const minMicros =
      depositAmountMicros !== undefined && depositAmountMicros > BigInt(0)
        ? BigInt(SOLANA_DIRECT_MIN_DEPOSIT_MICROS)
        : BigInt(MIN_DEPOSIT_AMOUNT);

    let amountToDeposit: bigint;

    if (depositAmountMicros !== undefined && depositAmountMicros > BigInt(0)) {
      if (depositAmountMicros < minMicros) {
        throw new Error(
          `Minimum Phoenix deposit is ${formatUSDCBalanceSolana(minMicros)} USDC`
        );
      }
      const requiredBalance = depositAmountMicros + gasBuffer;
      if (solanaBalance < requiredBalance) {
        throw new Error(
          `Insufficient Solana USDC. Need ${formatUSDCBalanceSolana(requiredBalance)} (deposit + gas buffer), have ${formatUSDCBalanceSolana(solanaBalance)} USDC`
        );
      }
      amountToDeposit = depositAmountMicros;
    } else {
      const minRequired = minMicros + gasBuffer;
      if (solanaBalance < minRequired) {
        throw new Error(
          `Insufficient balance for Phoenix deposit. Need at least ${formatUSDCBalanceSolana(minRequired)} USDC on Solana.`
        );
      }
      amountToDeposit = solanaBalance - gasBuffer;
    }

    const txHash = await phoenixService.depositUsdc(
      solanaRecipientAddress,
      organizationId,
      amountToDeposit
    );

    return {
      txHash,
      protocol: this.protocol,
      bridgeRequestId,
    };
  }
}
