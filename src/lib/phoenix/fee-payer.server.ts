/**
 * Server-only Phoenix fee payer key loading (never import from client components).
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

function parseFeePayerKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as number[];
    if (!Array.isArray(arr) || arr.length < 64) {
      throw new Error('PHOENIX_FEE_PAYER_PRIVATE_KEY JSON must be a 64-byte secret key array');
    }
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

export function loadPhoenixFeePayerKeypair(): Keypair {
  const raw = process.env.PHOENIX_FEE_PAYER_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error('PHOENIX_FEE_PAYER_PRIVATE_KEY is not configured on the server');
  }
  return parseFeePayerKeypair(raw);
}

export function getExpectedPhoenixFeePayerPublicKey(): PublicKey {
  const configured =
    process.env.NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS?.trim() ||
    process.env.PHOENIX_FEE_PAYER_ADDRESS?.trim();
  if (!configured) {
    throw new Error('PHOENIX_FEE_PAYER_ADDRESS / NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS is not set');
  }
  return new PublicKey(configured);
}
