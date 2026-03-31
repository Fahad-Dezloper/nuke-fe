# Pacifica Deposit via Web3.js (Telegram Bot)

This guide is for integrating Pacifica deposit from another TypeScript project (Telegram bot) using `@solana/web3.js`.

It is based on current backend behavior in:

- `crates/server/src/features/pacifica/controller.rs`
- `crates/pacifica/src/services/deposit.rs`

---

## 1) Current backend contract (important)

Endpoint:

- `POST /pacifica/deposit`

Auth:

- `Authorization: Bearer <jwt>`

Request body:

```json
{
  "amount": 25959811
}
```

Where `amount` is integer USDC base units (6 decimals).

Response:

- base64 serialized Solana transaction (`string`)

---

## 2) Amount semantics used by backend

Backend currently applies:

- `GAS_REIMBURSEMENT_AMOUNT = 200_000` (0.2 USDC)
- `DEPOSIT_BUFFER = 10_000` (0.01 USDC)
- `amount_to_deposit = payload.amount - 200_000 - 10_000`

So if you send:

- `payload.amount` = **gross user debit**
- Pacifica receives less by `210_000` units (0.21 USDC)

### Suggested UX wording

- "You pay": `payload.amount`
- "Deposited to Pacifica": `payload.amount - 210_000`

---

## 3) Minimal dependencies

```bash
npm i @solana/web3.js telegraf
```

If your bot signs user tx itself (custodial flow):

```bash
npm i bs58
```

---

## 4) Environment variables

```bash
BOT_TOKEN=...
BACKEND_BASE_URL=https://nuketrade-service-dev-production.up.railway.app
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# JWT for your backend auth (or fetch dynamically per user)
API_JWT=...

# Optional (custodial bot only): user's Solana private key in base58
USER_SOLANA_PRIVATE_KEY_BASE58=...
```

---

## 5) Core utility helpers (TypeScript)

```ts
import { Connection, Transaction, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const USDC_DECIMALS = 6;
const GAS_REIMBURSEMENT = 200_000; // 0.2
const DEPOSIT_BUFFER = 10_000; // 0.01
const MIN_BACKEND_AMOUNT = 11_000_000; // from backend min check

export function usdcToBaseUnits(usdc: string): number {
  // Safe string -> integer conversion with 6 decimals
  const [whole, fracRaw = ""] = usdc.trim().split(".");
  const frac = (fracRaw + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const n = Number(whole) * 10 ** USDC_DECIMALS + Number(frac);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid USDC amount");
  return Math.floor(n);
}

export function baseUnitsToUsdcString(amount: number): string {
  const whole = Math.floor(amount / 10 ** USDC_DECIMALS);
  const frac = (amount % 10 ** USDC_DECIMALS).toString().padStart(USDC_DECIMALS, "0");
  return `${whole}.${frac}`;
}

export function calcNetPacificaDeposit(grossAmount: number): number {
  return grossAmount - GAS_REIMBURSEMENT - DEPOSIT_BUFFER;
}

export function validateGrossAmount(grossAmount: number): void {
  if (grossAmount < MIN_BACKEND_AMOUNT) {
    throw new Error(`Amount too low. Minimum is ${MIN_BACKEND_AMOUNT} base units.`);
  }
  if (grossAmount <= GAS_REIMBURSEMENT + DEPOSIT_BUFFER) {
    throw new Error("Amount too low after reimbursement and buffer.");
  }
}

export function loadUserKeypairFromBase58(secret: string): Keypair {
  const secretBytes = bs58.decode(secret);
  return Keypair.fromSecretKey(secretBytes);
}

export async function signAndSendSerializedTx(
  serializedBase64: string,
  userKeypair: Keypair,
  rpcUrl: string
): Promise<string> {
  const connection = new Connection(rpcUrl, "confirmed");
  const txBuffer = Buffer.from(serializedBase64, "base64");
  const tx = Transaction.from(txBuffer); // backend returns legacy Transaction

  // Fee payer is already partially signed by backend.
  tx.partialSign(userKeypair);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
```

---

## 6) Call backend deposit API and get serialized tx

```ts
type PacificaDepositApiResponse = string; // base64 serialized tx

export async function requestPacificaDepositTx(params: {
  backendBaseUrl: string;
  jwt: string;
  amount: number; // base units
}): Promise<PacificaDepositApiResponse> {
  const res = await fetch(`${params.backendBaseUrl}/pacifica/deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.jwt}`,
    },
    body: JSON.stringify({ amount: params.amount }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deposit API failed: HTTP ${res.status} ${body}`);
  }

  const serializedTx = (await res.json()) as string;
  if (!serializedTx || typeof serializedTx !== "string") {
    throw new Error("Invalid deposit API response: expected base64 tx string");
  }
  return serializedTx;
}
```

---

## 7) Telegram bot command example (`/deposit`)

Example command:

- `/deposit 25.5`

```ts
import { Telegraf } from "telegraf";
import {
  usdcToBaseUnits,
  baseUnitsToUsdcString,
  calcNetPacificaDeposit,
  validateGrossAmount,
  requestPacificaDepositTx,
  loadUserKeypairFromBase58,
  signAndSendSerializedTx,
} from "./pacifica";

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.command("deposit", async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply("Usage: /deposit <amount_usdc>  e.g. /deposit 25.5");
      return;
    }

    const usdcInput = parts[1];
    const grossAmount = usdcToBaseUnits(usdcInput);
    validateGrossAmount(grossAmount);

    const netAmount = calcNetPacificaDeposit(grossAmount);
    if (netAmount <= 0) {
      await ctx.reply("Amount too low after reimbursement/buffer.");
      return;
    }

    await ctx.reply(
      [
        `Preparing Pacifica deposit...`,
        `Gross debit: ${baseUnitsToUsdcString(grossAmount)} USDC`,
        `Net Pacifica deposit: ${baseUnitsToUsdcString(netAmount)} USDC`,
      ].join("\n")
    );

    const serializedTx = await requestPacificaDepositTx({
      backendBaseUrl: process.env.BACKEND_BASE_URL!,
      jwt: process.env.API_JWT!,
      amount: grossAmount,
    });

    const userKeypair = loadUserKeypairFromBase58(
      process.env.USER_SOLANA_PRIVATE_KEY_BASE58!
    );

    const sig = await signAndSendSerializedTx(
      serializedTx,
      userKeypair,
      process.env.SOLANA_RPC_URL!
    );

    await ctx.reply(`Deposit submitted.\nTx: https://solscan.io/tx/${sig}`);
  } catch (err) {
    await ctx.reply(
      `Deposit failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});

bot.launch();
```

---

## 8) Reliability recommendations (high impact)

- Do not let users deposit exact full displayed balance.
- Keep a user-side reserve (e.g. 0.5-1.0 USDC) to avoid race/rounding failures.
- Fetch latest on-chain ATA balance before calling backend.
- Always log full backend error body for non-200 responses.
- On `InstructionError(...Custom(...))`, inspect backend simulation logs (already printed in current Rust code).

---

## 9) Non-custodial Telegram note

If this is a non-custodial Telegram bot (you do not hold private keys), then:

- bot can request serialized tx from backend,
- but user still needs to sign in their wallet app (deep-link/web app flow),
- then bot or web app broadcasts the signed transaction.

Pure Telegram text bot cannot complete non-custodial signing alone.

---

## 10) Quick checklist before production

- JWT maps to correct `solana_address` claim.
- Amount interpreted in 6-decimal base units everywhere.
- User has enough USDC in the exact ATA used by tx.
- `API_JWT`, RPC URL, and program network are aligned (mainnet/mainnet).
- Bot error messages include HTTP status + backend body for debugging.

