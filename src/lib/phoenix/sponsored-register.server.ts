/**
 * Server-side Phoenix RegisterTrader using the sponsored fee payer.
 * RegisterTrader only requires the payer (sponsor) signature — not the user authority.
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { MarginType, type Authority } from '@ellipsis-labs/rise';
import { ensurePhoenixExchangeReady, getPhoenixRiseClient } from '@/lib/services/phoenix/phoenix-client';
import {
  getExpectedPhoenixFeePayerPublicKey,
  loadPhoenixFeePayerKeypair,
} from '@/lib/phoenix/fee-payer.server';
import { normalizeRiseInstruction, type RiseInstructionLike } from '@/lib/services/phoenix/phoenix-submit';

const READONLY_SIGNER = 2;
const WRITABLE_SIGNER = 3;

const REGISTER_TRADER_RENT_LAMPORTS = 2_839_680;
const MIN_SPONSOR_LAMPORTS = REGISTER_TRADER_RENT_LAMPORTS + 500_000;

function getSolanaRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  );
}

function riseIxToWeb3(ix: RiseInstructionLike): TransactionInstruction {
  const programId = new PublicKey(ix.programAddress);
  const keys = ix.accounts.map((a) => ({
    pubkey: new PublicKey(a.address),
    isSigner: a.role === READONLY_SIGNER || a.role === WRITABLE_SIGNER,
    isWritable: a.role === 1 || a.role === WRITABLE_SIGNER,
  }));
  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(ix.data),
  });
}

export async function sponsoredRegisterPhoenixTrader(
  authority: string
): Promise<{ txSignature?: string; alreadyRegistered: boolean }> {
  const authorityPubkey = new PublicKey(authority);
  const feePayerKeypair = loadPhoenixFeePayerKeypair();
  const feePayerPubkey = getExpectedPhoenixFeePayerPublicKey();

  if (!feePayerKeypair.publicKey.equals(feePayerPubkey)) {
    throw new Error('PHOENIX_FEE_PAYER_PRIVATE_KEY does not match NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS');
  }

  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  const sponsorBalance = await connection.getBalance(feePayerPubkey, 'confirmed');
  if (sponsorBalance < MIN_SPONSOR_LAMPORTS) {
    throw new Error(
      `Sponsor fee payer is low on SOL (have ${sponsorBalance} lamports, need ~${MIN_SPONSOR_LAMPORTS}). Fund ${feePayerPubkey.toBase58()}.`
    );
  }

  const client = getPhoenixRiseClient();
  await ensurePhoenixExchangeReady();

  try {
    await client.api.traders().getTraderStateSnapshot(authority, { traderPdaIndex: 0 });
    return { alreadyRegistered: true };
  } catch {
    /* not registered yet */
  }

  const regIx = await client.ixs.buildRegisterTrader({
    authority: authorityPubkey.toBase58() as Authority,
    marginType: MarginType.Cross,
    traderPdaIndex: 0,
    traderSubaccountIndex: 0,
    feePayer: feePayerPubkey.toBase58() as Authority,
  } as Parameters<typeof client.ixs.buildRegisterTrader>[0]);

  const web3Ix = riseIxToWeb3(normalizeRiseInstruction(regIx));
  const payerInIx = web3Ix.keys.find((k) => k.isSigner && k.isWritable);
  if (!payerInIx?.pubkey.equals(feePayerPubkey)) {
    throw new Error(
      `RegisterTrader payer mismatch (expected sponsor ${feePayerPubkey.toBase58()}, got ${payerInIx?.pubkey.toBase58() ?? 'none'})`
    );
  }

  const blockhash = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: feePayerPubkey,
    recentBlockhash: blockhash.blockhash,
    instructions: [web3Ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([feePayerKeypair]);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  const confirmation = await connection.confirmTransaction({ signature: sig, ...blockhash }, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`RegisterTrader failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }

  return { txSignature: sig, alreadyRegistered: false };
}
