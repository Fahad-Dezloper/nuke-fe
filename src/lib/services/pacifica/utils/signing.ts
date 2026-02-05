/**
 * Pacifica Signing Utilities
 * Implements the Pacifica API signing flow with recursive JSON sorting
 */

/**
 * Recursively sorts all keys in a JSON object alphabetically
 * This ensures deterministic signature generation
 */
export function sortJsonKeysRecursively(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sortJsonKeysRecursively(item));
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      sorted[key] = sortJsonKeysRecursively((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Creates compact JSON string with no whitespace
 * Uses standard separators (",", ":")
 */
export function createCompactJson(data: unknown): string {
  return JSON.stringify(data, null, 0).replace(/\s+/g, '');
}

/**
 * Prepares the data structure for signing according to Pacifica's requirements
 * 1. Creates signature header with timestamp, expiry_window, and type
 * 2. Wraps operation data in "data" key
 * 3. Recursively sorts all keys alphabetically
 * 4. Creates compact JSON string
 */
export function prepareSigningData(
  operationType: string,
  operationData: Record<string, unknown>,
  timestamp: number,
  expiryWindow?: number
): string {
  // Create signature header
  const signatureHeader: Record<string, unknown> = {
    timestamp,
    type: operationType,
  };

  if (expiryWindow !== undefined) {
    signatureHeader.expiry_window = expiryWindow;
  }

  // Combine header with operation data (wrapped in "data" key)
  const dataToSign = {
    ...signatureHeader,
    data: operationData,
  };

  // Recursively sort all keys
  const sortedData = sortJsonKeysRecursively(dataToSign) as Record<string, unknown>;

  // Create compact JSON
  return createCompactJson(sortedData);
}

/**
 * Converts a message string to UTF-8 bytes
 */
export function messageToBytes(message: string): Uint8Array {
  return new TextEncoder().encode(message);
}
