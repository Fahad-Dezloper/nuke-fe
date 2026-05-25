/**
 * Shared prep for direct Solana → exchange deposits (Add margin / DEPOSIT_TO_*).
 * No relay bridge — user USDC must already be on Turnkey Solana.
 */

import { PacificaService } from '@/lib/services/pacifica/pacifica.service';
import { phoenixService } from '@/lib/services/phoenix';
import { isPhoenixTradingConfigured } from '@/lib/phoenix/env';

const pacService = new PacificaService();

export function assertPhoenixTradingConfigured(): void {
  if (!isPhoenixTradingConfigured()) {
    throw new Error(
      'Phoenix trading is disabled. Set NEXT_PUBLIC_PHOENIX_TRADING_ENABLED=true and restart the dev server.'
    );
  }
}

/** On-chain registerTrader if needed; HTTP invite only when NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE=true. */
export async function ensurePhoenixReadyForDeposit(
  solanaAddress: string,
  organizationId: string
): Promise<void> {
  assertPhoenixTradingConfigured();
  await phoenixService.ensureActivatedAndRegistered(solanaAddress, organizationId);
}

const PHOENIX_DEPOSIT_SLACK_USD = 0.01;

/**
 * True when Rise free collateral already covers this deposit step.
 * Backend often sends DEPOSIT_TO_PHOENIX with existing_margin_usd=0 after Add margin.
 */
export async function phoenixCollateralCoversDeposit(
  solanaAddress: string,
  existingMarginUsd: number,
  depositAmountUsd: number
): Promise<boolean> {
  if (depositAmountUsd <= 0) {
    return true;
  }

  const result = await phoenixService.fetchFreeCollateralUsd(solanaAddress);
  if (!result.success) {
    return false;
  }

  const requiredUsd = Math.max(0, existingMarginUsd) + depositAmountUsd;
  return result.usd + PHOENIX_DEPOSIT_SLACK_USD >= requiredUsd;
}

/**
 * Builder approval on Pacifica (required for builder_code on orders).
 * Skips approve when NUKETRADE is already in GET approvals.
 */
export async function ensurePacificaBuilderForDeposit(
  solanaAddress: string,
  organizationId: string
): Promise<void> {
  const approved = await pacService.checkBuilderCodeApproval(solanaAddress);
  if (approved) return;

  const result = await pacService.approveBuilderCode(solanaAddress, organizationId);
  if (!result.success) {
    throw new Error(result.error || 'Pacifica builder code approval failed');
  }
}
