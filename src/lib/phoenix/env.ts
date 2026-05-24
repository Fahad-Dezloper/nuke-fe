/**
 * Phoenix + Flight (builder) feature flags and env-backed config.
 * Never hardcode builder secrets; public builder authority is fine in env.
 */

export function isPhoenixTradingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHOENIX_TRADING_ENABLED === 'true';
}

/** UI + deposit gate: only the master switch for now (invite/builder wired later). */
export function isPhoenixTradingConfigured(): boolean {
  return isPhoenixTradingEnabled();
}

/**
 * HTTP invite/referral activation before registerTrader.
 * Off by default — set NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE=true plus invite/referral env when ready.
 */
export function isPhoenixInviteOnboardingEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE !== 'true') {
    return false;
  }
  return !!(getPhoenixInviteCode() || getPhoenixReferralCode());
}

/** Flight wraps certain Phoenix instructions behind the Flight program (beta). */
export function isPhoenixFlightEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHOENIX_FLIGHT_ENABLED === 'true';
}

export function getPhoenixInviteCode(): string | undefined {
  const v = process.env.NEXT_PUBLIC_PHOENIX_INVITE_CODE?.trim();
  return v || undefined;
}

export function getPhoenixReferralCode(): string | undefined {
  const v = process.env.NEXT_PUBLIC_PHOENIX_REFERRAL_CODE?.trim();
  return v || undefined;
}

/**
 * When the backend sends Phoenix `funding` in non-hourly units, divide raw by this
 * value before applying the same hourly→APR transform as HL/Pacifica.
 * Prefer fixing the BE contract; this is an escape hatch only.
 */
export function getPhoenixFundingHourlyDivisor(): number {
  const raw = process.env.NEXT_PUBLIC_PHOENIX_FUNDING_HOURLY_DIVISOR;
  const n = raw === undefined || raw === '' ? 1 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
