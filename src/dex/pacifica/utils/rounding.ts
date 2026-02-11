/**
 * Pacifica Rounding Utilities
 *
 * Pacifica requires that 'price' fields are multiples of tick_size
 * and 'amount' fields are multiples of lot_size.
 * Requests with improperly rounded values return a 500 error.
 *
 * Values are always truncated (floored) to the nearest valid multiple
 * to avoid exceeding the user's intended size or spending more than intended.
 */

import { getAssetMeta } from './get-meta';

// ─── Low-level helpers ───────────────────────────────────────────────────────

/**
 * Returns the number of decimal places in a step-size string.
 *
 * Examples:
 *   "1"        → 0
 *   "0.1"      → 1
 *   "0.01"     → 2
 *   "0.000001" → 6
 */
function getDecimalPlaces(stepSize: string): number {
  const parts = stepSize.split('.');
  if (parts.length < 2) return 0;
  return parts[1].length;
}

/**
 * Rounds (truncates) a numeric value **down** to the nearest multiple of
 * `stepSize`.  Uses scaled-integer arithmetic to avoid floating-point drift.
 *
 * @param value    - The value to round (number or numeric string)
 * @param stepSize - The step / tick / lot size (e.g. "0.01", "1", "0.00001")
 * @returns A string representation of the rounded value with the correct
 *          number of decimal places.
 *
 * @example
 *   roundToStep(123.456,   "0.01")    // "123.45"
 *   roundToStep(100000.5,  "1")       // "100000"
 *   roundToStep(0.000035,  "0.00001") // "0.00003"
 *   roundToStep(5.7,       "1")       // "5"
 */
export function roundToStep(
  value: number | string,
  stepSize: string
): string {
  const val = typeof value === 'number' ? value : parseFloat(value);
  const step = parseFloat(stepSize);

  if (isNaN(val) || isNaN(step) || step <= 0) {
    return String(val);
  }

  const decimals = getDecimalPlaces(stepSize);
  const multiplier = Math.pow(10, decimals);

  // Scale to integers so we never lose precision to IEEE-754 rounding.
  // The tiny epsilon (1e-9) guards against values like 12344.9999999998
  // that *should* be 12345 but aren't due to binary floating-point.
  const stepInt = Math.round(step * multiplier);
  const valInt = Math.floor(val * multiplier + 1e-9);

  const roundedInt = valInt - (((valInt % stepInt) + stepInt) % stepInt);

  return (roundedInt / multiplier).toFixed(decimals);
}

// ─── High-level helpers (async — fetch metadata on first call) ───────────────

/**
 * Rounds an order **amount** to the `lot_size` of the given symbol.
 *
 * If metadata cannot be fetched the raw value is returned as-is so the
 * caller can still attempt the request (the API will reject if wrong).
 */
export async function roundAmount(
  amount: number | string,
  symbol: string
): Promise<string> {
  const meta = await getAssetMeta(symbol);
  if (!meta) {
    console.warn(
      `[pacifica/rounding] No metadata for "${symbol}" — returning amount as-is`
    );
    return String(amount);
  }
  return roundToStep(amount, meta.lot_size);
}

/**
 * Rounds an order **price** to the `tick_size` of the given symbol.
 *
 * If metadata cannot be fetched the raw value is returned as-is.
 */
export async function roundPrice(
  price: number | string,
  symbol: string
): Promise<string> {
  const meta = await getAssetMeta(symbol);
  if (!meta) {
    console.warn(
      `[pacifica/rounding] No metadata for "${symbol}" — returning price as-is`
    );
    return String(price);
  }
  return roundToStep(price, meta.tick_size);
}
