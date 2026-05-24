import type { PositionApiResponse } from '@/lib/api/services/positions.service';

export type CloseableProtocol = 'hyperliquid' | 'pacifica' | 'phoenix' | 'lighter' | 'backpack';

export const CLOSEABLE_PROTOCOLS: CloseableProtocol[] = [
  'hyperliquid',
  'pacifica',
  'phoenix',
  'lighter',
  'backpack',
];

type PositionLeg = NonNullable<PositionApiResponse['hyperliquid']>;

/** All non-null venue legs on an aggregated position row. */
export function getCloseableLegs(
  position: PositionApiResponse
): Array<{ protocol: CloseableProtocol; leg: PositionLeg }> {
  return CLOSEABLE_PROTOCOLS.flatMap((protocol) => {
    const leg = position[protocol];
    return leg ? [{ protocol, leg }] : [];
  });
}
