'use client';

/**
 * Connect Wallet Modal Component
 * Modal for wallet connection with Google Sign-in, EVM, and Solana wallet options.
 * Gated behind an access code validated server-side before Turnkey is touched.
 */

import { motion } from 'framer-motion';
import { Loader2, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Modal } from './modal';
import { useTurnkey } from '@/lib/turnkey';
import { useState, useCallback } from 'react';
import { storeAccessCode } from '@/lib/auth/access-code';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn?: () => void;
  onEOAConnect?: () => void;
}

export function ConnectWalletModal({
  isOpen,
  onClose,
  onGoogleSignIn,
  onEOAConnect,
}: ConnectWalletModalProps) {
  const { loginWithGoogle, state } = useTurnkey();
  const [loading, setLoading] = useState<'google' | 'validating' | null>(null);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isCodeValidated, setIsCodeValidated] = useState(false);

  const handleValidateCode = useCallback(async () => {
    if (!accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setLoading('validating');
    setError('');

    try {
      const res = await fetch('/api/validate-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode.trim() }),
      });

      const data = await res.json();

      if (data.valid) {
        storeAccessCode(accessCode.trim());
        setIsCodeValidated(true);
      } else {
        setError('Invalid access code');
      }
    } catch {
      setError('Failed to validate access code');
    } finally {
      setLoading(null);
    }
  }, [accessCode]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading('google');
      setError('');
      await loginWithGoogle();
      onGoogleSignIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(null);
    }
  };

  const handleClose = useCallback(() => {
    setAccessCode('');
    setError('');
    setIsCodeValidated(false);
    setLoading(null);
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="md" contentClassName="p-8 md:p-10">
      {/* Logo and Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-8"
      >
        <h2 className="text-xl font-semibold text-text-primary mb-2 tracking-tight">
          CONNECT WALLET
        </h2>
        <p className="text-xs text-text-muted-60 text-center max-w-xs leading-relaxed">
          {isCodeValidated
            ? 'Choose your preferred method to connect and start trading'
            : 'Enter your access code to continue'}
        </p>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-300 text-sm"
        >
          {error}
        </motion.div>
      )}

      {!isCodeValidated ? (
        /* ── Access Code Gate ────────────────────────────────── */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-xl',
              'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
              'backdrop-blur-lg border border-border-white-15/60',
              'p-3.5 flex items-center gap-3'
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
            <ShieldCheck className="relative z-10 w-4 h-4 text-text-muted-60 shrink-0" />
            <input
              type="text"
              placeholder="Enter access code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && accessCode.trim()) handleValidateCode();
              }}
              disabled={loading !== null}
              autoFocus
              className={cn(
                'relative z-10 flex-1 bg-transparent outline-none',
                'text-sm font-medium text-text-primary',
                'placeholder:text-text-muted-60/30 caret-white',
                'disabled:opacity-50'
              )}
            />
          </div>

          <button
            onClick={handleValidateCode}
            disabled={!accessCode.trim() || loading !== null}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-semibold tracking-wide cursor-pointer',
              'transition-all duration-200',
              !accessCode.trim() || loading !== null
                ? 'bg-white/5 text-text-muted-60/40 cursor-not-allowed border border-border-white-10/30'
                : 'bg-gradient-to-r from-accent/80 to-accent/60 text-white hover:from-accent hover:to-accent/80 border border-accent/30 shadow-lg shadow-accent/10'
            )}
          >
            {loading === 'validating' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </span>
            ) : (
              'CONTINUE'
            )}
          </button>
        </motion.div>
      ) : (
        /* ── Sign-in Options ─────────────────────────────────── */
        <div className="space-y-3">
          {/* Google Sign In Button */}
          <motion.button
            onClick={handleGoogleSignIn}
            disabled={loading !== null || state.isLoading}
            whileHover={loading === null ? { scale: 1.01, y: -1 } : {}}
            whileTap={loading === null ? { scale: 0.99 } : {}}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              'w-full relative overflow-hidden cursor-pointer',
              'px-5 py-4 rounded-xl',
              'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
              'backdrop-blur-lg border border-border-white-15/60',
              'hover:border-border-white-25',
              'hover:from-card/85 hover:via-card/75 hover:to-card/70',
              'transition-all duration-300',
              'shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40',
              'group',
              (loading !== null || state.isLoading) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={false}
            />
            <div className="relative z-10 flex items-center justify-center">
              {loading === 'google' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  <span className="text-sm font-medium text-text-primary">Signing in...</span>
                </>
              ) : (
                <div className="text-sm flex items-center gap-2 font-medium text-text-primary">
                  <Image src="/google.png" alt="Google" width={20} height={20} />
                  <span>Sign in with Google</span>
                </div>
              )}
            </div>
          </motion.button>
        </div>
      )}

      {/* Footer text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-text-muted-50 text-center mt-7 leading-relaxed"
      >
        By connecting, you agree to our Terms of Service
      </motion.p>
    </Modal>
  );
}
