/**
 * Turnkey-sign and submit Rise `InstructionsWithAccountsAndData` on Solana (v0 message).
 * Optional sponsored fee payer: user signs authority, server co-signs SOL fees.
 */

import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { signSolanaMessageWithTurnkey } from '@/lib/bridge/solana-utils';
import { coSignPhoenixTransaction } from '@/lib/phoenix/co-sign-client';
import { getPhoenixFeePayerAddress } from '@/lib/phoenix/env';

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com';

/**
 * Flight-wrapped Phoenix market orders (especially close + settle funding) often exceed
 * the default 200k CU per-invocation cap. Raise the tx budget (max ~1.4M on mainnet).
 */
const PHOENIX_COMPUTE_UNIT_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_PHOENIX_COMPUTE_UNIT_LIMIT?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 1_400_000;
  return Number.isFinite(n) && n >= 200_000 ? n : 1_400_000;
})();

function prependComputeBudgetIxs(ixs: TransactionInstruction[]): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: PHOENIX_COMPUTE_UNIT_LIMIT }),
    ...ixs,
  ];
}

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

export type SubmitRiseInstructionsOptions = {
  /** Override env fee payer (defaults to NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS). */
  feePayerAddress?: string;
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

/** Convert a `@solana/web3.js` instruction (e.g. SPL ATA create) for Rise submit. */
export function web3InstructionToRise(ix: TransactionInstruction): RiseInstructionLike {
  return {
    programAddress: ix.programId.toBase58(),
    accounts: ix.keys.map((k) => ({
      address: k.pubkey.toBase58(),
      role:
        k.isSigner && k.isWritable
          ? WRITABLE_SIGNER
          : k.isSigner
            ? READONLY_SIGNER
            : k.isWritable
              ? WRITABLE
              : READONLY,
    })),
    data: new Uint8Array(ix.data),
  };
}

function instructionSetNeedsAuthoritySignature(
  ixs: TransactionInstruction[],
  authority: PublicKey
): boolean {
  return ixs.some((ix) => ix.keys.some((k) => k.pubkey.equals(authority) && k.isSigner));
}

async function formatSendTransactionError(
  connection: InstanceType<typeof import('@solana/web3.js').Connection>,
  err: unknown
): Promise<string> {
  const base = err instanceof Error ? err.message : String(err);

  if (base.includes('insufficient lamports') || base.includes('Transfer: insufficient lamports')) {
    return (
      'Phoenix transaction failed: insufficient SOL for account rent or fees. ' +
      'Ensure NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS is set and the sponsor wallet is funded, ' +
      'or add ~0.003 SOL to the user wallet.'
    );
  }

  if (base.includes('Attempt to debit an account but found no record of a prior credit')) {
    return (
      'Phoenix deposit failed: your Solana wallet has no USDC token account or zero USDC balance. ' +
      'Send USDC to this wallet on Solana first, then retry Add margin.'
    );
  }

  const sendErr = err as { logs?: string[]; getLogs?: () => Promise<string[]> };
  let logs: string[] | undefined = sendErr.logs;
  if (!logs?.length && typeof sendErr.getLogs === 'function') {
    try {
      logs = await sendErr.getLogs();
    } catch {
      /* ignore */
    }
  }

  if (
    base.includes('exceeded CUs meter') ||
    base.includes('Computational budget exceeded') ||
    logs?.some((l) => l.includes('exceeded CUs meter'))
  ) {
    return (
      'Phoenix transaction failed: compute unit limit exceeded (common on Flight-wrapped closes). ' +
      `Retry, or set NEXT_PUBLIC_PHOENIX_COMPUTE_UNIT_LIMIT (current ${PHOENIX_COMPUTE_UNIT_LIMIT}). ` +
      `Original: ${base}`
    );
  }

  if (logs?.length) {
    return `${base}\nLogs:\n${logs.join('\n')}`;
  }
  return base;
}

function resolveFeePayerAddress(options?: SubmitRiseInstructionsOptions): string | undefined {
  return options?.feePayerAddress?.trim() || getPhoenixFeePayerAddress();
}

/**
 * Sign (Turnkey authority + optional sponsored fee payer) and send a VersionedTransaction.
 */
export async function submitRiseInstructions(
  instructions: RiseInstructionLike[],
  authorityAddress: string,
  organizationId: string,
  options?: SubmitRiseInstructionsOptions
): Promise<string> {
  if (instructions.length === 0) {
    throw new PhoenixSubmitError('No Phoenix instructions to submit');
  }

  const { Connection } = await import('@solana/web3.js');
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

  const authority = new PublicKey(authorityAddress);
  const sponsoredFeePayer = resolveFeePayerAddress(options);
  const feePayerAddress = sponsoredFeePayer ?? authorityAddress;
  const feePayer = new PublicKey(feePayerAddress);
  const usesSponsor = sponsoredFeePayer != null && sponsoredFeePayer !== authorityAddress;

  const ixs = prependComputeBudgetIxs(instructions.map(riseIxToWeb3));
  const blockhash = await connection.getLatestBlockhash('confirmed');

  const messageV0 = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash.blockhash,
    instructions: ixs,
  }).compileToV0Message();

  let tx = new VersionedTransaction(messageV0);
  const messageBytes = tx.message.serialize();

  const needsAuthoritySig = instructionSetNeedsAuthoritySignature(ixs, authority);

  if (needsAuthoritySig) {
    const authoritySig = await signSolanaMessageWithTurnkey(
      messageBytes,
      authorityAddress,
      organizationId
    );
    tx.addSignature(authority, authoritySig);
  }

  if (usesSponsor) {
    const partialBase64 = Buffer.from(tx.serialize()).toString('base64');
    const coSignedBase64 = await coSignPhoenixTransaction(partialBase64);
    tx = VersionedTransaction.deserialize(Buffer.from(coSignedBase64, 'base64'));
  } else if (!needsAuthoritySig) {
    throw new PhoenixSubmitError('Transaction has no authority signature and no fee payer configured');
  }

  let txSig: string;
  try {
    txSig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
  } catch (err) {
    const msg = await formatSendTransactionError(connection, err);
    throw new PhoenixSubmitError(msg, err);
  }

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
