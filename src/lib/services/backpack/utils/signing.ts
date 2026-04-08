import bs58 from 'bs58';
import { uint8ArrayToBase64 } from './base64';

export type BackpackInstruction =
  | 'accountQuery'
  | 'accountUpdate'
  | 'balanceQuery'
  | 'collateralQuery'
  | 'orderExecute'
  | 'orderCancel'
  | 'orderCancelAll'
  | 'orderQuery'
  | 'orderQueryAll'
  | 'positionQuery'
  | 'fundingHistoryQueryAll'
  | 'positionHistoryQueryAll'
  | 'fillHistoryQueryAll'
  | 'orderHistoryQueryAll'
  | 'withdraw'
  | 'withdrawalQueryAll'
  | 'maxBorrowQuantity'
  | 'maxOrderQuantity'
  | 'maxWithdrawalQuantity'
  | 'borrowLendExecute'
  | 'borrowHistoryQueryAll'
  | 'depositQueryAll'
  | 'depositAddressQuery'
  | 'interestHistoryQueryAll'
  | 'settlementHistoryQueryAll'
  | 'convertDust'
  | 'dustHistoryQueryAll'
  | 'quoteSubmit'
  | 'strategyCreate'
  | 'strategyCancel'
  | 'strategyQuery'
  | 'strategyQueryAll'
  | 'strategyCancelAll'
  | 'strategyHistoryQueryAll'
  | 'pnlHistoryQueryAll';

export function solanaPubkeyBase58ToBackpackApiKeyBase64(solanaAddress: string): string {
  const pubkeyBytes = bs58.decode(solanaAddress);
  return uint8ArrayToBase64(pubkeyBytes);
}

function toSortedQueryString(params: Record<string, unknown>): string {
  const keys = Object.keys(params).sort();
  const parts: string[] = [];

  for (const key of keys) {
    const value = (params as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  return parts.join('&');
}

export function createBackpackSigningString(args: {
  instruction: BackpackInstruction;
  /** Either request body (for POST/PATCH/DELETE) or query params (for GET). */
  params?: Record<string, unknown>;
  timestamp: number;
  windowMs?: number;
}): string {
  const windowMs = args.windowMs ?? 5000;
  const sorted = args.params ? toSortedQueryString(args.params) : '';

  // Per docs, instruction must be prefixed as `instruction=<type>` and then the sorted params.
  const head = `instruction=${args.instruction}`;
  const withParams = sorted ? `${head}&${sorted}` : head;
  return `${withParams}&timestamp=${args.timestamp}&window=${windowMs}`;
}

