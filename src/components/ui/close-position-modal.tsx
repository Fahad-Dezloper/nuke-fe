'use client';

/**
 * Close Position Modal
 * Interactive modal showing the close-position flow for both legs (HL + Pacifica).
 * Follows the same glassmorphism design as DepositModal / ExportWalletModal.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, AlertTriangle, X, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './modal';
import Image from 'next/image';
import type { ClosePositionResult, CloseLegResult } from '@/hooks/use-close-position';
import type { PositionApiResponse } from '@/lib/api/services/positions.service';
import { getProtocolConfig } from '@/lib/protocols/config';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalPhase = 'confirm' | 'closing' | 'result';

interface ClosePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The raw position data for display */
  position: PositionApiResponse | null;
  /** Callback that executes the close and returns the result */
  onConfirmClose: (position: PositionApiResponse) => Promise<ClosePositionResult>;
}

// ─── Leg Status Row ───────────────────────────────────────────────────────────

function LegStatusRow({
  protocol,
  side,
  size,
  symbol,
  status,
}: {
  protocol: string;
  side: string;
  size: string;
  symbol: string;
  status: 'pending' | 'closing' | 'success' | 'error';
}) {
  const config = getProtocolConfig(protocol);
  const displayName = config?.displayName || protocol;
  const logo = config?.logo || '/tokens/hype.png';

  const isLong = side === 'Long';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
        'backdrop-blur-lg border',
        status === 'error'
          ? 'border-red-500/40'
          : status === 'success'
            ? 'border-green-500/30'
            : 'border-border-white-15/60',
        'p-3.5 transition-colors duration-300'
      )}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />

      <div className="relative z-10 flex items-center justify-between">
        {/* Left: Protocol + Side */}
        <div className="flex items-center gap-3">
          <Image
            src={logo}
            alt={displayName}
            width={24}
            height={24}
            className="rounded-md shrink-0"
          />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-text-primary">{displayName}</span>
            <span
              className={cn('text-[10px] font-medium', isLong ? 'text-green-400' : 'text-red-400')}
            >
              {side.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Center: Size */}
        <div className="flex flex-col items-end mr-4">
          <span className="text-xs font-medium text-text-primary tabular-nums">{size}</span>
          <span className="text-[10px] text-text-muted-60">{symbol}</span>
        </div>

        {/* Right: Status */}
        {/* <div className="flex items-center justify-center w-8 h-8">
          <AnimatePresence mode="wait">
            {status === 'pending' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="w-6 h-6 rounded-full border-2 border-border-white-20/50"
              />
            )}
            {status === 'closing' && (
              <motion.div
                key="closing"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
              </motion.div>
            )}
            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Check className="w-5 h-5 text-green-400" />
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </div> */}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ClosePositionModal({
  isOpen,
  onClose,
  position,
  onConfirmClose,
}: ClosePositionModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('confirm');
  const [legStatuses, setLegStatuses] = useState<
    Record<string, 'pending' | 'closing' | 'success' | 'error'>
  >({});
  const [result, setResult] = useState<ClosePositionResult | null>(null);

  const handleClose = useCallback(() => {
    // Reset state when closing
    setPhase('confirm');
    setLegStatuses({});
    setResult(null);
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (!position) return;

    setPhase('closing');

    // Set both legs to "closing"
    const initialStatuses: Record<string, 'pending' | 'closing' | 'success' | 'error'> = {};
    if (position.hyperliquid) initialStatuses.hyperliquid = 'closing';
    if (position.pacifica) initialStatuses.pacifica = 'closing';
    setLegStatuses(initialStatuses);

    // Execute close
    const closeResult = await onConfirmClose(position);

    // Update per-leg statuses from result
    const updatedStatuses = { ...initialStatuses };
    for (const leg of closeResult.legs) {
      updatedStatuses[leg.protocol] = leg.success ? 'success' : 'error';
    }
    setLegStatuses(updatedStatuses);
    setResult(closeResult);
    setPhase('result');
  }, [position, onConfirmClose]);

  if (!position) return null;

  const { hyperliquid: hl, pacifica: pac } = position;
  const isAllSuccess = result?.status === 'success';
  const isPartial = result?.status === 'partial';
  const isError = result?.status === 'error';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      contentClassName="p-6 md:p-8"
      closeOnBackdropClick={phase !== 'closing'}
      closeOnEscape={phase !== 'closing'}
      showCloseButton={phase !== 'closing'}
    >
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-1"
      >
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary tracking-tight">
              {phase === 'result' && isAllSuccess
                ? 'Position Closed'
                : phase === 'result' && (isPartial || isError)
                  ? 'Close Failed'
                  : 'Close Position'}
            </h2>
          </div>
        </div>
        <p className="text-xs text-text-muted-60 mt-2">
          {phase === 'confirm' &&
            'This will close both legs of your hedged position simultaneously.'}
          {phase === 'closing' && 'Signing and submitting close orders...'}
          {phase === 'result' && isAllSuccess && 'Both legs have been closed successfully.'}
          {phase === 'result' && isPartial && 'One leg failed to close. Please retry manually.'}
          {phase === 'result' && isError && 'Both legs failed to close. Please try again.'}
        </p>
      </motion.div>

      {/* Asset Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-center gap-2.5 mt-5 mb-4"
      >
        <Image
          src={`https://app.hyperliquid.xyz/coins/${position.symbol.toUpperCase()}.svg`}
          alt={position.symbol}
          width={28}
          height={28}
        />
        <span className="text-base font-semibold text-text-primary">{position.symbol}</span>
      </motion.div>

      {/* Leg Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-2.5 mb-5"
      >
        {hl && (
          <LegStatusRow
            protocol="hyperliquid"
            side={hl.side}
            size={hl.size}
            symbol={position.symbol}
            status={legStatuses.hyperliquid || 'pending'}
          />
        )}
        {pac && (
          <LegStatusRow
            protocol="pacifica"
            side={pac.side}
            size={pac.size}
            symbol={position.symbol}
            status={legStatuses.pacifica || 'pending'}
          />
        )}
      </motion.div>

      {/* Error details */}
      <AnimatePresence>
        {phase === 'result' && (isPartial || isError) && result?.legs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5"
          >
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              {result.legs
                .filter((l) => !l.success)
                .map((leg) => (
                  <p key={leg.protocol} className="text-xs text-red-400 leading-relaxed">
                    <span className="font-medium capitalize">{leg.protocol}</span>:{' '}
                    {leg.error || 'Unknown error'}
                  </p>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {phase === 'confirm' && (
          <div className="flex gap-2.5">
            <motion.button
              onClick={handleClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex-1 relative overflow-hidden rounded-xl',
                'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
                'backdrop-blur-lg border border-border-white-15/60',
                'py-2.5 text-xs font-medium text-text-muted-60',
                'hover:text-text-primary hover:border-border-white-20',
                'transition-colors duration-200'
              )}
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={handleConfirm}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex-1 relative overflow-hidden rounded-xl',
                'bg-red-500/15 border border-red-500/30',
                'py-2.5 text-xs font-semibold text-red-400',
                'hover:bg-red-500/25 hover:border-red-500/50',
                'transition-colors duration-200'
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />
              <span className="relative z-10">Close Position</span>
            </motion.button>
          </div>
        )}

        {phase === 'closing' && (
          <div
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-xl',
              'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
            )}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-medium">Closing positions...</span>
          </div>
        )}

        {phase === 'result' && isAllSuccess && (
          <motion.button
            onClick={handleClose}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full relative overflow-hidden rounded-xl',
              'bg-green-500/15 border border-green-500/30',
              'py-2.5 text-xs font-semibold text-green-400',
              'hover:bg-green-500/25 hover:border-green-500/50',
              'transition-colors duration-200'
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Done
            </span>
          </motion.button>
        )}

        {phase === 'result' && (isPartial || isError) && (
          <div className="flex gap-2.5">
            <motion.button
              onClick={handleClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex-1 relative overflow-hidden rounded-xl',
                'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
                'backdrop-blur-lg border border-border-white-15/60',
                'py-2.5 text-xs font-medium text-text-muted-60',
                'hover:text-text-primary hover:border-border-white-20',
                'transition-colors duration-200'
              )}
            >
              Dismiss
            </motion.button>
            <motion.button
              onClick={() => {
                setPhase('confirm');
                setLegStatuses({});
                setResult(null);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex-1 relative overflow-hidden rounded-xl',
                'bg-red-500/15 border border-red-500/30',
                'py-2.5 text-xs font-semibold text-red-400',
                'hover:bg-red-500/25 hover:border-red-500/50',
                'transition-colors duration-200'
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />
              <span className="relative z-10">Retry</span>
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Warning */}
      {phase === 'confirm' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 p-3 rounded-lg text-yellow-600 bg-yellow-700/10 border border-accent/20"
        >
          <p className="text-xs text-text-muted-60 leading-relaxed">
            Both positions will be closed as market orders. Slippage may occur during high
            volatility.
          </p>
        </motion.div>
      )}
    </Modal>
  );
}
