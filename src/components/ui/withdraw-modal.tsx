/**
 * Withdraw Modal Component
 * Modal for withdrawing USDC from an exchange to Base wallet.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal } from './modal';
import { Input } from './input';
import { Button } from './button';
import { useWithdrawal } from '@/lib/withdrawal';
import type { WithdrawalExchange, WithdrawalPhase } from '@/lib/withdrawal';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { getProtocolConfig } from '@/lib/protocols/config';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, CheckCircle2, ArrowDown } from 'lucide-react';
import Image from 'next/image';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXCHANGES: { id: WithdrawalExchange; label: string }[] = [
  { id: 'hyperliquid', label: 'Hyperliquid' },
  { id: 'pacifica', label: 'Pacifica' },
];

const STEP_LABELS: { key: string; label: string }[] = [
  { key: 'withdraw', label: 'Withdraw' },
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

  useEffect(() => {
    if (isOpen) {
      setAmount('');
    }
  }, [isOpen]);

  const availableBalance = useMemo(() => {
    return selectedExchange === 'hyperliquid' ? hlBalance : pacBalance;
  }, [selectedExchange, hlBalance, pacBalance]);

  const protocolConfig = useMemo(
    () => getProtocolConfig(selectedExchange),
    [selectedExchange]
  );

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
      onClose={onClose}
      title="Withdraw"
      description="Withdraw USDC from an exchange to your Base wallet"
      maxWidth="md"
    >
      <div className="p-8 md:p-10 pt-6 space-y-6">
        {showForm && (
          <>
            {/* Exchange Selector */}
            <div className="space-y-2">
              <label className="text-xs text-text-muted-60 uppercase tracking-wide">
                Exchange
              </label>
              <div className="flex gap-2">
                {EXCHANGES.map((ex) => {
                  const config = getProtocolConfig(ex.id);
                  return (
                    <button
                      key={ex.id}
                      onClick={() => setSelectedExchange(ex.id)}
                      disabled={isExecuting}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all',
                        selectedExchange === ex.id
                          ? 'border-accent/50 bg-accent/10 text-text-primary'
                          : 'border-border-white-10/50 bg-card/30 text-text-muted-60 hover:bg-card/50'
                      )}
                    >
                      {config && (
                        <Image
                          src={config.logo}
                          alt={config.displayName}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      )}
                      {ex.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance Display */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border-white-10/50">
              <span className="text-xs text-text-muted-60">
                Available on {protocolConfig?.displayName || selectedExchange}
              </span>
              <span className="text-sm font-medium text-text-primary">
                ${availableBalance.toFixed(2)}
              </span>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-xs text-text-muted-60 uppercase tracking-wide">
                Amount (USD)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1"
                  step="0.01"
                  min="0"
                  disabled={isExecuting}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                  disabled={availableBalance <= 0 || isExecuting}
                  className="shrink-0"
                >
                  Max
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isExecuting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={!isValidAmount || isExecuting || !turnkeyState.isLoggedIn}
                className="flex-1 bg-accent/20 hover:bg-accent/30 border-accent/50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Withdraw'
                )}
              </Button>
            </div>
          </>
        )}

        {showProgress && (
          <>
            {/* Progress Stepper */}
            <div className="space-y-3">
              {STEP_LABELS.map((step, idx) => {
                const state = getStepState(phase, step.key);
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    {/* Step indicator */}
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 border',
                        state === 'done' && 'bg-green-500/20 border-green-500/50',
                        state === 'active' && 'bg-accent/20 border-accent/50',
                        state === 'pending' && 'bg-card/30 border-border-white-10/50',
                        state === 'error' && 'bg-red-500/20 border-red-500/50'
                      )}
                    >
                      {state === 'done' && (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      )}
                      {state === 'active' && (
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      )}
                      {state === 'pending' && (
                        <span className="text-xs text-text-muted-40">{idx + 1}</span>
                      )}
                      {state === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>

                    {/* Step label */}
                    <span
                      className={cn(
                        'text-sm',
                        state === 'done' && 'text-green-400',
                        state === 'active' && 'text-text-primary font-medium',
                        state === 'pending' && 'text-text-muted-40',
                        state === 'error' && 'text-red-400'
                      )}
                    >
                      {step.label}
                    </span>

                    {/* Connector line (except last) */}
                    {idx < STEP_LABELS.length - 1 && (
                      <div className="flex-1" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-border-white-10/50">
                {isInProgress && (
                  <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                )}
                {phase === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                )}
                <span className="text-xs text-text-primary">{statusMessage}</span>
              </div>
            )}

            {/* Destination info */}
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted-60">
              <ArrowDown className="w-3 h-3" />
              <span>Destination: Base (USDC)</span>
            </div>

            {/* Close button when completed */}
            {phase === 'completed' && (
              <Button
                onClick={onClose}
                className="w-full bg-green-500/20 hover:bg-green-500/30 border-green-500/50"
              >
                Done
              </Button>
            )}
          </>
        )}

        {/* Info footer */}
        <div className="pt-2 border-t border-border-white-10/50">
          <p className="text-xs text-text-muted-60">
            Withdrawals move USDC from the exchange to your Base wallet.
            The process involves a withdrawal step and a bridge step. Up to 3 retries per step.
          </p>
        </div>
      </div>
    </Modal>
  );
}
