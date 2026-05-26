/**
 * Retry helper for single-leg close operations (safety mode + manual close).
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` up to maxRetries+1 times until `isSuccess` returns true.
 */
export async function runWithRetries<T>(
  fn: () => Promise<T>,
  isSuccess: (result: T) => boolean,
  options?: { maxRetries?: number; delayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const delayMs = options?.delayMs ?? DEFAULT_RETRY_DELAY_MS;

  let last: T | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    last = await fn();
    if (isSuccess(last)) return last;
    if (attempt < maxRetries) {
      await sleep(delayMs);
    }
  }
  return last as T;
}
