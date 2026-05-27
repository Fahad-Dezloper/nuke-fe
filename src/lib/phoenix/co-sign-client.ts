/**
 * Client helper — request fee-payer signature from the Next.js API route.
 */

export async function coSignPhoenixTransaction(transactionBase64: string): Promise<string> {
  const res = await fetch('/api/phoenix/co-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionBase64 }),
  });

  const data = (await res.json()) as { transactionBase64?: string; error?: string };
  if (!res.ok || !data.transactionBase64) {
    throw new Error(data.error || `Phoenix co-sign failed (${res.status})`);
  }
  return data.transactionBase64;
}
