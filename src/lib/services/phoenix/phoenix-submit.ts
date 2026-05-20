/**
 * Turnkey-sign and submit Rise `InstructionsWithAccountsAndData` on Solana (v0 message).
 */

import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { signSolanaMessageWithTurnkey } from '@/lib/bridge/solana-utils';

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com';

/** @solana/kit AccountRole numeric values (readonly / writable / signer variants). */
const READONLY = 0;
const WRITABLE = 1;
const READONLY_SIGNER = 2;
const WRITABLE_SIGNER = 3;

export class PhoenixSubmitError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PhoenixSubmitError';
  }
}

export type RiseInstructionLike = {
  readonly programAddress: string;
  readonly accounts: ReadonlyArray<{ readonly address: string; readonly role: number }>;
  readonly data: Uint8Array;
};

/**
 * Rise ix objects use branded address types and `ReadonlyUint8Array` data.
 * Normalize to plain strings + `Uint8Array` for `@solana/web3.js`.
 */
export function normalizeRiseInstruction(ix: {
  readonly programAddress: string;
  readonly accounts: ReadonlyArray<{ readonly address: string; readonly role: number }>;
  readonly data: ArrayBufferView;
}): RiseInstructionLike {
  const d = ix.data;
  return {
    programAddress: String(ix.programAddress),
    accounts: ix.accounts.map((a) => ({
      address: String(a.address),
      role: Number(a.role),
    })),
    data: new Uint8Array(d.buffer, d.byteOffset, d.byteLength),
  };
}

function riseIxToWeb3(ix: RiseInstructionLike): TransactionInstruction {
  const programId = new PublicKey(ix.programAddress);
  const keys = ix.accounts.map((a) => ({
    pubkey: new PublicKey(a.address),
    isSigner: a.role === READONLY_SIGNER || a.role === WRITABLE_SIGNER,
    isWritable: a.role === WRITABLE || a.role === WRITABLE_SIGNER,
  }));
  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(ix.data),
  });
}

/**
 * Sign (Turnkey) + send one or more Rise instructions in a single VersionedTransaction.
 */
export async function submitRiseInstructions(
  instructions: RiseInstructionLike[],
  feePayerAndSignerAddress: string,
  organizationId: string
): Promise<string> {
  if (instructions.length === 0) {
    throw new PhoenixSubmitError('No Phoenix instructions to submit');
  }

  const { Connection } = await import('@solana/web3.js');
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const payer = new PublicKey(feePayerAndSignerAddress);

  const ixs = instructions.map(riseIxToWeb3);
  const blockhash = await connection.getLatestBlockhash('confirmed');

  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash.blockhash,
    instructions: ixs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  const sig = await signSolanaMessageWithTurnkey(
    tx.message.serialize(),
    feePayerAndSignerAddress,
    organizationId
  );

  tx.addSignature(payer, sig);

  const txSig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  const confirmation = await connection.confirmTransaction(
    { signature: txSig, ...blockhash },
    'confirmed'
  );

  if (confirmation.value.err) {
    throw new PhoenixSubmitError(
      `Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  return txSig;
}
