/** Client helper — sponsored RegisterTrader via server fee payer. */

export async function registerPhoenixTraderSponsored(authority: string): Promise<string | null> {
  const res = await fetch('/api/phoenix/register-trader', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authority }),
  });

  const data = (await res.json()) as {
    txSignature?: string;
    alreadyRegistered?: boolean;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `RegisterTrader failed (${res.status})`);
  }

  if (data.alreadyRegistered) {
    return null;
  }

  if (!data.txSignature) {
    throw new Error('RegisterTrader succeeded without a transaction signature');
  }

  return data.txSignature;
}
