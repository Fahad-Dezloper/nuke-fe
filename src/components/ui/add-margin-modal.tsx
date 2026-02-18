'use client';

/**
 * Add Margin Modal Component
 *
 * Modal for adding margin to a specific exchange (bridge + deposit).
 * Follows the same glassmorphism design pattern as DepositModal.
 *
 * Two modes:
 *   1. Input mode — user enters amount, sees balance, and submits
 *   2. Progress mode — shows step-by-step bridge + deposit progress
 */

import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from './modal';
import { getProtocolConfig } from '@/lib/protocols/config';
import type { FundStep } from '@/hooks/use-fund-exchange';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FundExchange = 'hyperliquid' | 'pacifica';

interface AddMarginModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which exchange to fund */
  exchange: FundExchange;
  /** Current Base USDC balance (USD) */
  baseBalance: number;
  /** Current margin already on this exchange (USD) */
  existingMargin: number;
  /** Current margin on the OTHER exchange (for the "match" suggestion) */
  otherExchangeMargin: number;
  /** Name of the other exchange (for suggestion text) */
  otherExchangeName: string;
  /** Current funding step (from useFundExchange) */
  fundStep: FundStep;
  /** Whether the funding flow is currently running */
  isExecuting: boolean;
  /** Status message from the hook */
  statusMessage: string;
  /** Error message from the hook */
  error: string | null;
  /** Called when user confirms the amount */
  onSubmit: (amountUsd: number) => void;
  /** Called when user wants to reset after success/error */
  onReset: () => void;
}

// ─── Step Configuration ───────────────────────────────────────────────────────

interface ProgressStep {
  label: string;
  fundSteps: FundStep[];
}

function getProgressSteps(exchange: FundExchange): ProgressStep[] {
  const chain = exchange === 'hyperliquid' ? 'Arbitrum' : 'Solana';
  const label = exchange === 'hyperliquid' ? 'HyperLiquid' : 'Pacifica';

  return [
    { label: 'Getting bridge quote', fundSteps: ['getting-quote'] },
    { label: 'Signing transaction', fundSteps: ['signing'] },
    { label: `Bridging to ${chain}`, fundSteps: ['bridging'] },
    { label: 'Waiting for confirmation', fundSteps: ['waiting-bridge'] },
    { label: `Depositing to ${label}`, fundSteps: ['depositing'] },
  ];
}

function getStepState(
  progressStep: ProgressStep,
  currentFundStep: FundStep,
  allSteps: ProgressStep[]
): 'pending' | 'in_progress' | 'done' | 'error' {
  if (currentFundStep === 'error') {
    const currentIdx = allSteps.findIndex((s) =>
      s.fundSteps.includes(currentFundStep)
    );
    const thisIdx = allSteps.indexOf(progressStep);
    if (thisIdx < currentIdx || currentIdx === -1) return 'done';
    return 'error';
  }

  if (currentFundStep === 'success') return 'done';

  if (progressStep.fundSteps.includes(currentFundStep)) return 'in_progress';

  const allFundSteps: FundStep[] = [
    'getting-quote',
    'signing',
    'bridging',
    'waiting-bridge',
    'depositing',
    'success',
  ];
  const currentOrder = allFundSteps.indexOf(currentFundStep);
  const thisFirstStep = progressStep.fundSteps[0];
  const thisOrder = allFundSteps.indexOf(thisFirstStep);

  if (currentOrder > thisOrder) return 'done';
  return 'pending';
}

// ─── Step Icon ────────────────────────────────────────────────────────────────

function StepIcon({ state }: { state: 'pending' | 'in_progress' | 'done' | 'error' }) {
  switch (state) {
    case 'done':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
    case 'in_progress':
      return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-text-muted-60/40" />;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_FUND_AMOUNT = 11;

// ─── Component ────────────────────────────────────────────────────────────────

export function AddMarginModal({
  isOpen,
  onClose,
  exchange,
  baseBalance,
  existingMargin,
  otherExchangeMargin,
  otherExchangeName,
  fundStep,
  isExecuting,
  statusMessage,
  error,
  onSubmit,
  onReset,
}: AddMarginModalProps) {
  const [amount, setAmount] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const protocolConfig = getProtocolConfig(exchange);
  const exchangeLabel = protocolConfig?.displayName ?? exchange;
  const exchangeLogo = protocolConfig?.logo ?? '';

  const showProgress = fundStep !== 'idle';
  const isSuccess = fundStep === 'success';
  const isError = fundStep === 'error';
  const canClose = !isExecuting;

  const resetForm = useCallback(() => {
    setAmount('');
    setInputError(null);
    setLogoError(false);
  }, []);

  // Suggest matching the other exchange
  const suggestedAmount =
    otherExchangeMargin > existingMargin
      ? Math.min(otherExchangeMargin - existingMargin, baseBalance)
      : null;

  const validate = useCallback(
    (value: string): string | null => {
      const num = parseFloat(value);
      if (!value || isNaN(num) || num <= 0) return null;
      if (num < MIN_FUND_AMOUNT) return `Minimum amount is $${MIN_FUND_AMOUNT}`;
      if (num > baseBalance + 0.01) return `Exceeds Base balance ($${baseBalance.toFixed(2)})`;
      return null;
    },
    [baseBalance]
  );

  const handleAmountChange = (value: string) => {
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    setAmount(value);
    setInputError(validate(value));
  };

  const handleMax = () => {
    const maxStr = baseBalance.toFixed(2);
    setAmount(maxStr);
    setInputError(validate(maxStr));
  };

  const handleSuggestion = () => {
    if (suggestedAmount === null) return;
    const sugStr = suggestedAmount.toFixed(2);
    setAmount(sugStr);
    setInputError(validate(sugStr));
  };

  const handleSubmit = () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setInputError('Enter an amount');
      return;
    }
    const err = validate(amount);
    if (err) {
      setInputError(err);
      return;
    }
    onSubmit(num);
  };

  const handleClose = () => {
    if (!canClose) return;
    if (isSuccess || isError) onReset();
    resetForm();
    onClose();
  };

  const handleDone = () => {
    onReset();
    resetForm();
    onClose();
  };

  const progressSteps = getProgressSteps(exchange);
  const isSubmitDisabled =
    !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 || !!inputError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton={canClose}
      closeOnBackdropClick={canClose}
      closeOnEscape={canClose}
      maxWidth="md"
      contentClassName="p-6 md:p-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2.5 mb-1">
          <div className="relative w-6 h-6 flex items-center justify-center">
            {!logoError && exchangeLogo ? (
              <Image
                src={exchangeLogo}
                alt={exchangeLabel}
                width={24}
                height={24}
                className="rounded-full"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <span className="text-[9px] font-semibold text-text-primary">
                  {exchangeLabel[0]}
                </span>
              </div>
            )}
          </div>
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">
            ADD MARGIN
          </h2>
        </div>
        <p className="text-xs text-text-muted-60">
          Bridge &amp; deposit USDC from Base to {exchangeLabel}
        </p>
      </motion.div>

      {/* ── Input Mode ───────────────────────────────────────────── */}
      {!showProgress && (
        <>
          {/* Existing Margin */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03]"
          >
            <span className="text-xs text-text-muted-60">Current Margin</span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              ${existingMargin.toFixed(2)}
            </span>
          </motion.div>

          {/* Amount Input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-text-muted-60 font-medium uppercase">
                Amount
              </label>
              <span className="text-[10px] text-text-muted-60 tabular-nums">
                Base Balance: ${baseBalance.toFixed(2)}
              </span>
            </div>
            <div
              className={cn(
                'relative overflow-hidden rounded-xl',
                'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
                'backdrop-blur-lg border',
                inputError
                  ? 'border-red-500/40'
                  : 'border-border-white-15/60',
                'p-3.5'
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
              <div className="relative z-10 flex items-center gap-3">
                <span className="text-sm text-text-muted-60">$</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSubmitDisabled) handleSubmit();
                  }}
                  className={cn(
                    'flex-1 bg-transparent text-lg font-semibold text-text-primary',
                    'placeholder:text-text-muted-60/30 outline-none tabular-nums',
                    'caret-white'
                  )}
                />
                <button
                  onClick={handleMax}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-medium',
                    'bg-white/5 border border-border-white-10/50',
                    'text-text-muted-60 hover:text-text-primary hover:bg-white/10',
                    'transition-colors duration-150'
                  )}
                >
                  MAX
                </button>
              </div>
            </div>
            {inputError && (
              <p className="text-[10px] text-red-400 mt-1.5 px-1">{inputError}</p>
            )}
          </motion.div>

          {/* Match Suggestion */}
          {suggestedAmount !== null && suggestedAmount >= MIN_FUND_AMOUNT && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-4"
            >
              <button
                onClick={handleSuggestion}
                className={cn(
                  'w-full p-2.5 rounded-lg text-left',
                  'bg-blue-500/5 border border-blue-500/15',
                  'hover:bg-blue-500/10 hover:border-blue-500/25',
                  'transition-colors duration-150'
                )}
              >
                <p className="text-[11px] text-blue-400">
                  Add ${suggestedAmount.toFixed(2)} to match {otherExchangeName}
                </p>
                <p className="text-[10px] text-text-muted-60/60 mt-0.5">
                  Keep margin balanced across exchanges for delta-neutral hedging
                </p>
              </button>
            </motion.div>
          )}

          {/* Info Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            className="mb-5"
          >
            <div className="p-2.5 rounded-lg bg-yellow-700/10 border border-accent/20">
              <p className="text-[10px] text-text-muted-60 leading-relaxed">
                This will bridge USDC from Base and deposit it into your {exchangeLabel} margin account. The process takes 1–3 minutes.
              </p>
            </div>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-semibold tracking-wide',
                'transition-all duration-200',
                isSubmitDisabled
                  ? 'bg-white/5 text-text-muted-60/40 cursor-not-allowed border border-border-white-10/30'
                  : 'bg-gradient-to-r from-accent/80 to-accent/60 text-white hover:from-accent hover:to-accent/80 border border-accent/30 shadow-lg shadow-accent/10'
              )}
            >
              FUND {exchangeLabel.toUpperCase()}
            </button>
          </motion.div>
        </>
      )}

      {/* ── Progress Mode ────────────────────────────────────────── */}
      {showProgress && (
        <>
          {/* Progress Steps */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-5"
          >
            <div
              className={cn(
                'relative overflow-hidden rounded-xl',
                'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
                'backdrop-blur-lg border border-border-white-15/60',
                'p-5'
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />

              <div className="relative z-10 space-y-3">
                {progressSteps.map((pStep, i) => {
                  const state = getStepState(pStep, fundStep, progressSteps);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                      className={cn(
                        'flex items-center gap-2.5 py-1 px-2 rounded-lg transition-colors',
                        state === 'in_progress' && 'bg-blue-500/5',
                        state === 'error' && 'bg-red-500/5'
                      )}
                    >
                      <StepIcon state={state} />
                      <span
                        className={cn(
                          'text-xs',
                          state === 'done' && 'text-green-400',
                          state === 'in_progress' && 'text-blue-400',
                          state === 'error' && 'text-red-400',
                          state === 'pending' && 'text-text-muted-60/60'
                        )}
                      >
                        {pStep.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Status Message */}
          {statusMessage && !isError && !isSuccess && (
            <p className="text-[10px] text-text-muted-60 text-center mb-4">
              {statusMessage}
            </p>
          )}

          {/* Error Display */}
          {isError && error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30"
            >
              <p className="text-xs text-red-400">{error}</p>
            </motion.div>
          )}

          {/* Success Display */}
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-500/30"
            >
              <p className="text-xs text-green-400">
                Successfully deposited to {exchangeLabel}!
              </p>
            </motion.div>
          )}

          {/* Done / Retry Buttons */}
          {(isSuccess || isError) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              {isError && (
                <button
                  onClick={() => {
                    onReset();
                  }}
                  className={cn(
                    'flex-1 py-3 rounded-xl text-sm font-semibold tracking-wide',
                    'bg-white/5 text-text-primary border border-border-white-10/50',
                    'hover:bg-white/10 transition-colors duration-200'
                  )}
                >
                  TRY AGAIN
                </button>
              )}
              <button
                onClick={handleDone}
                className={cn(
                  'flex-1 py-3 rounded-xl text-sm font-semibold tracking-wide',
                  'transition-all duration-200',
                  isSuccess
                    ? 'bg-gradient-to-r from-green-600/80 to-green-500/60 text-white border border-green-500/30'
                    : 'bg-white/5 text-text-primary border border-border-white-10/50 hover:bg-white/10'
                )}
              >
                DONE
              </button>
            </motion.div>
          )}

          {/* Patience note while executing */}
          {isExecuting && (
            <p className="text-[10px] text-text-muted-60/50 text-center italic mt-3">
              Please don&apos;t close this window while the transaction is in progress.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
