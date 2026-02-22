'use client';

/**
 * Withdraw Modal Component
 * Modal for withdrawing USDC from an exchange to Base wallet.
 * Follows the glassmorphism design of DepositModal / ClosePositionModal.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { Modal } from './modal';
import { useWithdrawal } from '@/lib/withdrawal';
import type { WithdrawalExchange, WithdrawalPhase } from '@/lib/withdrawal';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { getProtocolConfig } from '@/lib/protocols/config';
import { cn } from '@/lib/utils';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXCHANGES: { id: WithdrawalExchange; label: string }[] = [
  { id: 'hyperliquid', label: 'Hyperliquid' },
  { id: 'pacifica', label: 'Pacifica' },
];

const STEP_LABELS: { key: string; label: string }[] = [
  { key: 'withdraw', label: 'Withdraw from exchange' },
  { key: 'bridge', label: 'Bridge to Base' },
  { key: 'done', label: 'Complete' },
];

function getStepState(
  phase: WithdrawalPhase,
  stepKey: string
): 'pending' | 'active' | 'done' | 'error' {
  const phaseOrder: Record<string, number> = {
    idle: -1,
    creating: 0,
    withdrawing: 0,
    waiting: 1,
    bridging: 1,
    completed: 2,
    failed: -2,
  };

  const stepOrder: Record<string, number> = {
    withdraw: 0,
    bridge: 1,
    done: 2,
  };

  if (phase === 'failed') return 'error';

  const currentIdx = phaseOrder[phase] ?? -1;
  const stepIdx = stepOrder[stepKey] ?? 0;

  if (currentIdx > stepIdx) return 'done';
  if (currentIdx === stepIdx) return 'active';
  return 'pending';
}

export function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
  const { state: turnkeyState } = useTurnkey();
  const { hlBalance, pacBalance } = useExchangeBalances();
  const {
    startWithdrawal,
    phase,
    statusMessage,
    error,
    isExecuting,
  } = useWithdrawal();

  const [selectedExchange, setSelectedExchange] = useState<WithdrawalExchange>('hyperliquid');
  const [amount, setAmount] = useState('');

  const handleClose = useCallback(() => {
    setAmount('');
    onClose();
  }, [onClose]);

  const availableBalance = useMemo(() => {
    return selectedExchange === 'hyperliquid' ? hlBalance : pacBalance;
  }, [selectedExchange, hlBalance, pacBalance]);

  const handleMax = () => {
    if (availableBalance > 0) {
      setAmount(availableBalance.toFixed(2));
    }
  };

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    const walletAddress = getEVMAddress(turnkeyState.userWallets || []);

    await startWithdrawal({
      exchange: selectedExchange,
      amountUsd: amountNum,
      recipient: walletAddress || undefined,
    });
  };

  const isValidAmount =
    amount &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= availableBalance;

  const isInProgress = phase !== 'idle' && phase !== 'failed' && phase !== 'completed';
  const showForm = phase === 'idle' || phase === 'failed';
  const showProgress = isInProgress || phase === 'completed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="md"
      contentClassName="p-6 md:p-8"
      closeOnBackdropClick={!isExecuting}
      closeOnEscape={!isExecuting}
      showCloseButton={!isExecuting}
    >
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2.5 mb-1">
          {(() => {
            const config = getProtocolConfig(selectedExchange);
            return config ? (
              <Image
                src={config.logo}
                alt={config.displayName}
                width={24}
                height={24}
                className="rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20" />
            );
          })()}
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">
            {phase === 'completed' ? 'Withdrawal Complete' : 'WITHDRAW'}
          </h2>
        </div>
        <p className="text-xs text-text-muted-60">
          {showForm && 'Withdraw USDC from an exchange to your Base wallet'}
          {isInProgress && (statusMessage || 'Processing withdrawal...')}
          {phase === 'completed' && 'Funds have been withdrawn to your Base wallet.'}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Exchange Selector */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-4"
            >
              <label className="text-xs text-text-muted-60 font-medium mb-2 block">
                EXCHANGE
              </label>
              <div className="flex gap-2.5">
                {EXCHANGES.map((ex) => {
                  const config = getProtocolConfig(ex.id);
                  const isSelected = selectedExchange === ex.id;
                  return (
                    <motion.button
                      key={ex.id}
                      onClick={() => setSelectedExchange(ex.id)}
                      disabled={isExecuting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'flex-1 relative overflow-hidden rounded-xl cursor-pointer',
                        'backdrop-blur-lg p-3',
                        'transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isSelected
                          ? 'bg-accent/20 border-2 border-accent/60 shadow-lg shadow-accent/10'
                          : 'bg-gradient-to-br from-card/80 via-card/70 to-card/65 border border-border-white-15/60 hover:border-border-white-30'
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
                      <div className="relative z-10 flex items-center justify-center gap-2">
                        {config && (
                          <Image
                            src={config.logo}
                            alt={config.displayName}
                            width={18}
                            height={18}
                            className="rounded-full"
                          />
                        )}
                        <span
                          className={cn(
                            'text-xs font-medium',
                            isSelected ? 'text-text-primary' : 'text-text-muted-60'
                          )}
                        >
                          {ex.label}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03]"
            >
              <span className="text-xs text-text-muted-60">Available Balance</span>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                ${availableBalance.toFixed(2)}
              </span>
            </motion.div>

            {/* Amount Input */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-5"
            >
              <label className="text-xs text-text-muted-60 font-medium mb-2 block">
                AMOUNT (USD)
              </label>
              <div
                className={cn(
                  'relative overflow-hidden rounded-xl',
                  'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
                  'backdrop-blur-lg border border-border-white-15/60',
                  'p-3.5 flex items-center gap-3'
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
                <span className="relative z-10 text-sm text-text-muted-60">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  disabled={isExecuting}
                  className={cn(
                    'relative z-10 flex-1 bg-transparent outline-none',
                    'text-lg font-semibold text-text-primary tabular-nums',
                    'placeholder:text-text-muted-60/30 caret-white',
                    'disabled:opacity-50'
                  )}
                />
                <button
                  onClick={handleMax}
                  disabled={availableBalance <= 0 || isExecuting}
                  className={cn(
                    'relative z-10 px-2.5 py-1 rounded-md cursor-pointer',
                    'bg-white/5 border border-border-white-10/50',
                    'text-[10px] font-medium text-text-muted-60',
                    'hover:text-text-primary hover:bg-white/10',
                    'transition-colors duration-150',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  MAX
                </button>
              </div>
            </motion.div>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5"
                >
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400 leading-relaxed">{String(error)}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-5"
            >
              <button
                onClick={handleWithdraw}
                disabled={!isValidAmount || isExecuting || !turnkeyState.isLoggedIn}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-semibold tracking-wide',
                  'transition-all duration-200',
                  !isValidAmount || isExecuting || !turnkeyState.isLoggedIn
                    ? 'bg-white/5 text-text-muted-60/40 cursor-not-allowed border border-border-white-10/30'
                    : 'bg-gradient-to-r from-accent/80 to-accent/60 text-white hover:from-accent hover:to-accent/80 border border-accent/30 shadow-lg shadow-accent/10'
                )}
              >
                {isExecuting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    PROCESSING...
                  </span>
                ) : (
                  'WITHDRAW'
                )}
              </button>
            </motion.div>
          </motion.div>
        )}

        {showProgress && (
          <motion.div
            key="progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Progress Stepper */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col gap-2.5 mb-5"
            >
              {STEP_LABELS.map((step) => {
                const state = getStepState(phase, step.key);
                return (
                  <div
                    key={step.key}
                    className={cn(
                      'relative overflow-hidden rounded-xl',
                      'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
                      'backdrop-blur-lg border',
                      state === 'done' && 'border-green-500/30',
                      state === 'active' && 'border-accent/40',
                      state === 'pending' && 'border-border-white-15/60',
                      state === 'error' && 'border-red-500/40',
                      'p-3.5 transition-colors duration-300'
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
                    <div className="relative z-10 flex items-center gap-3">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                          state === 'done' && 'bg-green-500/20',
                          state === 'active' && 'bg-accent/20',
                          state === 'pending' && 'bg-card/50 border border-border-white-15/60',
                          state === 'error' && 'bg-red-500/20'
                        )}
                      >
                        {state === 'done' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        )}
                        {state === 'active' && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                        )}
                        {state === 'pending' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-text-muted-40/50" />
                        )}
                        {state === 'error' && (
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          state === 'done' && 'text-green-400',
                          state === 'active' && 'text-text-primary',
                          state === 'pending' && 'text-text-muted-40',
                          state === 'error' && 'text-red-400'
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Status Message */}
            <AnimatePresence>
              {statusMessage && isInProgress && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-5"
                >
                  <div
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 rounded-xl',
                      'bg-accent/10 border border-accent/20 text-accent'
                    )}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">{statusMessage}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Done Button */}
            {phase === 'completed' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-5"
              >
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'w-full relative overflow-hidden rounded-xl cursor-pointer',
                    'bg-green-500/15 border border-green-500/30',
                    'py-2.5 text-xs font-semibold text-green-400',
                    'hover:bg-green-500/25 hover:border-green-500/50',
                    'transition-colors duration-200'
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Done
                  </span>
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="p-3 rounded-lg bg-yellow-700/10 border border-accent/20"
      >
        <p className="text-xs text-text-muted-60 leading-relaxed">
          Withdrawals move USDC from the exchange to your Base wallet.
          The process involves a withdrawal step and a bridge step.
        </p>
      </motion.div>
    </Modal>
  );
}
