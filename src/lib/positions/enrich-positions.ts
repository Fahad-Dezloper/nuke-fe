import type { PositionApiResponse } from '@/lib/api/services/positions.service';
import { resolveLegProtocols } from '@/lib/api/services/positions.service';
import type { ArbitragePosition } from '@/types/positions';
import {
  computeFundingAprPercent,
  formatFundingApr,
  parseSignedCurrency,
} from './funding-apr';
import {
  clearPositionOpenTime,
  getPositionOpenTimeMs,
  parseOpenedAt,
} from './position-open-time';

export function enrichPositionWithFundingApr(
  position: ArbitragePosition,
  apiData?: PositionApiResponse
): ArbitragePosition {
  const openedAtMs =
    parseOpenedAt(apiData?.opened_at) ??
    getPositionOpenTimeMs(position.asset, position.long.platform, position.short.platform);

  if (!openedAtMs) {
    return { ...position, fundingApr: '—' };
  }

  const fundingPnlUsd = parseSignedCurrency(position.fundingPnl.current);
  const marginUsd = parseSignedCurrency(position.margin);
  const aprPercent = computeFundingAprPercent(fundingPnlUsd, marginUsd, openedAtMs);

  return {
    ...position,
    fundingApr: formatFundingApr(aprPercent),
  };
}

export function enrichPositionsWithFundingApr(
  rawPositions: PositionApiResponse[],
  positions: ArbitragePosition[]
): ArbitragePosition[] {
  return positions.map((position, index) =>
    enrichPositionWithFundingApr(position, rawPositions[index])
  );
}

export function clearFundingAprOpenTimeForRaw(raw: PositionApiResponse): void {
  const { longProtocol, shortProtocol } = resolveLegProtocols(raw);
  clearPositionOpenTime(raw.symbol, longProtocol, shortProtocol);
}
