'use client';

/**
 * Hedge Execution Progress — Floating Indicator
 *
 * A compact, animated floating card that appears top-right below the navbar
 * when a hedge intent is executing. Renders via portal to document.body.
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
import type {
  HedgeIntentDetail,
  HedgeLeg,
  ExecutionPhase,
  SafetyExposureInfo,
} from '@/lib/hedge-intent';

type StepState = 'pending' | 'active' | 'done' | 'error' | 'skipped';

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

function safetyCloseState(detail: HedgeIntentDetail | null, phase: ExecutionPhase): StepState {
  if (phase === 'closing') return 'active';
  if (phase === 'safety_failed') return 'error';
  if (!detail) return 'pending';
  if (detail.intent.status === 'FAILED' && detail.legs.some((l) => l.status === 'ACTIVE')) {
    return 'error';
  }
  if (detail.legs.some((l) => l.status === 'CLOSED')) return 'done';
  return 'pending';
}

interface Step {
  label: string;
  state: StepState;
}

function buildSteps(
  detail: HedgeIntentDetail | null,
  phase: ExecutionPhase,
  includesPacifica: boolean
): Step[] {
  const steps: Step[] = [];

  if (includesPacifica && ['depositing', 'pacifica_access', 'opening', 'closing'].includes(phase)) {
    steps.push({
      label: 'Pacifica builder access',
      state:
        phase === 'pacifica_access'
          ? 'active'
          : phase === 'depositing'
            ? 'pending'
            : 'done',
    });
  }

  steps.push(
    { label: 'Setting leverage', state: openPositionState(detail) },
    { label: 'Opening positions', state: openPositionState(detail) }
  );

  if (phase === 'closing' || phase === 'safety_failed') {
    steps.push({
      label: 'Safety close (exposed leg)',
      state: safetyCloseState(detail, phase),
    });
  }

  return steps.filter((s) => s.state !== 'skipped');
}

function computeProgress(steps: Step[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.state === 'done').length;
  return Math.round((done / steps.length) * 100);
}

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

interface HedgeExecutionProgressProps {
  detail: HedgeIntentDetail | null;
  phase: ExecutionPhase;
  statusMessage: string;
  currentAction: string | null;
  safetyExposure?: SafetyExposureInfo | null;
  className?: string;
}

export function HedgeExecutionProgress({
  detail,
  phase,
  statusMessage,
  safetyExposure,
}: HedgeExecutionProgressProps) {
  const [expanded, setExpanded] = useState(false);

  const isRunning = !['idle', 'complete', 'failed', 'safety_failed'].includes(phase);
  const isComplete = phase === 'complete';
  const isFailed = phase === 'failed';
  const isSafetyFailed = phase === 'safety_failed';
  const isVisible = phase !== 'idle';

  const legs = detail?.legs ?? [];
  const includesPacifica = legs.some((l: HedgeLeg) => l.exchange === 'pacifica');

  const isSafetyMode =
    phase === 'closing' ||
    (detail?.intent.status === 'FAILED' &&
      detail.legs.some((l) => l.status === 'ACTIVE' || l.status === 'CLOSING'));

  const steps = buildSteps(detail, phase, includesPacifica);
  const progress = isComplete ? 100 : isFailed || isSafetyFailed ? 0 : computeProgress(steps);
  const activeStep = steps.find((s) => s.state === 'active');

  const headline = (() => {
    if (isComplete) return 'Hedge Live';
    if (isSafetyFailed) return 'Manual Close Required';
    if (isSafetyMode && phase === 'closing') return 'Safety Mode';
    if (isFailed) return 'Hedge Failed';
    if (phase === 'pacifica_access') return 'Pacifica builder approval';
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
            'fixed top-16 right-4 z-[60] w-80',
            'rounded-md border',
            'shadow-2xl shadow-black/40',
            'backdrop-blur-xl',
            isComplete
              ? 'bg-green-950/80 border-green-500/20'
              : isSafetyFailed
                ? 'bg-amber-950/80 border-amber-500/25'
                : isFailed
                  ? 'bg-red-950/80 border-red-500/20'
                  : 'bg-[#0c0c0f]/90 border-white/[0.08]'
          )}
        >
          {isRunning && (
            <div className="h-[2px] w-full rounded-t-md overflow-hidden bg-white/[0.04]">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            <div className="shrink-0">
              {isRunning && <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
              {isComplete && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              {isFailed && !isSafetyFailed && <XCircle className="h-4 w-4 text-red-400" />}
              {(isSafetyMode || isSafetyFailed) && (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-xs font-medium truncate',
                  isComplete && 'text-green-400',
                  isFailed && !isSafetyFailed && 'text-red-400',
                  (isSafetyMode || isSafetyFailed) && 'text-amber-400',
                  isRunning && 'text-white'
                )}
              >
                {headline}
              </p>
              {(isRunning || isSafetyFailed) && statusMessage && (
                <p className="text-[10px] text-white/40 truncate mt-0.5">{statusMessage}</p>
              )}
              {isSafetyFailed && safetyExposure && (
                <p className="text-[10px] text-amber-200/70 mt-1 leading-snug">
                  {safetyExposure.message}
                </p>
              )}
            </div>

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

                  {isSafetyMode && phase === 'closing' && (
                    <div className="flex items-center gap-2 py-1 text-amber-400/80">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="text-[11px]">Closing exposed leg automatically...</span>
                    </div>
                  )}

                  {isSafetyFailed && (
                    <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
                      <p className="text-[10px] text-amber-100/80 leading-relaxed">
                        Scroll to the positions table and close the remaining leg manually. Balances
                        will refresh after you close.
                      </p>
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
