import { Buffer } from 'buffer';

export function ensureBuffer(): void {
  if (typeof window !== 'undefined' && !(window as unknown as { Buffer?: typeof Buffer }).Buffer) {
    (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  ensureBuffer();
  return Buffer.from(bytes).toString('base64');
}

