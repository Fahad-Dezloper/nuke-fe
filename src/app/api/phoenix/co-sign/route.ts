/**
 * Co-sign a partially-signed Phoenix Solana transaction with the sponsored fee payer.
 * Server holds PHOENIX_FEE_PAYER_PRIVATE_KEY; client broadcasts the returned tx.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VersionedTransaction } from '@solana/web3.js';
import {
  getExpectedPhoenixFeePayerPublicKey,
  loadPhoenixFeePayerKeypair,
} from '@/lib/phoenix/fee-payer.server';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { transactionBase64?: string };
    if (!body.transactionBase64?.trim()) {
      return NextResponse.json({ error: 'Missing transactionBase64' }, { status: 400 });
    }

    const feePayerKeypair = loadPhoenixFeePayerKeypair();
    const expectedFeePayer = getExpectedPhoenixFeePayerPublicKey();

    if (!feePayerKeypair.publicKey.equals(expectedFeePayer)) {
      return NextResponse.json(
        { error: 'Fee payer private key does not match configured public address' },
        { status: 500 }
      );
    }

    const txBytes = Buffer.from(body.transactionBase64, 'base64');
    const tx = VersionedTransaction.deserialize(txBytes);

    const payer = tx.message.staticAccountKeys[0];
    if (!payer?.equals(expectedFeePayer)) {
      return NextResponse.json(
        { error: 'Transaction fee payer does not match configured sponsor wallet' },
        { status: 400 }
      );
    }

    tx.sign([feePayerKeypair]);

    return NextResponse.json({
      transactionBase64: Buffer.from(tx.serialize()).toString('base64'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[phoenix/co-sign]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
