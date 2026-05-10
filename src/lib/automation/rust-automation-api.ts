/**
 * Rust automation service (strategy + runs).
 *
 * Base URL: `NEXT_PUBLIC_API_URL` (same as the rest of the app / Rust service).
 * Auth: uses the main app JWT (`getJWT()`), sent on every request.
 *
 * Endpoints referenced by FRONTEND_INTEGRATION.md:
 * - GET/PUT /automation/config
 * - GET /automation/best-pair?mode=NET|SEVEN_D
 * - Runs lifecycle under /automation/runs
 */

import { getJWT } from '@/lib/auth/auth.service';

export class RustAutomationApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = 'RustAutomationApiError';
  }
}

function rustBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
}

function rustAutomationAuthHeaders(): Record<string, string> {
  // Normal mode: send JWT if present
  const jwt = getJWT();
  if (jwt) return { Authorization: `Bearer ${jwt}` };

  // Local testing mode (DISABLE_AUTOMATION_AUTH on Rust):
  // Rust requires X-User-Id even when auth is disabled.
  const xuid =
    process.env.NEXT_PUBLIC_RUST_AUTOMATION_X_USER_ID?.trim() ||
    process.env.NEXT_PUBLIC_AUTOMATION_X_USER_ID?.trim();
  if (xuid) return { 'X-User-Id': xuid };

  return {};
}

async function rustRequest<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  Object.entries(rustAutomationAuthHeaders()).forEach(([k, v]) => headers.set(k, v));

  const url = `${rustBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, headers });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (body && typeof body.message === 'string' && body.message) ||
      `Rust automation API error (${res.status})`;
    throw new RustAutomationApiError(msg, res.status, body);
  }

  return body as T;
}

// Types from AUTOMATION_API.md
export type BestPairMode = 'NET' | 'SEVEN_D';
export type RustAutomationAprMode = BestPairMode;

export type RustAutomationConfigResponse = {
  userId: string;
  aprMode: RustAutomationAprMode;
  minAprToEnter: number; // percent
  exitIfAprBelow: number; // percent
  rebalanceToBetterPair: boolean;
  minRebalanceImprovementBps: number;
  minTimeBetweenActionsSec: number;
  cooldownAfterErrorSec: number;
  maxPositionSizeUsd: number;
  maxLeverage: number;
  maxActionsPerDay: number;
  excludedAssets: string[];
  allowedExchanges: string[];
  maxSlippageBps: number;
  reduceOnlyOnClose: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RustUpsertAutomationConfigRequest = {
  aprMode: BestPairMode | '7D';
  minAprToEnter: number; // percent
  exitIfAprBelow: number; // percent
  rebalanceToBetterPair: boolean;
  minRebalanceImprovementBps: number;
  minTimeBetweenActionsSec: number;
  cooldownAfterErrorSec: number;
  maxPositionSizeUsd: number;
  maxLeverage: number;
  maxActionsPerDay: number;
  excludedAssets: string[];
  allowedExchanges?: string[];
  maxSlippageBps?: number;
  reduceOnlyOnClose?: boolean;
};

export type RustRecommendedLeg = {
  exchange: string;
  side: 'LONG' | 'SHORT';
  weight: number;
};

/** Normalized from GET /automation/best-pair (camelCase or snake_case JSON). */
export type RustBestPairRecommendation = {
  decisionId: string;
  decisionHash: string;
  asset: string | null;
  legs: RustRecommendedLeg[];
  metricMode: string;
  metricValueAprPct: number;
  metricValueRaw: number;
  recommendedAction: string;
  reasons: string[];
  referencePrice?: { symbol: string; px: string; source: string; tsMs: number };
};

function pickStr(r: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function pickNum(r: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function parseRustBestPairRecommendation(raw: unknown): RustBestPairRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const decisionId = pickStr(r, ['decisionId', 'decision_id']);
  if (!decisionId) return null;

  const legs: RustRecommendedLeg[] = [];
  if (Array.isArray(r.legs)) {
    for (const item of r.legs) {
      if (!item || typeof item !== 'object') continue;
      const L = item as Record<string, unknown>;
      const exchange = pickStr(L, ['exchange']);
      const side = pickStr(L, ['side']);
      const weight = pickNum(L, ['weight']) ?? 1;
      if (exchange && (side === 'LONG' || side === 'SHORT')) {
        legs.push({ exchange, side, weight });
      }
    }
  }

  let referencePrice: RustBestPairRecommendation['referencePrice'];
  const refRaw = r.referencePrice ?? r.reference_price;
  if (refRaw && typeof refRaw === 'object') {
    const ref = refRaw as Record<string, unknown>;
    referencePrice = {
      symbol: pickStr(ref, ['symbol']) ?? '',
      px: pickStr(ref, ['px']) ?? '',
      source: pickStr(ref, ['source']) ?? 'mark',
      tsMs: pickNum(ref, ['tsMs', 'ts_ms']) ?? 0,
    };
  }

  const reasonsRaw = r.reasons;
  const reasons = Array.isArray(reasonsRaw)
    ? reasonsRaw.filter((x): x is string => typeof x === 'string')
    : [];

  const assetVal = r.asset;
  const asset = typeof assetVal === 'string' ? assetVal : assetVal === null ? null : null;

  return {
    decisionId,
    decisionHash: pickStr(r, ['decisionHash', 'decision_hash']) ?? '',
    asset,
    legs,
    metricMode: pickStr(r, ['metricMode', 'metric_mode']) ?? 'NET',
    metricValueAprPct: pickNum(r, ['metricValueAprPct', 'metric_value_apr_pct']) ?? 0,
    metricValueRaw: pickNum(r, ['metricValueRaw', 'metric_value_raw']) ?? 0,
    recommendedAction: pickStr(r, ['recommendedAction', 'recommended_action']) ?? 'NOOP_BELOW_MIN',
    reasons,
    referencePrice,
  };
}

export type RustAutomationRunStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED';

export type RustAutomationRunResponse = {
  id: string;
  userId: string;
  status: RustAutomationRunStatus;
  aprMode: BestPairMode;
  minAprToEnter: number;
  exitIfAprBelow: number;
  rebalanceToBetterPair: boolean;
  maxLeverage: number;
  maxActionsPerDay: number;
  configHash: string;
  currentAsset: string | null;
  currentLegs: unknown | null;
  targetMarginUsd: number | null;
  leverage: number | null;
  lastDecisionId: string | null;
  actionsToday: number;
  lastRecommendationAt: string | null;
  lastActionAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  currentHedgeIntentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RustRunActionResponse = { status: 'ok'; message: string };
export type RustAutomationRunAction = Record<string, unknown>;

export function rustAutomationGetConfig(): Promise<RustAutomationConfigResponse> {
  return rustRequest<RustAutomationConfigResponse>('/automation/config', { method: 'GET' });
}

export function rustAutomationPutConfig(
  body: RustUpsertAutomationConfigRequest
): Promise<RustAutomationConfigResponse> {
  return rustRequest<RustAutomationConfigResponse>('/automation/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function rustAutomationGetBestPair(mode: BestPairMode): Promise<RustBestPairRecommendation | null> {
  const q = new URLSearchParams({ mode });
  const raw = await rustRequest<unknown>(`/automation/best-pair?${q}`, { method: 'GET' });
  return parseRustBestPairRecommendation(raw);
}

export type RustCreateRunRequest = {
  targetMarginUsd?: number;
  leverage?: number;
};
export type RustCreateRunResponse = { runId: string };

export function rustAutomationCreateRun(body: RustCreateRunRequest = {}): Promise<RustCreateRunResponse> {
  return rustRequest<RustCreateRunResponse>('/automation/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function rustAutomationListRuns(): Promise<RustAutomationRunResponse[]> {
  return rustRequest<RustAutomationRunResponse[]>('/automation/runs', { method: 'GET' });
}

export function rustAutomationGetRun(id: string): Promise<RustAutomationRunResponse> {
  return rustRequest<RustAutomationRunResponse>(`/automation/runs/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export function rustAutomationPauseRun(id: string): Promise<RustRunActionResponse> {
  return rustRequest<RustRunActionResponse>(`/automation/runs/${encodeURIComponent(id)}/pause`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rustAutomationResumeRun(id: string): Promise<RustRunActionResponse> {
  return rustRequest<RustRunActionResponse>(`/automation/runs/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rustAutomationStopRun(id: string): Promise<RustRunActionResponse> {
  return rustRequest<RustRunActionResponse>(`/automation/runs/${encodeURIComponent(id)}/stop`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rustAutomationRestartRun(id: string): Promise<RustRunActionResponse> {
  return rustRequest<RustRunActionResponse>(`/automation/runs/${encodeURIComponent(id)}/restart`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rustAutomationGetRunActions(id: string): Promise<RustAutomationRunAction[]> {
  return rustRequest<RustAutomationRunAction[]>(
    `/automation/runs/${encodeURIComponent(id)}/actions`,
    { method: 'GET' }
  );
}

