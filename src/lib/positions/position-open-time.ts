/**
 * Client-side position open timestamps for funding APR annualization.
 * Recorded when a hedge opens successfully; cleared when fully closed.
 */

const STORAGE_KEY = 'nuke_position_open_times';

export function buildPositionKey(
  symbol: string,
  longProtocol: string,
  shortProtocol: string
): string {
  return `${symbol.toUpperCase()}:${longProtocol.toLowerCase()}:${shortProtocol.toLowerCase()}`;
}

function readStore(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const ms = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(ms) && ms > 0) out[key] = ms;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage unavailable */
  }
}

export function recordPositionOpenTime(
  symbol: string,
  longProtocol: string,
  shortProtocol: string,
  openedAtMs: number = Date.now()
): void {
  const key = buildPositionKey(symbol, longProtocol, shortProtocol);
  const store = readStore();
  if (store[key]) return;
  store[key] = openedAtMs;
  writeStore(store);
}

export function getPositionOpenTimeMs(
  symbol: string,
  longProtocol: string,
  shortProtocol: string
): number | null {
  const key = buildPositionKey(symbol, longProtocol, shortProtocol);
  return readStore()[key] ?? null;
}

export function clearPositionOpenTime(
  symbol: string,
  longProtocol: string,
  shortProtocol: string
): void {
  const key = buildPositionKey(symbol, longProtocol, shortProtocol);
  const store = readStore();
  if (!(key in store)) return;
  delete store[key];
  writeStore(store);
}

export function parseOpenedAt(value: string | number | undefined | null): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}
