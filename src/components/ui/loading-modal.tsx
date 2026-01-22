'use client';

/**
 * Loading Modal Component
 * Beautiful loading popup matching the deposit modal design
 */

import { motion } from 'framer-motion';
import { Modal } from './modal';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export type LoadingType = 'login' | 'wallet-creation';

interface LoadingModalProps {
  isOpen: boolean;
  type: LoadingType;
}

const messages = {
  login: {
    title: 'PREPARING FOR LOGIN',
    description: 'Setting up your account and fetching wallet data',
    steps: [
      'Connecting to Turnkey',
      'Fetching your wallets',
      'Initializing session',
    ],
  },
  'wallet-creation': {
    title: 'SETTING UP ACCOUNT',
    description: 'Generating secure keys and creating your wallet',
    steps: [
      'Generating secure keys',
      'Creating wallet addresses',
      'Finalizing setup',
    ],
  },
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

export function LoadingModal({ isOpen, type }: LoadingModalProps) {
  const config = messages[type];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setActiveStep(0);
      return;
    }

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % config.steps.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, config.steps.length]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      showCloseButton={false}
      closeOnBackdropClick={false}
      closeOnEscape={false}
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
          {config.title}
        </h2>
        <p className="text-xs text-text-muted-60">
          {config.description}
        </p>
      </motion.div>

      {/* Loading Card */}
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
              {config.steps.map((step, index) => {
                const isActive = index === activeStep;
                const isCompleted = index < activeStep;
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted-60)'
                    }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.3 }}
                    className="flex items-center gap-2.5"
                  >
                    <motion.div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isActive ? 'bg-accent' : isCompleted ? 'bg-accent/60' : 'bg-text-muted-30'
                      )}
                      animate={isActive ? {
                        scale: [1, 1.3, 1],
                        opacity: [0.6, 1, 0.6],
                      } : {}}
                      transition={{
                        duration: 1.5,
                        repeat: isActive ? Infinity : 0,
                        ease: 'easeInOut',
                      }}
                    />
                    <span className="text-xs flex items-center">
                      {step}
                      {isActive && <LoadingDots />}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </Modal>
  );
}
