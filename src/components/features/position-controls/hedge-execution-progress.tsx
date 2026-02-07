'use client';

/**
 * Hedge Execution Progress Component
 *
 * Displays a step-by-step progress indicator while the hedge intent
 * saga is running. Maps backend leg statuses to user-friendly UI.
 */

import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  HedgeIntentDetail,
  HedgeLeg,
  HedgeLegStatus,
  ExecutionPhase,
  HedgeAction,
} from '@/lib/hedge-intent';

// ─── Step Helpers ────────────────────────────────────────────────────────────

type StepState = 'pending' | 'in_progress' | 'done' | 'error';

function getLegBridgeState(leg: HedgeLeg | undefined): StepState {
  if (!leg) return 'pending';
  switch (leg.status) {
    case 'PENDING':
      return 'pending';
    case 'BRIDGE_IN_PROGRESS':
      return 'in_progress';
    case 'BRIDGE_CONFIRMED':
    case 'DEPOSIT_IN_PROGRESS':
    case 'FUNDED':
    case 'OPENING_POSITION':
    case 'ACTIVE':
      return 'done';
    case 'FAILED':
      return leg.retry_count < 3 ? 'in_progress' : 'error';
    default:
      return 'pending';
  }
}

function getLegDepositState(leg: HedgeLeg | undefined): StepState {
  if (!leg) return 'pending';
  switch (leg.status) {
    case 'PENDING':
    case 'BRIDGE_IN_PROGRESS':
    case 'BRIDGE_CONFIRMED':
      return 'pending';
    case 'DEPOSIT_IN_PROGRESS':
      return 'in_progress';
    case 'FUNDED':
    case 'OPENING_POSITION':
    case 'ACTIVE':
      return 'done';
    case 'FAILED':
      return leg.retry_count < 3 ? 'in_progress' : 'error';
    default:
      return 'pending';
  }
}

function getOpenPositionState(detail: HedgeIntentDetail | null): StepState {
  if (!detail) return 'pending';
  const { status } = detail.intent;
  if (status === 'OPENING') return 'in_progress';
  if (status === 'ACTIVE') return 'done';
  if (status === 'FAILED') {
    const hasActive = detail.legs.some((l) => l.status === 'ACTIVE');
    return hasActive ? 'error' : 'pending';
  }
  if (['CREATED', 'FUNDING', 'READY'].includes(status)) return 'pending';
  return 'pending';
}

function calculateProgress(detail: HedgeIntentDetail | null): number {
  if (!detail) return 0;
  const { status } = detail.intent;

  switch (status) {
    case 'CREATED':
      return 5;
    case 'FUNDING': {
      let stepsDone = 0;
      for (const leg of detail.legs) {
        if (['BRIDGE_CONFIRMED', 'DEPOSIT_IN_PROGRESS', 'FUNDED', 'OPENING_POSITION', 'ACTIVE'].includes(leg.status)) stepsDone++;
        if (['FUNDED', 'OPENING_POSITION', 'ACTIVE'].includes(leg.status)) stepsDone++;
      }
      // 4 funding steps total (bridge + deposit for each leg)
      return 10 + Math.round((stepsDone / 4) * 70);
    }
    case 'READY':
      return 80;
    case 'OPENING':
      return 90;
    case 'ACTIVE':
      return 100;
    case 'FAILED':
    case 'CANCELLING':
    case 'CANCELLED':
      return -1;
    default:
      return 0;
  }
}

// ─── Step Icon Component ─────────────────────────────────────────────────────

function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case 'done':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
    case 'in_progress':
      return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    case 'pending':
    default:
      return <Clock className="h-3.5 w-3.5 text-text-muted-60/40" />;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface HedgeExecutionProgressProps {
  detail: HedgeIntentDetail | null;
  phase: ExecutionPhase;
  statusMessage: string;
  currentAction: HedgeAction | null;
  error: string | null;
  className?: string;
}

export function HedgeExecutionProgress({
  detail,
  phase,
  statusMessage,
  currentAction: _currentAction,
  error,
  className,
}: HedgeExecutionProgressProps) {
  const hlLeg = detail?.legs.find((l) => l.protocol === 'HL');
  const pacLeg = detail?.legs.find((l) => l.protocol === 'PACIFICA');
  const progress = calculateProgress(detail);

  const steps = [
    {
      label: 'Bridge to Arbitrum (HL)',
      sublabel: hlLeg ? `$${hlLeg.target_amount_usd} USDC` : '',
      state: getLegBridgeState(hlLeg),
    },
    {
      label: 'Bridge to Solana (Pacifica)',
      sublabel: pacLeg ? `$${pacLeg.target_amount_usd} USDC` : '',
      state: getLegBridgeState(pacLeg),
    },
    {
      label: 'Deposit to Hyperliquid',
      sublabel: hlLeg ? `$${hlLeg.target_amount_usd} USDC` : '',
      state: getLegDepositState(hlLeg),
    },
    {
      label: 'Deposit to Pacifica',
      sublabel: pacLeg ? `$${pacLeg.target_amount_usd} USDC` : '',
      state: getLegDepositState(pacLeg),
    },
    {
      label: 'Open Hedge Positions',
      sublabel: detail ? `${detail.intent.asset} ${detail.intent.leverage}x` : '',
      state: getOpenPositionState(detail),
    },
  ];

  // Safety mode: show close action
  const isSafetyMode = detail?.intent.status === 'FAILED' &&
    detail.legs.some((l) => l.status === 'ACTIVE' || l.status === 'CLOSING');

  return (
    <div className={cn('space-y-3', className)}>
      {/* Progress Bar */}
      {progress >= 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-text-muted-60">
              Progress
            </span>
            <span className="text-[10px] font-mono text-text-muted-60">
              {progress}%
            </span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Step List */}
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 py-1 px-2 rounded-lg transition-colors',
              step.state === 'in_progress' && 'bg-blue-500/5',
              step.state === 'error' && 'bg-red-500/5'
            )}
          >
            <StepIcon state={step.state} />
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  'text-xs',
                  step.state === 'done' && 'text-green-400',
                  step.state === 'in_progress' && 'text-blue-400',
                  step.state === 'error' && 'text-red-400',
                  step.state === 'pending' && 'text-text-muted-60/60'
                )}
              >
                {step.label}
              </span>
            </div>
            {step.sublabel && (
              <span className="text-[10px] text-text-muted-60/40 tabular-nums shrink-0">
                {step.sublabel}
              </span>
            )}
          </div>
        ))}

        {/* Safety Mode Step */}
        {isSafetyMode && (
          <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-amber-500/5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400">
              Safety Mode: Closing exposed position...
            </span>
          </div>
        )}
      </div>

      {/* Status Message */}
      {statusMessage && (
        <p className="text-[10px] text-text-muted-60 text-center px-2">
          {statusMessage}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-500/20">
          <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-medium text-red-400">Error</p>
            <p className="text-[10px] text-red-300/80 mt-0.5 break-words">{error}</p>
          </div>
        </div>
      )}

      {/* Refresh-safe notice */}
      {phase !== 'idle' && phase !== 'complete' && phase !== 'failed' && (
        <p className="text-[10px] text-text-muted-60/50 text-center italic">
          You can safely close this window. Your hedge will resume when you return.
        </p>
      )}
    </div>
  );
}
