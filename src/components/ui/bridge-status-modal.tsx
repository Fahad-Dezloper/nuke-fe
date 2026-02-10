/**
 * Bridge Status Modal Component
 * Shows progress of bridge operation from Base to Arbitrum
 */

'use client';

import { motion } from 'framer-motion';
import { Modal } from './modal';
import { cn } from '@/lib/utils';
import type { BridgeStatus } from '@/lib/bridge';

interface BridgeStatusModalProps {
  isOpen: boolean;
  status: BridgeStatus;
  protocol: 'hyperliquid' | 'pacifica';
  error?: string | null;
  onClose?: () => void;
}

const statusMessages: Record<BridgeStatus, string> = {
  idle: '',
  'checking-balance': 'Checking USDC balance on Base',
  'getting-quote': 'Getting bridge quote',
  'signing-permit': 'Signing permit',
  'executing-permit': 'Bridging from Base to Arbitrum',
  'waiting-finality': 'Waiting for bridge finality',
  depositing: 'Depositing to protocol',
  success: 'Bridge completed successfully',
  error: 'Bridge failed',
};

const statusSteps = [
  'Checking balance',
  'Getting bridge quote',
  'Signing permit',
  'Bridging from Base to Arbitrum',
  'Waiting for bridge finality',
  'Depositing to protocol',
] as const;

const getActiveStepIndex = (status: BridgeStatus): number => {
  switch (status) {
    case 'checking-balance':
      return 0;
    case 'getting-quote':
      return 1;
    case 'signing-permit':
      return 2;
    case 'executing-permit':
      return 3;
    case 'waiting-finality':
      return 4;
    case 'depositing':
      return 5;
    case 'success':
      return 5; // Completed
    case 'error':
      return -1; // Error state
    default:
      return 0;
  }
};

const LoadingDots = () => {
  return (
    <span className="inline-flex gap-1 ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1 h-1 rounded-full bg-accent"
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
};

export function BridgeStatusModal({
  isOpen,
  status,
  protocol,
  error,
  onClose,
}: BridgeStatusModalProps) {
  const activeStepIndex = getActiveStepIndex(status);
  const protocolName = protocol === 'hyperliquid' ? 'HyperLiquid' : 'Pacifica';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose || (() => {})}
      showCloseButton={status === 'error' || status === 'success'}
      closeOnBackdropClick={status === 'error' || status === 'success'}
      closeOnEscape={status === 'error' || status === 'success'}
      maxWidth="sm"
      contentClassName="p-6 md:p-8"
    >
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-1 tracking-tight">
          FUNDING {protocolName.toUpperCase()} LEG
        </h2>
        <p className="text-xs text-text-muted-60">{statusMessages[status] || 'Processing...'}</p>
      </motion.div>

      {/* Status Card */}
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
            'p-6'
          )}
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />

          <div className="relative z-10">
            {/* Steps */}
            <div className="space-y-3">
              {statusSteps.map((step, index) => {
                const isActive = index === activeStepIndex;
                const isCompleted = status === 'success' && index < statusSteps.length - 1;
                const isError = status === 'error' && index === activeStepIndex;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.3 }}
                    className="flex items-center gap-2.5"
                  >
                    <motion.div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isError
                          ? 'bg-red-400'
                          : isActive
                            ? 'bg-accent'
                            : isCompleted
                              ? 'bg-accent/60'
                              : 'bg-text-muted-30'
                      )}
                      animate={
                        isActive && !isError
                          ? {
                              scale: [1, 1.3, 1],
                              opacity: [0.6, 1, 0.6],
                            }
                          : {}
                      }
                      transition={{
                        duration: 1.5,
                        repeat: isActive && !isError ? Infinity : 0,
                        ease: 'easeInOut',
                      }}
                    />
                    <span
                      className={cn(
                        'text-xs flex items-center',
                        isActive
                          ? 'text-text-primary'
                          : isCompleted
                            ? 'text-text-primary/80'
                            : 'text-text-muted-60'
                      )}
                    >
                      {step}
                      {isActive && !isError && <LoadingDots />}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-red-900/20 border border-red-500/30"
        >
          <p className="text-xs font-medium text-red-400">{error}</p>
        </motion.div>
      )}

      {/* Success Message */}
      {status === 'success' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-green-900/20 border border-green-500/30"
        >
          <p className="text-xs font-medium text-green-400">
            Successfully bridged and deposited to {protocolName}
          </p>
        </motion.div>
      )}
    </Modal>
  );
}
