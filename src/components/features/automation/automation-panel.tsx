'use client';

/**
 * Full-page automation configuration and live status (separate from manual trading).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { useHedgeIntent } from '@/lib/hedge-intent/use-hedge-intent';
import type { Exchange } from '@/lib/hedge-intent/types';
import { useClosePosition } from '@/hooks/use-close-position';
import { usePositions } from '@/hooks/use-positions';
import {
  AUTOMATION_EXCHANGES,
  type AutomationExchangeId,
  isNestAutomationVenue,
} from '@/lib/automation/exchanges';
import {
  AutomationApiError,
  automationCancelAction,
  automationDisable,
  automationEnable,
  automationGetActions,
  automationGetSignals,
  automationGetStatus,
  getAutomationApiBase,
  newIdempotencyKey,
  type AutomationActionRecord,
  type AutomationSignalsResponse,
  type AutomationStatusResponse,
} from '@/lib/automation/nuke-automation-api';
import { useAuth } from '@/lib/auth/use-auth';
import { automationAuthDisabled, getAutomationAuthHeaders } from '@/lib/automation/automation-auth';
import {
  RustAutomationApiError,
  rustAutomationCreateRun,
  rustAutomationGetBestPair,
  rustAutomationGetConfig,
  rustAutomationGetRunActions,
  rustAutomationListRuns,
  rustAutomationPauseRun,
  rustAutomationPutConfig,
  rustAutomationResumeRun,
  rustAutomationStopRun,
  type BestPairMode,
  type RustAutomationConfigResponse,
  type RustBestPairRecommendation,
  type RustRecommendedLeg,
  type RustAutomationRunResponse,
  type RustAutomationRunAction,
} from '@/lib/automation/rust-automation-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, HelpCircle, Loader2, Save, X } from 'lucide-react';

const DRAFT_KEY = 'nuke-automation-draft-v1';

type DraftShape = {
  exchanges: AutomationExchangeId[];
  minAPR: number;
  exitAPR: number;
  maxSize: number;
  maxLeverage: number;
  maxActionsPerDay: number;
  blocklist: string[];
  rebalance: boolean;
};

type UiBadge = 'IDLE' | 'SCANNING' | 'ACTIVE' | 'ERROR';

const ALL_EXCHANGE_IDS = AUTOMATION_EXCHANGES.map((e) => e.id) as AutomationExchangeId[];

/**
 * Demo / video: do not call Nest automation or Rust runs — only Rust best-pair preview + real
 * hedge-intent open/close (same stack as Funding Arbitrage on the home page).
 * Set to `false` to restore full executor + Rust orchestration.
 */
const AUTOMATION_DEMO_HEDGE_ONLY = true;

const AUTOMATION_DEMO_PERSIST_KEY = 'nuke-automation-demo-active-v1';

type DemoFarmingCard = {
  asset: string;
  assetIconUrl: string;
  pairLabel: string;
  aprPercent: number;
  sizeUsd: number;
  pnlUsd: number;
  openedAt: string;
};

type DemoPersistedPayload = {
  v: 1;
  farming: DemoFarmingCard;
  demoLastRunAt: number;
  /** Used to recompute sizeUsd if missing (e.g. older saved state). */
  marginUsd: number;
  leverage: number;
};

function loadDemoPersisted(): DemoPersistedPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTOMATION_DEMO_PERSIST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<DemoPersistedPayload>;
    if (p.v !== 1 || !p.farming?.asset) return null;
    const marginUsd = typeof p.marginUsd === 'number' ? p.marginUsd : 0;
    const lev = typeof p.leverage === 'number' ? p.leverage : 0;
    const sizeUsd =
      typeof p.farming.sizeUsd === 'number' && p.farming.sizeUsd > 0
        ? p.farming.sizeUsd
        : marginUsd * lev;
    return {
      v: 1,
      farming: {
        ...p.farming,
        sizeUsd,
        assetIconUrl:
          p.farming.assetIconUrl ||
          `https://app.hyperliquid.xyz/coins/${encodeURIComponent(p.farming.asset)}.svg`,
      },
      demoLastRunAt: typeof p.demoLastRunAt === 'number' ? p.demoLastRunAt : Date.now(),
      marginUsd,
      leverage: lev,
    };
  } catch {
    return null;
  }
}

function saveDemoPersisted(payload: DemoPersistedPayload) {
  try {
    localStorage.setItem(AUTOMATION_DEMO_PERSIST_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

function clearDemoPersisted() {
  try {
    localStorage.removeItem(AUTOMATION_DEMO_PERSIST_KEY);
  } catch {
    /* noop */
  }
}

function hedgePairFromRecommendedLegs(legs: RustRecommendedLeg[]): {
  long: Exchange;
  short: Exchange;
} {
  const longLeg = legs.find((l) => l.side === 'LONG');
  const shortLeg = legs.find((l) => l.side === 'SHORT');
  if (!longLeg || !shortLeg) {
    throw new Error('Recommendation must include LONG and SHORT legs');
  }
  return {
    long: longLeg.exchange.toLowerCase() as Exchange,
    short: shortLeg.exchange.toLowerCase() as Exchange,
  };
}

function actionIdFromRecord(row: AutomationActionRecord): string {
  const id = row.id ?? row.actionId;
  return typeof id === 'string' ? id : JSON.stringify(row).slice(0, 80);
}

function farmingFromSignals(signals: AutomationSignalsResponse | null, enabled: boolean) {
  if (!signals || !enabled) return null;
  const { intent, asset, effectiveAprBps, notionalUsd } = signals.signals;
  if (intent === 'none') return null;
  const n = parseFloat(notionalUsd || '0');
  return {
    asset,
    assetIconUrl: `https://app.hyperliquid.xyz/coins/${encodeURIComponent(asset)}.svg`,
    pairLabel: `${intent} · ${signals.source}`,
    aprPercent: effectiveAprBps / 100,
    sizeUsd: Number.isFinite(n) ? n : 0,
    pnlUsd: 0,
    openedAt: new Date().toISOString(),
  };
}

function badgeFromApi(
  status: AutomationStatusResponse | null,
  signals: AutomationSignalsResponse | null
): UiBadge {
  if (!status) return 'IDLE';
  if (status.health.lastError) return 'ERROR';
  if (!status.enabled) return 'IDLE';
  if (signals && signals.signals.intent !== 'none') return 'ACTIVE';
  return 'SCANNING';
}

function loadDraft(): DraftShape | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<DraftShape>;
    if (!p.exchanges?.length) return null;
    return {
      exchanges: p.exchanges,
      minAPR: p.minAPR ?? 4,
      exitAPR: p.exitAPR ?? 2,
      maxSize: p.maxSize ?? 100,
      maxLeverage: p.maxLeverage ?? 3,
      maxActionsPerDay: p.maxActionsPerDay ?? 20,
      blocklist: p.blocklist ?? [],
      rebalance: p.rebalance ?? true,
    };
  } catch {
    return null;
  }
}

function saveDraftLocal(d: DraftShape) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

function formatAgo(ms: number): string {
  if (!ms) return '—';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function normalizeRustAprMode(m: string | undefined | null): BestPairMode {
  if (m === 'SEVEN_D' || m === '7D') return 'SEVEN_D';
  return 'NET';
}

/** Prefer ACTIVE; else most recently updated. `pendingId` covers a run not yet listed after create. */
function pickResolvedRunId(
  runs: RustAutomationRunResponse[],
  pendingId: string | null
): string | null {
  if (pendingId && !runs.some((r) => r.id === pendingId)) {
    return pendingId;
  }
  const active = runs.filter((r) => r.status === 'ACTIVE');
  if (active.length > 0) {
    active.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return active[0].id;
  }
  if (runs.length === 0) return pendingId || null;
  const sorted = [...runs].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return sorted[0]?.id ?? null;
}

function RuleTooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex text-text-muted-40 hover:text-text-muted-60 ml-1 align-middle"
          aria-label="Help"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs font-mono text-[11px] leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function AutomationPanel() {
  /** Subscribes to login state so we re-read the main-app JWT when fallback auth is used. */
  const { isAuthenticated } = useAuth();
  void isAuthenticated;
  const { headers: automationAuthHeaders, mode: automationAuthMode } = getAutomationAuthHeaders();
  const automationAuthReady =
    automationAuthDisabled() ||
    (automationAuthMode === 'jwt' && Boolean(automationAuthHeaders.Authorization)) ||
    (automationAuthMode === 'header' && Boolean(automationAuthHeaders['X-User-Id']));
  const { state: turnkeyState } = useTurnkey();
  const evm = getEVMAddress(turnkeyState.userWallets);
  const solana = getSolanaAddress(turnkeyState.userWallets);
  const subOrgId = turnkeyState.turnkeySubOrgId;
  const isWalletReady = turnkeyState.isLoggedIn && Boolean(evm) && Boolean(solana);
  const _rustBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const _executorBase = getAutomationApiBase() || 'http://localhost:3008';
  void [_rustBase, _executorBase];
  const rustUrlConfigured = Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
  const fullyConfigured = rustUrlConfigured && Boolean(getAutomationApiBase());
  const showTopOpportunity = AUTOMATION_DEMO_HEDGE_ONLY ? rustUrlConfigured : fullyConfigured;

  const [selected, setSelected] = useState<Set<AutomationExchangeId>>(() => {
    if (getAutomationApiBase()) return new Set(ALL_EXCHANGE_IDS.filter(isNestAutomationVenue));
    return new Set(ALL_EXCHANGE_IDS);
  });
  const [minAPR, setMinAPR] = useState(4);
  const [exitAPR, setExitAPR] = useState(2);
  const [rebalance, setRebalance] = useState(true);
  const [maxSize, setMaxSize] = useState(100);
  const [maxLeverage, setMaxLeverage] = useState(3);
  const [maxActionsPerDay, setMaxActionsPerDay] = useState(20);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [blockInput, setBlockInput] = useState('');

  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [rustConfig, setRustConfig] = useState<RustAutomationConfigResponse | null>(null);
  const [rustRecommendation, setRustRecommendation] = useState<RustBestPairRecommendation | null>(
    null
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runActions, setRunActions] = useState<RustAutomationRunAction[]>([]);
  const [apiStatus, setApiStatus] = useState<AutomationStatusResponse | null>(null);
  const [apiSignals, setApiSignals] = useState<AutomationSignalsResponse | null>(null);
  const [apiActions, setApiActions] = useState<AutomationActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [revokeOnStop, setRevokeOnStop] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const apiFormHydratedRef = useRef(false);
  const pendingRunIdRef = useRef<string | null>(null);

  const [demoAutomationOn, setDemoAutomationOn] = useState(false);
  const [demoFarmingView, setDemoFarmingView] = useState<DemoFarmingCard | null>(null);
  const [demoLastRunAt, setDemoLastRunAt] = useState(0);
  const pendingDemoHedgeRef = useRef(false);
  const demoOpenContextRef = useRef<{
    rec: RustBestPairRecommendation;
    margin: number;
    leverage: number;
  } | null>(null);
  const { openHedge, phase } = useHedgeIntent();
  const { rawPositions, refetch: refetchPositions } = usePositions({
    evmAddress: evm || undefined,
    solanaAddress: solana || undefined,
    enabled: isWalletReady,
  });
  const { closePosition } = useClosePosition({
    evmAddress: evm || '',
    solanaAddress: solana || '',
    organizationId: subOrgId || '',
    onSuccess: () => {
      void refetchPositions();
    },
  });

  useEffect(() => {
    if (!AUTOMATION_DEMO_HEDGE_ONLY || !pendingDemoHedgeRef.current) return;
    if (phase === 'complete') {
      pendingDemoHedgeRef.current = false;
      const ctx = demoOpenContextRef.current;
      demoOpenContextRef.current = null;
      const assetSym = ctx?.rec.asset;
      if (assetSym && ctx) {
        const { rec, margin, leverage: lev } = ctx;
        const marginUsd = Number(margin);
        const leverageNum = Number(lev);
        const sizeUsd = Math.max(0, marginUsd * leverageNum);
        const pairLabel = rec.legs.map((l) => `${l.exchange} ${l.side}`).join(' · ') || 'hedge';
        const farming: DemoFarmingCard = {
          asset: assetSym,
          assetIconUrl: `https://app.hyperliquid.xyz/coins/${encodeURIComponent(assetSym)}.svg`,
          pairLabel,
          aprPercent: rec.metricValueAprPct,
          sizeUsd,
          pnlUsd: 0,
          openedAt: new Date().toISOString(),
        };
        const runAt = Date.now();
        setDemoAutomationOn(true);
        setDemoFarmingView(farming);
        setDemoLastRunAt(runAt);
        saveDemoPersisted({
          v: 1,
          farming,
          demoLastRunAt: runAt,
          marginUsd,
          leverage: leverageNum,
        });
      }
    } else if (phase === 'failed') {
      pendingDemoHedgeRef.current = false;
      demoOpenContextRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (!AUTOMATION_DEMO_HEDGE_ONLY) return;
    const persisted = loadDemoPersisted();
    if (!persisted) return;
    setDemoAutomationOn(true);
    setDemoFarmingView(persisted.farming);
    setDemoLastRunAt(persisted.demoLastRunAt);
  }, []);

  const executorEnabled = apiStatus?.enabled ?? false;
  const configLocked = AUTOMATION_DEMO_HEDGE_ONLY ? demoAutomationOn : executorEnabled;

  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setSelected(new Set(d.exchanges));
      setMinAPR(d.minAPR);
      setExitAPR(d.exitAPR);
      setMaxSize(d.maxSize);
      if (typeof d.maxLeverage === 'number') setMaxLeverage(d.maxLeverage);
      if (typeof d.maxActionsPerDay === 'number') setMaxActionsPerDay(d.maxActionsPerDay);
      setBlocklist(d.blocklist);
      setRebalance(d.rebalance);
    }
  }, []);

  const hydratedFromApi = useCallback((st: AutomationStatusResponse) => {
    const sel = new Set<AutomationExchangeId>();
    if (st.venues.hyperliquid) sel.add('hyperliquid');
    if (st.venues.pacifica) sel.add('pacifica');
    if (sel.size) setSelected(sel);
    setMinAPR(st.strategy.minAprBps / 100);
    const exitBps = Math.max(0, st.strategy.minAprBps - st.strategy.rebalanceDeltaBps);
    setExitAPR(exitBps / 100);
    setMaxSize(parseFloat(st.limits.maxNotionalUsd) || 100);
    setMaxLeverage(st.limits.maxLeverage);
    setMaxActionsPerDay(st.limits.maxActionsPerDay);
    setRebalance(st.strategy.closeOnFundingFlip);
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (AUTOMATION_DEMO_HEDGE_ONLY) {
        const cfg = await rustAutomationGetConfig().catch(() => null);
        if (cfg) setRustConfig(cfg);
        const bpMode: BestPairMode = cfg ? normalizeRustAprMode(cfg.aprMode) : 'NET';
        const rec = await rustAutomationGetBestPair(bpMode).catch(() => null);
        setRustRecommendation(rec);
        return;
      }

      const [cfg, st, sig, nodeActs, rustRuns] = await Promise.all([
        rustAutomationGetConfig().catch(() => null),
        automationGetStatus(),
        automationGetSignals(),
        automationGetActions(50),
        rustAutomationListRuns().catch(() => [] as RustAutomationRunResponse[]),
      ]);

      if (cfg) setRustConfig(cfg);
      setApiStatus(st);
      setApiSignals(sig);
      setApiActions(nodeActs);

      const bpMode: BestPairMode = cfg ? normalizeRustAprMode(cfg.aprMode) : 'NET';
      const rec = await rustAutomationGetBestPair(bpMode).catch(() => null);
      setRustRecommendation(rec);

      const pending = pendingRunIdRef.current;
      const resolvedRunId = pickResolvedRunId(rustRuns, pending);
      if (pending && rustRuns.some((r) => r.id === pending)) {
        pendingRunIdRef.current = null;
      }
      setActiveRunId(resolvedRunId);
      if (resolvedRunId) {
        setRunActions(
          await rustAutomationGetRunActions(resolvedRunId).catch(
            () => [] as RustAutomationRunAction[]
          )
        );
      } else {
        setRunActions([]);
      }

      if (!st.enabled) apiFormHydratedRef.current = false;
      else if (!apiFormHydratedRef.current) {
        apiFormHydratedRef.current = true;
        hydratedFromApi(st);
      }
    } catch (e) {
      const msg =
        e instanceof AutomationApiError
          ? e.message
          : e instanceof RustAutomationApiError
            ? e.message
            : 'Failed to load automation';
      toast.error(msg);
      if (e instanceof AutomationApiError && e.requestId) {
        console.warn('[automation] requestId', e.requestId);
      }
    } finally {
      setLoading(false);
    }
  }, [hydratedFromApi]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
      setNowTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const draftPayload: DraftShape = {
    exchanges: Array.from(selected),
    minAPR,
    exitAPR,
    maxSize,
    maxLeverage,
    maxActionsPerDay,
    blocklist,
    rebalance,
  };

  const handleSaveDraft = () => {
    saveDraftLocal(draftPayload);
    toast.success('Draft saved locally');
  };

  const toggleExchange = (id: AutomationExchangeId) => {
    if (configLocked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setExchangeError(null);
  };

  const validateExchanges = (): boolean => {
    const nestOn = Array.from(selected).filter(isNestAutomationVenue);
    if (nestOn.length < 1) {
      setExchangeError('Select at least one automation venue (Hyperliquid and/or Pacifica).');
      return false;
    }
    setExchangeError(null);
    return true;
  };

  const validateRules = (): boolean => {
    if (exitAPR >= minAPR) {
      setRulesError('Exit threshold must be lower than entry threshold.');
      return false;
    }
    setRulesError(null);
    return true;
  };

  const handleStartClick = () => {
    if (!validateExchanges() || !validateRules()) return;
    if (!isWalletReady) {
      toast.error('Connect Turnkey with EVM and Solana wallets before starting automation.');
      return;
    }
    if (AUTOMATION_DEMO_HEDGE_ONLY) {
      if (!rustUrlConfigured) {
        toast.error('Set NEXT_PUBLIC_API_URL so the Rust service can return a top opportunity.');
        return;
      }
      if (!rustRecommendation?.asset) {
        toast.error('No top opportunity yet — wait for Rust best-pair or check your connection.');
        return;
      }
      if (
        rustRecommendation.recommendedAction !== 'OPEN' &&
        rustRecommendation.recommendedAction !== 'REBALANCE'
      ) {
        toast.error('Engine is not suggesting OPEN right now — try again when Suggested is OPEN.');
        return;
      }
      setConfirmOpen(true);
      return;
    }
    if (!fullyConfigured) {
      toast.error(
        'Automation requires both backends: set NEXT_PUBLIC_API_URL (Rust) and NEXT_PUBLIC_AUTOMATION_API_URL (Node executor).'
      );
      return;
    }
    if (!automationAuthReady && !automationAuthDisabled()) {
      toast.error(
        'Automation API token missing. Set NEXT_PUBLIC_AUTOMATION_ACCESS_TOKEN, store a token in localStorage, or sign in with main-app JWT if fallback is enabled.'
      );
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmStart = async () => {
    setConfirmOpen(false);
    if (!validateExchanges() || !validateRules()) return;

    if (AUTOMATION_DEMO_HEDGE_ONLY) {
      const rec = rustRecommendation;
      if (!rec?.asset) {
        toast.error('No asset in top opportunity.');
        return;
      }
      if (!evm || !solana) {
        toast.error('EVM and Solana addresses are required.');
        return;
      }
      setActionLoading(true);
      pendingDemoHedgeRef.current = true;
      demoOpenContextRef.current = { rec, margin: maxSize, leverage: maxLeverage };
      const asset = rec.asset;
      const { long: longExchange, short: shortExchange } = hedgePairFromRecommendedLegs(rec.legs);
      try {
        await openHedge({
          asset,
          marginUsd: maxSize,
          leverage: maxLeverage,
          longExchange,
          shortExchange,
        });
      } finally {
        setActionLoading(false);
      }
      return;
    }

    setActionLoading(true);
    try {
      if (!evm || !solana) {
        toast.error('EVM and Solana addresses are required for automation.');
        return;
      }

      await rustAutomationPutConfig({
        aprMode: normalizeRustAprMode(rustConfig?.aprMode),
        minAprToEnter: minAPR,
        exitIfAprBelow: exitAPR,
        rebalanceToBetterPair: rebalance,
        minRebalanceImprovementBps: 50,
        minTimeBetweenActionsSec: 300,
        cooldownAfterErrorSec: 900,
        maxPositionSizeUsd: Number(maxSize),
        maxLeverage: Math.min(125, Math.max(1, Math.floor(maxLeverage))),
        maxActionsPerDay: Math.max(1, Math.floor(maxActionsPerDay)),
        excludedAssets: blocklist,
        allowedExchanges: Array.from(selected).filter(isNestAutomationVenue),
        maxSlippageBps: 50,
        reduceOnlyOnClose: true,
      });

      const res = await automationEnable(
        {
          subOrgId: subOrgId ?? undefined,
          venues: {
            hyperliquid: selected.has('hyperliquid'),
            pacifica: selected.has('pacifica'),
          },
          limits: {
            maxNotionalUsd: String(maxSize),
            maxLeverage: Math.min(125, Math.max(1, Math.floor(maxLeverage))),
            maxActionsPerDay: Math.max(1, Math.floor(maxActionsPerDay)),
          },
          strategy: {
            minAprBps: Math.round(minAPR * 100),
            rebalanceDeltaBps: Math.max(1, Math.round((minAPR - exitAPR) * 100)),
            closeOnFundingFlip: rebalance,
          },
          wallets: { evm, solana },
        },
        newIdempotencyKey()
      );

      const run = await rustAutomationCreateRun({});
      if (typeof run?.runId === 'string') pendingRunIdRef.current = run.runId;

      toast.success('Automation started', {
        description: res.requestId ? `executor requestId: ${res.requestId}` : undefined,
      });
      await refresh();
    } catch (e) {
      const msg =
        e instanceof AutomationApiError
          ? e.message
          : e instanceof RustAutomationApiError
            ? e.message
            : 'Enable failed';
      toast.error(msg);
      if (e instanceof AutomationApiError && e.requestId) {
        console.warn('[automation] requestId', e.requestId);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (AUTOMATION_DEMO_HEDGE_ONLY) return;
    if (!activeRunId) return;
    setActionLoading(true);
    try {
      await rustAutomationPauseRun(activeRunId);
      toast.message('Automation run paused');
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (AUTOMATION_DEMO_HEDGE_ONLY) return;
    if (!activeRunId) return;
    setActionLoading(true);
    try {
      await rustAutomationResumeRun(activeRunId);
      toast.message('Automation run resumed');
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmStop = async () => {
    if (AUTOMATION_DEMO_HEDGE_ONLY) {
      setActionLoading(true);
      try {
        setStopConfirmOpen(false);
        const symbol = demoFarmingView?.asset;
        if (symbol) {
          const raw = rawPositions.find((p) => p.symbol === symbol);
          if (raw) await closePosition(raw);
          else toast.message('No open position row for this asset — clearing demo state.');
        }
        setDemoAutomationOn(false);
        setDemoFarmingView(null);
        setDemoLastRunAt(Date.now());
        clearDemoPersisted();
        toast.success('Automation stopped');
        await refetchPositions();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Close failed');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (!activeRunId) return;
    setActionLoading(true);
    try {
      pendingRunIdRef.current = null;
      await rustAutomationStopRun(activeRunId);
      const res = await automationDisable({ revokeTurnkey: revokeOnStop }, newIdempotencyKey());
      setStopConfirmOpen(false);
      toast.message(
        revokeOnStop ? 'Automation stopped; Turnkey delegation revoked' : 'Automation stopped',
        {
          description: res.requestId ? `requestId: ${res.requestId}` : undefined,
        }
      );
      await refresh();
    } catch (e) {
      const msg = e instanceof AutomationApiError ? e.message : 'Disable failed';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelQueuedAction = async (actionId: string) => {
    if (AUTOMATION_DEMO_HEDGE_ONLY) return;
    try {
      const res = await automationCancelAction(actionId);
      toast.message(res.cancelled ? 'Action cancelled' : 'Action could not be cancelled', {
        description: `${res.state} · ${res.requestId}`,
      });
      await refresh();
    } catch (e) {
      const msg = e instanceof AutomationApiError ? e.message : 'Cancel failed';
      toast.error(msg);
    }
  };

  void nowTick;

  const running = AUTOMATION_DEMO_HEDGE_ONLY ? demoAutomationOn : executorEnabled;
  const currentFarming =
    AUTOMATION_DEMO_HEDGE_ONLY && demoFarmingView
      ? demoFarmingView
      : farmingFromSignals(apiSignals, running);

  const uiBadge: UiBadge = AUTOMATION_DEMO_HEDGE_ONLY
    ? demoAutomationOn
      ? demoFarmingView
        ? 'ACTIVE'
        : 'SCANNING'
      : 'IDLE'
    : badgeFromApi(apiStatus, apiSignals);

  const lastRunMs = AUTOMATION_DEMO_HEDGE_ONLY
    ? demoLastRunAt
    : apiStatus?.health.lastRunAt
      ? Date.parse(apiStatus.health.lastRunAt)
      : 0;

  const badgeClass = (s: UiBadge) => {
    switch (s) {
      case 'IDLE':
        return 'bg-white/10 text-text-muted-60 border-border-white-10';
      case 'SCANNING':
        return 'bg-[var(--chart-dark-blue)]/40 text-accent border-[var(--chart-hyperliquid)]/40 animate-pulse';
      case 'ACTIVE':
        return 'bg-green-500/15 text-green-400 border-green-500/30';
      case 'ERROR':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      default:
        return 'bg-white/10 text-text-muted-60';
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-text-muted-60">
        <Loader2 className="size-6 animate-spin mr-2" />
        Loading automation…
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-3 md:px-5 py-6 md:py-8 font-mono text-sm">
          <header className="mb-8 border-b border-border-white-10 pb-4">
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-text-primary">
              AUTOMATION
            </h1>
            <p className="mt-1 text-xs text-text-muted-60 max-w-2xl leading-relaxed">
              Backend-managed funding arbitrage. Separate from manual positions. When running, the
              engine scans selected venues and may open or close hedged legs automatically.
            </p>
          </header>

          {/* <div className="mb-6 rounded-md border border-border-white-10 bg-card/30 px-3 py-2 text-[11px] text-text-muted-60 leading-relaxed">
            <div>
              Rust service:{' '}
              <span className="text-text-primary">{_rustBase}</span>{' '}
              <span className="text-text-muted-40">(NEXT_PUBLIC_API_URL)</span>
            </div>
            <div>
              Node executor:{' '}
              <span className="text-text-primary">{_executorBase}</span>{' '}
              <span className="text-text-muted-40">(NEXT_PUBLIC_AUTOMATION_API_URL)</span>
            </div>
            {!fullyConfigured ? (
              <div className="mt-2 text-yellow-200/90">
                Missing env(s): set both <code className="text-yellow-100/90">NEXT_PUBLIC_API_URL</code>{' '}
                and <code className="text-yellow-100/90">NEXT_PUBLIC_AUTOMATION_API_URL</code>.
              </div>
            ) : null}
          </div> */}

          {!isWalletReady && (
            <div className="mb-6 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200/90">
              Connect Turnkey with EVM and Solana wallets.
              {AUTOMATION_DEMO_HEDGE_ONLY
                ? ' Start automation uses the same hedge-intent signing flow as Funding Arbitrage.'
                : ' Delegated signing is provisioned when you call POST /v1/automation/enable.'}
            </div>
          )}

          {!AUTOMATION_DEMO_HEDGE_ONLY &&
            fullyConfigured &&
            !automationAuthReady &&
            !automationAuthDisabled() && (
              <div className="mb-6 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200/90 leading-relaxed">
                Automation auth missing. If executor uses{' '}
                <code className="text-orange-100/90">AUTH_MODE=jwt</code>, set{' '}
                <code className="text-orange-100/90">NEXT_PUBLIC_AUTOMATION_ACCESS_TOKEN</code> (or
                store one under{' '}
                <code className="text-orange-100/90">nuke-automation-access-token</code> in
                localStorage). If it uses{' '}
                <code className="text-orange-100/90">AUTH_MODE=header</code>, set{' '}
                <code className="text-orange-100/90">NEXT_PUBLIC_AUTOMATION_AUTH_MODE=header</code>{' '}
                and <code className="text-orange-100/90">NEXT_PUBLIC_AUTOMATION_X_USER_ID</code>.
              </div>
            )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {/* LEFT — Configuration */}
            <div className="space-y-8">
              <section>
                <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-3">
                  EXCHANGES
                </h2>
                <div className="flex flex-wrap gap-2">
                  {AUTOMATION_EXCHANGES.map((ex) => {
                    const on = selected.has(ex.id);
                    const apiUnsupported = !isNestAutomationVenue(ex.id);
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        disabled={configLocked || apiUnsupported}
                        title={
                          apiUnsupported
                            ? 'Automation API currently supports Hyperliquid and Pacifica only.'
                            : undefined
                        }
                        onClick={() => toggleExchange(ex.id)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors',
                          on
                            ? 'border-accent/50 bg-accent/10 text-text-primary'
                            : 'border-border-white-10 bg-card/40 text-text-muted-60 hover:border-border-white-20',
                          (configLocked || apiUnsupported) && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <Image
                          src={ex.logo.src}
                          alt={ex.logo.alt}
                          width={18}
                          height={18}
                          className={cn(
                            'shrink-0',
                            'className' in ex.logo ? ex.logo.className : undefined
                          )}
                        />
                        {ex.label}
                      </button>
                    );
                  })}
                </div>
                {exchangeError && <p className="mt-2 text-xs text-red-400">{exchangeError}</p>}
              </section>

              <section>
                <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-3">
                  RULES
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center text-xs text-text-muted-60 mb-1">
                      Min APR to enter
                      <RuleTooltip text="Automation will only open a position if the best available APR across selected exchanges is above this threshold.">
                        <HelpCircle className="size-3.5" />
                      </RuleTooltip>
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step={0.01}
                        min={0}
                        disabled={configLocked}
                        value={minAPR}
                        onChange={(e) => setMinAPR(parseFloat(e.target.value) || 0)}
                        className="pr-8 font-mono tabular-nums"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-40 text-xs">
                        %
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center text-xs text-text-muted-60 mb-1">
                      Exit if APR drops below
                      <RuleTooltip text="Open position will be closed if APR falls below this value.">
                        <HelpCircle className="size-3.5" />
                      </RuleTooltip>
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step={0.01}
                        min={0}
                        disabled={configLocked}
                        value={exitAPR}
                        onChange={(e) => setExitAPR(parseFloat(e.target.value) || 0)}
                        className="pr-8 font-mono tabular-nums"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-40 text-xs">
                        %
                      </span>
                    </div>
                  </div>
                  {rulesError && <p className="text-xs text-red-400">{rulesError}</p>}
                  <div className="flex items-center justify-between rounded-md border border-border-white-10 bg-card/30 px-3 py-2">
                    <span className="text-xs text-text-muted-60 flex items-center gap-1">
                      Rebalance to better pair
                      <RuleTooltip text="If a better APR pair is found, automation will close the current position and reopen on the better pair.">
                        <HelpCircle className="size-3.5" />
                      </RuleTooltip>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rebalance}
                      disabled={configLocked}
                      onClick={() => !configLocked && setRebalance((v) => !v)}
                      className={cn(
                        'relative h-6 w-11 rounded-full transition-colors',
                        rebalance ? 'bg-accent/40' : 'bg-white/10',
                        configLocked && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 size-5 rounded-full bg-text-primary transition-transform',
                          rebalance ? 'left-5' : 'left-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-3">
                  LIMITS
                </h2>
                <div>
                  <label className="flex items-center text-xs text-text-muted-60 mb-1">
                    Margin
                    <RuleTooltip text="Total margin in USD for the hedge (split across legs, same as Funding Arbitrage).">
                      <HelpCircle className="size-3.5" />
                    </RuleTooltip>
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step={1}
                      min={1}
                      disabled={configLocked}
                      value={maxSize}
                      onChange={(e) => setMaxSize(parseFloat(e.target.value) || 0)}
                      className="pr-12 font-mono tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-40 text-xs">
                      USD
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="flex items-center text-xs text-text-muted-60 mb-1">
                      Leverage
                      <RuleTooltip text="Per-leg leverage (1–125), same as the main hedge flow.">
                        <HelpCircle className="size-3.5" />
                      </RuleTooltip>
                    </label>
                    <Input
                      type="number"
                      step={1}
                      min={1}
                      max={125}
                      disabled={configLocked}
                      value={maxLeverage}
                      onChange={(e) => setMaxLeverage(parseInt(e.target.value, 10) || 1)}
                      className="font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-xs text-text-muted-60 mb-1">
                      Max actions / day
                      <RuleTooltip text="Sent as automation limits.maxActionsPerDay.">
                        <HelpCircle className="size-3.5" />
                      </RuleTooltip>
                    </label>
                    <Input
                      type="number"
                      step={1}
                      min={1}
                      disabled={configLocked}
                      value={maxActionsPerDay}
                      onChange={(e) => setMaxActionsPerDay(parseInt(e.target.value, 10) || 1)}
                      className="font-mono tabular-nums"
                    />
                  </div>
                </div>
              </section>

              <details className="group rounded-md border border-border-white-10 bg-card/20 open:bg-card/30">
                <summary className="cursor-pointer list-none flex items-center justify-between px-3 py-2 text-xs text-text-muted-60 hover:text-text-primary">
                  <span className="tracking-widest text-[11px]">EXCLUDE ASSETS (optional)</span>
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-3 pb-3 pt-0 space-y-2">
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {blocklist.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded border border-border-white-10 bg-background px-2 py-0.5 text-[11px] text-text-muted-80"
                      >
                        {tag}
                        <button
                          type="button"
                          disabled={configLocked}
                          onClick={() =>
                            !configLocked && setBlocklist((b) => b.filter((x) => x !== tag))
                          }
                          className="text-text-muted-40 hover:text-text-primary disabled:opacity-40"
                          aria-label={`Remove ${tag}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <Input
                    disabled={configLocked}
                    placeholder="Type symbol, Enter to add (e.g. WIF)"
                    value={blockInput}
                    onChange={(e) => setBlockInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || configLocked) return;
                      e.preventDefault();
                      const t = blockInput.trim();
                      if (!t || blocklist.includes(t)) return;
                      setBlocklist((b) => [...b, t]);
                      setBlockInput('');
                    }}
                    className="font-mono text-xs h-8"
                  />
                </div>
              </details>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-border-white-10 text-text-muted-60 hover:text-text-primary"
                  onClick={handleSaveDraft}
                  disabled={configLocked}
                >
                  <Save className="size-4" />
                  Save draft (local)
                </Button>

                {!running && (
                  <Button
                    type="button"
                    className="w-full h-12 font-mono text-sm bg-green-600 hover:bg-green-600/90 text-white"
                    disabled={
                      actionLoading ||
                      !isWalletReady ||
                      (!AUTOMATION_DEMO_HEDGE_ONLY &&
                        !automationAuthReady &&
                        !automationAuthDisabled())
                    }
                    onClick={handleStartClick}
                  >
                    {actionLoading ? <Loader2 className="animate-spin" /> : null}
                    START AUTOMATION
                  </Button>
                )}
                {running ? (
                  <Button
                    type="button"
                    className="w-full h-12 font-mono text-sm bg-red-600 hover:bg-red-600/90 text-white"
                    disabled={actionLoading}
                    onClick={() => setStopConfirmOpen(true)}
                  >
                    STOP AUTOMATION
                  </Button>
                ) : null}

                {!AUTOMATION_DEMO_HEDGE_ONLY && activeRunId ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-border-white-10 text-text-muted-60 hover:text-text-primary"
                      disabled={actionLoading}
                      onClick={() => void handlePause()}
                    >
                      PAUSE RUN
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-border-white-10 text-text-muted-60 hover:text-text-primary"
                      disabled={actionLoading}
                      onClick={() => void handleResume()}
                    >
                      RESUME RUN
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* RIGHT — Status */}
            <div className="space-y-8">
              {showTopOpportunity && rustRecommendation?.asset ? (
                <section className="rounded-md border border-border-white-10 bg-card/25 p-4">
                  <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-1">
                    TOP OPPORTUNITY
                  </h2>

                  <div className="flex items-center gap-3">
                    <Image
                      src={`https://app.hyperliquid.xyz/coins/${encodeURIComponent(rustRecommendation.asset)}.svg`}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-text-primary truncate">
                        {rustRecommendation.asset}
                      </div>
                      <div className="text-xs text-text-muted-60 truncate">
                        {rustRecommendation.legs
                          .map((l) => `${l.exchange} ${l.side}`)
                          .join(' · ') || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted-60">
                    <span>
                      APR ({rustRecommendation.metricMode}):{' '}
                      <span className="text-text-primary tabular-nums">
                        {rustRecommendation.metricValueAprPct.toFixed(2)}%
                      </span>
                    </span>
                    <span>
                      Suggested:{' '}
                      <span className="text-text-primary">
                        {rustRecommendation.recommendedAction}
                      </span>
                    </span>
                    {rustRecommendation.referencePrice?.px ? (
                      <span>
                        Ref:{' '}
                        <span className="text-text-primary font-mono">
                          {rustRecommendation.referencePrice.px}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </section>
              ) : showTopOpportunity &&
                rustRecommendation &&
                !rustRecommendation.asset &&
                rustRecommendation.recommendedAction === 'NOOP_BELOW_MIN' ? (
                <section className="rounded-md border border-border-white-10 bg-card/25 p-4">
                  <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-1">
                    TOP OPPORTUNITY
                  </h2>
                  <p className="text-xs text-text-muted-60">
                    No pair meets your min APR right now ({rustRecommendation.metricMode} ·{' '}
                    {rustRecommendation.metricValueAprPct.toFixed(2)}% best vs your thresholds).
                  </p>
                </section>
              ) : null}

              <section className="rounded-md border border-border-white-10 bg-card/25 p-4 min-h-[200px]">
                <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-4">
                  CURRENTLY FARMING
                </h2>
                {currentFarming ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={currentFarming.assetIconUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                      <div>
                        <div className="text-base font-semibold text-text-primary">
                          {currentFarming.asset}
                        </div>
                        <div className="text-xs text-text-muted-60">{currentFarming.pairLabel}</div>
                      </div>
                    </div>
                    <div className="text-3xl font-semibold tabular-nums text-green-400">
                      {currentFarming.aprPercent.toFixed(2)}%
                      <span className="text-xs font-normal text-text-muted-60 ml-2">APR</span>
                    </div>
                    <div className="flex gap-6 text-xs text-text-muted-60">
                      <span>
                        Size{' '}
                        <span className="text-text-primary tabular-nums">
                          ${currentFarming.sizeUsd.toFixed(0)}
                        </span>
                      </span>
                      <span>
                        PnL{' '}
                        <span
                          className={cn(
                            'tabular-nums',
                            currentFarming.pnlUsd >= 0 ? 'text-green-400' : 'text-red-400'
                          )}
                        >
                          {currentFarming.pnlUsd >= 0 ? '+' : ''}${currentFarming.pnlUsd.toFixed(2)}
                        </span>
                      </span>
                    </div>
                    {/* <p className="text-[11px] text-text-muted-40">
                      {AUTOMATION_DEMO_HEDGE_ONLY
                        ? 'Opened with the same hedge-intent flow as Funding Arbitrage on the home page.'
                        : 'From live signals — updates with polling.'}
                    </p> */}
                  </div>
                ) : running ? (
                  <div className="flex flex-col items-center justify-center py-10 text-text-muted-60 text-xs">
                    <span className="inline-block size-2 rounded-full bg-accent/80 animate-pulse mb-3" />
                    Scanning for opportunities…
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-text-muted-60 text-xs text-center px-4">
                    No automated position. Start automation to begin scanning your selected
                    exchanges.
                  </div>
                )}
              </section>

              <section className="rounded-md border border-border-white-10 bg-card/25 p-4">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                      badgeClass(uiBadge)
                    )}
                  >
                    {uiBadge}
                  </span>
                  <span className="text-[11px] text-text-muted-40">
                    Last run: {formatAgo(lastRunMs)}
                  </span>
                </div>
                <p className="text-xs text-text-muted-60 tabular-nums">
                  {AUTOMATION_DEMO_HEDGE_ONLY ? (
                    <span className="text-text-muted-40">
                      Demo mode — Nest automation API disconnected; status reflects local demo state
                      only.
                    </span>
                  ) : (
                    <>
                      Signals:{' '}
                      <span className="text-text-primary">{apiSignals?.source ?? '—'}</span>
                      {apiSignals?.signals?.intent ? (
                        <span className="ml-2 text-text-muted-40">
                          intent {apiSignals.signals.intent}
                        </span>
                      ) : null}
                      {apiStatus?.health.lastError ? (
                        <span className="ml-2 text-red-400/90">{apiStatus.health.lastError}</span>
                      ) : null}
                    </>
                  )}
                </p>
              </section>

              {!AUTOMATION_DEMO_HEDGE_ONLY ? (
                <>
                  <section>
                    <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-3">
                      RUN ACTIONS (Rust)
                    </h2>
                    <div className="max-h-[240px] overflow-y-auto rounded-md border border-border-white-10 bg-background/40 divide-y divide-border-white-10">
                      {runActions.length === 0 ? (
                        <div className="p-4 text-xs text-text-muted-60">
                          {activeRunId ? 'No run actions yet.' : 'No automation run yet.'}
                        </div>
                      ) : (
                        runActions.map((row, idx) => {
                          const rid = `${activeRunId ?? 'run'}:${idx}`;
                          const open = expandedId === rid;
                          const r = row as Record<string, unknown>;
                          return (
                            <div key={rid} className="text-xs">
                              <button
                                type="button"
                                onClick={() => setExpandedId(open ? null : rid)}
                                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-white/5"
                              >
                                {open ? (
                                  <ChevronDown className="size-4 shrink-0 mt-0.5 text-text-muted-40" />
                                ) : (
                                  <ChevronRight className="size-4 shrink-0 mt-0.5 text-text-muted-40" />
                                )}
                                <span className="shrink-0 font-mono text-[10px] text-text-muted-40">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0 flex-1 font-mono">
                                  <div className="text-text-primary mt-0.5 truncate">
                                    {(typeof r.state === 'string' && r.state) ||
                                      (typeof r.action === 'string' && r.action) ||
                                      'action'}
                                  </div>
                                </div>
                              </button>
                              {open ? (
                                <div className="px-3 pb-2 pl-11 text-[10px] text-text-muted-40">
                                  <pre className="whitespace-pre-wrap break-all font-mono text-[10px] bg-black/20 rounded p-2 max-h-48 overflow-y-auto">
                                    {JSON.stringify(row, null, 2)}
                                  </pre>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  <section>
                    <h2 className="text-[11px] font-medium tracking-widest text-text-muted-40 mb-3">
                      EXECUTOR ACTIONS (Node)
                    </h2>
                    <div className="max-h-[240px] overflow-y-auto rounded-md border border-border-white-10 bg-background/40 divide-y divide-border-white-10">
                      {apiActions.length === 0 ? (
                        <div className="p-4 text-xs text-text-muted-60">
                          No executor actions yet.
                        </div>
                      ) : (
                        apiActions.map((row) => {
                          const rid = actionIdFromRecord(row);
                          const open = expandedId === rid;
                          const state =
                            typeof row.state === 'string' ? row.state : String(row.state ?? '—');
                          const queued = state === 'queued';
                          return (
                            <div key={rid} className="text-xs">
                              <button
                                type="button"
                                onClick={() => setExpandedId(open ? null : rid)}
                                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-white/5"
                              >
                                {open ? (
                                  <ChevronDown className="size-4 shrink-0 mt-0.5 text-text-muted-40" />
                                ) : (
                                  <ChevronRight className="size-4 shrink-0 mt-0.5 text-text-muted-40" />
                                )}
                                <span className="shrink-0 font-mono text-[10px] text-text-muted-40">
                                  {state}
                                </span>
                                <div className="min-w-0 flex-1 font-mono">
                                  <div className="text-text-primary mt-0.5 truncate">{rid}</div>
                                </div>
                              </button>
                              {open && (
                                <div className="px-3 pb-2 pl-11 space-y-2 text-[10px] text-text-muted-40">
                                  <pre className="whitespace-pre-wrap break-all font-mono text-[10px] bg-black/20 rounded p-2 max-h-48 overflow-y-auto">
                                    {JSON.stringify(row, null, 2)}
                                  </pre>
                                  {queued ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[10px]"
                                      onClick={() => void handleCancelQueuedAction(rid)}
                                    >
                                      Cancel queued
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Start automation?"
        maxWidth="md"
        contentClassName="font-mono text-sm"
      >
        <div className="px-8 md:px-10 pb-8 md:pb-10 -mt-2">
          <p className="text-text-muted-60 text-xs leading-relaxed mb-4">
            {AUTOMATION_DEMO_HEDGE_ONLY ? (
              <>
                Automation will sign transactions on your behalf using your configured Turnkey
                wallet. It will only open and close perpetual positions on the exchanges you
                selected. It cannot withdraw funds.
              </>
            ) : (
              <>
                Automation will sign transactions on your behalf using your configured Turnkey
                wallet. It will only open and close perpetual positions on the exchanges you
                selected. It cannot withdraw funds.
              </>
            )}
          </p>
          <p className="text-text-muted-40 text-[11px] mb-4">
            {subOrgId ? (
              <></>
            ) : (
              <>
                No Turnkey sub-org in session — if enable fails with a{' '}
                <code className="text-text-muted-40">subOrgId</code> validation error, complete
                wallet login first.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-600/90 text-white"
              onClick={() => void handleConfirmStart()}
            >
              I understand — start
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={stopConfirmOpen}
        onClose={() => setStopConfirmOpen(false)}
        title="Stop automation?"
        maxWidth="md"
        contentClassName="font-mono text-sm"
      >
        <div className="px-8 md:px-10 pb-8 md:pb-10 -mt-2 space-y-4">
          <p className="text-text-muted-60 text-xs leading-relaxed">
            {AUTOMATION_DEMO_HEDGE_ONLY ? (
              <>
                Closes the hedge on both venues using the same close flow as the positions table on
                the home page, then clears the demo &quot;automation running&quot; state.
              </>
            ) : (
              <>
                Calls <code className="text-text-muted-40">POST /v1/automation/disable</code> with
                an idempotency key. Revoking Turnkey removes delegated policies from the parent org
                (server-side).
              </>
            )}
          </p>
          {!AUTOMATION_DEMO_HEDGE_ONLY ? (
            <label className="flex items-center gap-2 text-xs text-text-muted-60 cursor-pointer">
              <input
                type="checkbox"
                checked={revokeOnStop}
                onChange={(e) => setRevokeOnStop(e.target.checked)}
                className="rounded border-border-white-10"
              />
              Revoke Turnkey delegation (recommended)
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setStopConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void handleConfirmStop()}>
              Stop automation
            </Button>
          </div>
        </div>
      </Modal>
    </TooltipProvider>
  );
}
