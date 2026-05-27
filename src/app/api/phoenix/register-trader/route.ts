/**
 * Sponsored Phoenix RegisterTrader — server signs with fee payer (no user SOL required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { sponsoredRegisterPhoenixTrader } from '@/lib/phoenix/sponsored-register.server';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { authority?: string };
    const authority = body.authority?.trim();
    if (!authority) {
      return NextResponse.json({ error: 'Missing authority (user Solana wallet)' }, { status: 400 });
    }

    try {
      new PublicKey(authority);
    } catch {
      return NextResponse.json({ error: 'Invalid Solana authority address' }, { status: 400 });
    }

    const result = await sponsoredRegisterPhoenixTrader(authority);
    if (result.alreadyRegistered) {
      return NextResponse.json({ ok: true, alreadyRegistered: true });
    }
    return NextResponse.json({ txSignature: result.txSignature });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[phoenix/register-trader]', message);

    if (message.includes('already exists')) {
      return NextResponse.json({ ok: true, alreadyRegistered: true });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
