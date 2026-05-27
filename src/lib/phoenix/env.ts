/**
 * Phoenix + Flight (builder) feature flags and env-backed config.
 * Never hardcode builder secrets; public builder authority is fine in env.
 */

export function isPhoenixTradingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHOENIX_TRADING_ENABLED === 'true';
}

/** UI + deposit gate: master switch only. */
export function isPhoenixTradingConfigured(): boolean {
  return isPhoenixTradingEnabled();
}

/**
 * When true, fail fast if no invite/referral code is available for a new trader.
 * Phoenix private beta requires HTTP activation before deposit/trade.
 */
export function isPhoenixInviteRequired(): boolean {
  return process.env.NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE !== 'false';
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
 * Resolve Phoenix access / referral codes for `POST /v1/invite/*`.
 * Priority: env referral → env invite → user access code (Nuke gate, may match Phoenix invite).
 */
export function resolvePhoenixActivationCodes(userAccessCode?: string | null): {
  referralCode?: string;
  inviteCode?: string;
} {
  const referral = getPhoenixReferralCode();
  if (referral) return { referralCode: referral };

  const invite = getPhoenixInviteCode();
  if (invite) return { inviteCode: invite };

  const userCode = userAccessCode?.trim();
  if (userCode) return { inviteCode: userCode };

  return {};
}

/**
 * @deprecated Use {@link resolvePhoenixActivationCodes} — invite runs whenever codes exist.
 */
export function isPhoenixInviteOnboardingEnabled(): boolean {
  return !!(getPhoenixInviteCode() || getPhoenixReferralCode());
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

/** Sponsored Solana tx fee payer (public address only). */
export function getPhoenixFeePayerAddress(): string | undefined {
  const v =
    process.env.NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS?.trim() ||
    process.env.PHOENIX_FEE_PAYER_ADDRESS?.trim();
  return v || undefined;
}

export function isPhoenixFeePayerConfigured(): boolean {
  return !!getPhoenixFeePayerAddress();
}
