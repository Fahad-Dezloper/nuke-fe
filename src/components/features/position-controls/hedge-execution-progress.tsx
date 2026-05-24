'use client';

/**
 * Hedge Execution Progress — Floating Indicator
 *
 * A compact, animated floating card that appears top-right below the navbar
 * when a hedge intent is executing. Renders via portal to document.body.
 *
 * Since bridge + deposit are now handled separately via "Add Margin",
 * this typically shows: Setting leverage → Opening positions.
 * But it still supports the full flow if the intent triggers bridge/deposit.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HedgeIntentDetail, HedgeLeg, ExecutionPhase } from '@/lib/hedge-intent';

// ─── Step Logic ───────────────────────────────────────────────────────────────

type StepState = 'pending' | 'active' | 'done' | 'error' | 'skipped';

function wasBridgeSkipped(leg: HedgeLeg): boolean {
  const available = (leg.existing_onchain_usd || 0) + (leg.existing_margin_usd || 0);
  return available >= leg.target_amount_usd;
}

function wasDepositSkipped(leg: HedgeLeg): boolean {
  return (leg.existing_margin_usd || 0) >= leg.target_amount_usd;
}

function legBridgeState(leg: HedgeLeg | undefined): StepState {
  if (!leg) return 'pending';
  if (wasBridgeSkipped(leg)) return 'skipped';
  switch (leg.status) {
    case 'BRIDGE_IN_PROGRESS':
      return 'active';
    case 'BRIDGE_CONFIRMED':
    case 'DEPOSIT_IN_PROGRESS':
    case 'FUNDED':
    case 'OPENING_POSITION':
    case 'ACTIVE':
      return 'done';
    case 'FAILED':
      return 'error';
    default:
      return 'pending';
  }
}

function legDepositState(leg: HedgeLeg | undefined): StepState {
  if (!leg) return 'pending';
  if (wasDepositSkipped(leg)) return 'skipped';
  switch (leg.status) {
    case 'DEPOSIT_IN_PROGRESS':
      return 'active';
    case 'FUNDED':
    case 'OPENING_POSITION':
    case 'ACTIVE':
      return 'done';
    case 'FAILED':
      return 'error';
    default:
      return 'pending';
  }
}

function openPositionState(detail: HedgeIntentDetail | null): StepState {
  if (!detail) return 'pending';
  const { status } = detail.intent;
  if (status === 'OPENING') return 'active';
  if (status === 'ACTIVE') return 'done';
  if (status === 'FAILED') {
    return detail.legs.some((l) => l.status === 'ACTIVE') ? 'error' : 'pending';
  }
  return 'pending';
}

interface Step {
  label: string;
  state: StepState;
}

function buildSteps(detail: HedgeIntentDetail | null): Step[] {
  const hl = detail?.legs.find((l) => l.exchange === 'hyperliquid');
  const pac = detail?.legs.find((l) => l.exchange === 'pacifica');

  return [
    { label: 'Setting leverage', state: openPositionState(detail) },
    { label: 'Opening positions', state: openPositionState(detail) },
  ].filter((s) => s.state !== 'skipped');
}

function computeProgress(steps: Step[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.state === 'done').length;
  return Math.round((done / steps.length) * 100);
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: Step }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1',
        step.state === 'active' && 'text-white',
        step.state === 'done' && 'text-green-400/80',
        step.state === 'error' && 'text-red-400/80',
        step.state === 'pending' && 'text-white/25'
      )}
    >
      {step.state === 'active' && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
      {step.state === 'done' && <CheckCircle2 className="h-3 w-3 shrink-0" />}
      {step.state === 'error' && <XCircle className="h-3 w-3 shrink-0" />}
      {step.state === 'pending' && (
        <div className="h-3 w-3 rounded-full border border-current shrink-0" />
      )}
      <span className="text-[11px] truncate">{step.label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HedgeExecutionProgressProps {
  detail: HedgeIntentDetail | null;
  phase: ExecutionPhase;
  statusMessage: string;
  currentAction: string | null;
  className?: string;
}

export function HedgeExecutionProgress({
  detail,
  phase,
  statusMessage,
}: HedgeExecutionProgressProps) {
  const [expanded, setExpanded] = useState(false);

  const isRunning = !['idle', 'complete', 'failed'].includes(phase);
  const isComplete = phase === 'complete';
  const isFailed = phase === 'failed';
  const isVisible = phase !== 'idle';

  const isSafetyMode =
    detail?.intent.status === 'FAILED' &&
    detail.legs.some((l) => l.status === 'ACTIVE' || l.status === 'CLOSING');

  const steps = buildSteps(detail);
  const progress = isComplete ? 100 : isFailed ? 0 : computeProgress(steps);
  const activeStep = steps.find((s) => s.state === 'active');

  // Headline text
  const headline = (() => {
    if (isComplete) return 'Hedge Live';
    if (isSafetyMode) return 'Safety Mode';
    if (isFailed) return 'Hedge Failed';
    if (activeStep) return activeStep.label;
    if (phase === 'creating') return 'Creating intent...';
    return 'Processing...';
  })();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -12, x: 12 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -12, x: 12 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className={cn(
            'fixed top-16 right-4 z-[60] w-72',
            'rounded-sm border',
            'shadow-2xl shadow-black/40',
            
            isComplete
              ? 'bg-green-950/80 border-green-500/20'
              : isFailed
                ? 'bg-red-950/80 border-red-500/20'
                : 'bg-[#0c0c0f]/90 border-white/[0.08]'
          )}
        >
          {/* Progress bar — thin line at the very top */}
          {isRunning && (
            <div className="h-[2px] w-full rounded-t-sm overflow-hidden bg-white/[0.04]">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          )}

          {/* Header row — always visible */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            {/* Status icon */}
            <div className="shrink-0">
              {isRunning && <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
              {isComplete && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              {isFailed && !isSafetyMode && <XCircle className="h-4 w-4 text-red-400" />}
              {isSafetyMode && <AlertTriangle className="h-4 w-4 text-amber-400" />}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-xs font-medium truncate',
                  isComplete && 'text-green-400',
                  isFailed && !isSafetyMode && 'text-red-400',
                  isSafetyMode && 'text-amber-400',
                  isRunning && 'text-white'
                )}
              >
                {headline}
              </p>
              {isRunning && statusMessage && (
                <p className="text-[10px] text-white/40 truncate mt-0.5">{statusMessage}</p>
              )}
            </div>

            {/* Expand chevron */}
            {steps.length > 0 && (
              <div className="shrink-0 text-white/30">
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </div>
            )}
          </button>

          {/* Expanded step list */}
          <AnimatePresence>
            {expanded && steps.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 pt-0.5 space-y-0.5 border-t border-white/[0.05]">
                  {steps.map((step, i) => (
                    <StepRow key={i} step={step} />
                  ))}

                  {isSafetyMode && (
                    <div className="flex items-center gap-2 py-1 text-amber-400/80">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="text-[11px]">Closing exposed position...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
