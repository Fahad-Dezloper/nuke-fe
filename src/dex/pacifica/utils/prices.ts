import { PACIFICA_HTTP_URL } from '../constants';

export interface PacificaPriceRow {
  symbol: string;
  mark: string;
  mid?: string;
  oracle?: string;
}

interface PacificaPricesResponse {
  success?: boolean;
  data?: PacificaPriceRow[];
}

/**
 * Pacifica mark price for mirrored hedge TP/SL (source of truth per hedge spec).
 * GET /api/v1/info/prices
 */
export async function fetchPacificaMarkPrice(symbol: string): Promise<number | null> {
  const sym = symbol.toUpperCase();
  try {
    const response = await fetch(`${PACIFICA_HTTP_URL}/info/prices`, {
      method: 'GET',
      headers: { Accept: '*/*' },
    });
    if (!response.ok) {
      console.warn('[Pacifica] fetchPacificaMarkPrice failed:', response.status);
      return null;
    }
    const json = (await response.json()) as PacificaPricesResponse;
    const row = json.data?.find((r) => r.symbol?.toUpperCase() === sym);
    if (!row?.mark) return null;
    const mark = parseFloat(row.mark);
    return Number.isFinite(mark) && mark > 0 ? mark : null;
  } catch (err) {
    console.warn('[Pacifica] fetchPacificaMarkPrice error:', err);
    return null;
  }
}
