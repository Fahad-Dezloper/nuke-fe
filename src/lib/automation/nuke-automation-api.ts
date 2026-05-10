/**
 * NukeTrade Automation backend (NestJS) — browser client.
 * @see FRONTEND_INTEGRATION.md
 */

import { automationAuthDisabled, getAutomationAuthHeaders } from '@/lib/automation/automation-auth';

const V1 = '/v1';

export function getAutomationApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_AUTOMATION_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function internalApiKey(): string | null {
  return process.env.NEXT_PUBLIC_AUTOMATION_INTERNAL_API_KEY?.trim() || null;
}

export class AutomationApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
    public body?: unknown
  ) {
    super(message);
    this.name = 'AutomationApiError';
  }
}

async function automationRequest<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const base = getAutomationApiBase();
  if (!base) {
    throw new AutomationApiError('NEXT_PUBLIC_AUTOMATION_API_URL is not set', 0);
  }

  const { headers: authHeaders, mode } = getAutomationAuthHeaders();
  const hasAuth =
    (mode === 'jwt' && Boolean(authHeaders.Authorization)) || (mode === 'header' && Boolean(authHeaders['X-User-Id']));
  if (!automationAuthDisabled() && !hasAuth) {
    throw new AutomationApiError(
      mode === 'header'
        ? 'Missing automation user id header. Set NEXT_PUBLIC_AUTOMATION_AUTH_MODE=header and NEXT_PUBLIC_AUTOMATION_X_USER_ID.'
        : 'Missing automation bearer token. Set NEXT_PUBLIC_AUTOMATION_ACCESS_TOKEN (or localStorage nuke-automation-access-token), or enable main-app JWT fallback.',
      401
    );
  }

  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (!automationAuthDisabled()) {
    Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));
  }
  headers.set('Content-Type', 'application/json');
  const ikey = internalApiKey();
  if (ikey) headers.set('X-Internal-Api-Key', ikey);

  const { idempotencyKey, ...fetchInit } = init;
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

  const res = await fetch(url, { ...fetchInit, headers });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    const msg =
      (body && typeof body.message === 'string' && body.message) ||
      `Automation API error (${res.status})`;
    const requestId = body && typeof body.requestId === 'string' ? body.requestId : undefined;
    throw new AutomationApiError(msg, res.status, requestId, body);
  }

  return body as T;
}

// ——— Types (aligned with FRONTEND_INTEGRATION.md) ———

export type AutomationVenues = {
  hyperliquid: boolean;
  pacifica: boolean;
};

export type AutomationLimits = {
  maxNotionalUsd: string;
  maxLeverage: number;
  maxActionsPerDay: number;
};

export type AutomationStrategy = {
  minAprBps: number;
  rebalanceDeltaBps: number;
  closeOnFundingFlip: boolean;
  minRebalanceIntervalSec?: number;
  errorCooldownSec?: number;
};

export type AutomationWallets = {
  evm: string;
  solana: string;
};

export type AutomationEnableBody = {
  subOrgId?: string;
  venues: AutomationVenues;
  limits: AutomationLimits;
  strategy: AutomationStrategy;
  wallets: AutomationWallets;
};

export type AutomationEnableResponse = {
  requestId: string;
  enabled: boolean;
  turnkey?: {
    subOrgId: string;
    delegatedUserId: string;
    policyIds: string[];
  };
};

export type AutomationDisableBody = {
  revokeTurnkey: boolean;
};

export type AutomationDisableResponse = {
  requestId: string;
  enabled: boolean;
};

export type AutomationStatusResponse = {
  requestId: string;
  enabled: boolean;
  venues: AutomationVenues;
  limits: AutomationLimits;
  strategy: AutomationStrategy;
  health: {
    lastRunAt: string | null;
    lastError: string | null;
  };
};

export type AutomationSignalsResponse = {
  requestId: string;
  source: string;
  signals: {
    effectiveAprBps: number;
    intent: string;
    asset: string;
    notionalUsd: string;
  };
};

export type AutomationActionRecord = Record<string, unknown> & { id?: string };

function normalizeActionsPayload(body: unknown): AutomationActionRecord[] {
  if (Array.isArray(body)) return body as AutomationActionRecord[];
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.actions)) return o.actions as AutomationActionRecord[];
    if (Array.isArray(o.data)) return o.data as AutomationActionRecord[];
  }
  return [];
}

// ——— API ———

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function automationEnable(
  body: AutomationEnableBody,
  idempotencyKey: string = newIdempotencyKey()
): Promise<AutomationEnableResponse> {
  return automationRequest<AutomationEnableResponse>(`${V1}/automation/enable`, {
    method: 'POST',
    body: JSON.stringify(body),
    idempotencyKey,
  });
}

export function automationDisable(
  body: AutomationDisableBody,
  idempotencyKey: string = newIdempotencyKey()
): Promise<AutomationDisableResponse> {
  return automationRequest<AutomationDisableResponse>(`${V1}/automation/disable`, {
    method: 'POST',
    body: JSON.stringify(body),
    idempotencyKey,
  });
}

export function automationGetStatus(): Promise<AutomationStatusResponse> {
  return automationRequest<AutomationStatusResponse>(`${V1}/automation/status`, {
    method: 'GET',
  });
}

export function automationGetSignals(): Promise<AutomationSignalsResponse> {
  return automationRequest<AutomationSignalsResponse>(`${V1}/automation/signals`, {
    method: 'GET',
  });
}

export async function automationGetActions(limit = 50): Promise<AutomationActionRecord[]> {
  const base = getAutomationApiBase();
  if (!base) throw new AutomationApiError('NEXT_PUBLIC_AUTOMATION_API_URL is not set', 0);

  const { headers: authHeaders, mode } = getAutomationAuthHeaders();
  const hasAuth =
    (mode === 'jwt' && Boolean(authHeaders.Authorization)) || (mode === 'header' && Boolean(authHeaders['X-User-Id']));
  if (!automationAuthDisabled() && !hasAuth) {
    throw new AutomationApiError(
      mode === 'header'
        ? 'Missing automation user id header. Set NEXT_PUBLIC_AUTOMATION_AUTH_MODE=header and NEXT_PUBLIC_AUTOMATION_X_USER_ID.'
        : 'Missing automation bearer token. Set NEXT_PUBLIC_AUTOMATION_ACCESS_TOKEN (or localStorage nuke-automation-access-token), or enable main-app JWT fallback.',
      401
    );
  }

  const q = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limit))) });
  const url = `${base}${V1}/automation/actions?${q}`;
  const headers = new Headers();
  if (!automationAuthDisabled()) {
    Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));
  }
  const ikey = internalApiKey();
  if (ikey) headers.set('X-Internal-Api-Key', ikey);

  const res = await fetch(url, { method: 'GET', headers });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const o = body as Record<string, unknown> | null;
    const msg =
      (o && typeof o.message === 'string' && o.message) ||
      `Automation API error (${res.status})`;
    const requestId = o && typeof o.requestId === 'string' ? o.requestId : undefined;
    throw new AutomationApiError(msg, res.status, requestId, body);
  }

  return normalizeActionsPayload(body);
}

export type AutomationCancelResponse = {
  requestId: string;
  cancelled: boolean;
  state: string;
};

export function automationCancelAction(actionId: string): Promise<AutomationCancelResponse> {
  return automationRequest<AutomationCancelResponse>(
    `${V1}/automation/actions/${encodeURIComponent(actionId)}/cancel`,
    { method: 'POST' }
  );
}
