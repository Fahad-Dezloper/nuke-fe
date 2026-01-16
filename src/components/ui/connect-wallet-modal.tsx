'use client';

/**
 * Connect Wallet Modal Component
 * Modal for wallet connection with Google Sign-in, EVM, and Solana wallet options
 */

import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Modal } from './modal';
import { useTurnkey } from '@/lib/turnkey';
import { useState } from 'react';

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
  const { loginWithGoogle, loginWithEVMWallet, loginWithSolanaWallet, state } =
    useTurnkey();
  const [loading, setLoading] = useState<'google' | 'evm' | 'solana' | null>(
    null
  );
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading('google');
      setError('');
      await loginWithGoogle();
      onGoogleSignIn?.();
      // Note: Google OAuth will redirect, so we don't close modal here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(null);
    }
  };

  const handleEVMConnect = async () => {
    try {
      setLoading('evm');
      setError('');
      const success = await loginWithEVMWallet();
      if (success) {
        onEOAConnect?.();
        onClose();
      } else {
        setError('Failed to connect EVM wallet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setLoading(null);
    }
  };

  const handleSolanaConnect = async () => {
    try {
      setLoading('solana');
      setError('');
      const success = await loginWithSolanaWallet();
      if (success) {
        onEOAConnect?.();
        onClose();
      } else {
        setError('Failed to connect Solana wallet');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect Solana wallet'
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth='md'
      contentClassName='p-8 md:p-10'>
      {/* Logo and Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className='flex flex-col items-center mb-8'>
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            delay: 0.15,
            stiffness: 200,
          }}
          className='mb-5'>
          <Image
            src='/logo.png'
            alt='Nuke Logo'
            width={56}
            height={56}
            className='drop-shadow-xl'
          />
        </motion.div>
        <h2 className='text-xl font-semibold text-text-primary mb-2 tracking-tight'>
          CONNECT WALLET
        </h2>
        <p className='text-xs text-text-muted-60 text-center max-w-xs leading-relaxed'>
          Choose your preferred method to connect and start trading
        </p>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className='mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-300 text-sm'>
          {error}
        </motion.div>
      )}

      {/* Buttons */}
      <div className='space-y-3'>
        {/* Google Sign In Button */}
        <motion.button
          onClick={handleGoogleSignIn}
          disabled={loading !== null || state.isLoading}
          whileHover={loading === null ? { scale: 1.01, y: -1 } : {}}
          whileTap={loading === null ? { scale: 0.99 } : {}}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className={cn(
            'w-full relative overflow-hidden',
            'px-5 py-4 rounded-xl',
            'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
            'backdrop-blur-lg border border-border-white-15/60',
            'hover:border-border-white-25',
            'hover:from-card/85 hover:via-card/75 hover:to-card/70',
            'transition-all duration-300',
            'shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40',
            'group',
            (loading !== null || state.isLoading) &&
              'opacity-50 cursor-not-allowed'
          )}>
          {/* Glassmorphism overlay */}
          <div className='absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl' />

          {/* Hover glow effect */}
          <motion.div
            className='absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
            initial={false}
          />

          <div className='relative z-10 flex items-center justify-center'>
            {loading === 'google' ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                <span className='text-sm font-medium text-text-primary'>
                  Signing in...
                </span>
              </>
            ) : (
              <span className='text-sm font-medium text-text-primary'>
                Sign in with Google
              </span>
            )}
          </div>
        </motion.button>

        {/* Divider */}
        <div className='relative my-4'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-t border-border-white-10'></div>
          </div>
          <div className='relative flex justify-center text-sm'>
            <span className='px-2 bg-card text-text-muted-40'>Or connect with</span>
          </div>
        </div>

        {/* EVM Wallet Button */}
        <motion.button
          onClick={handleEVMConnect}
          disabled={loading !== null || state.isLoading}
          whileHover={loading === null ? { scale: 1.01, y: -1 } : {}}
          whileTap={loading === null ? { scale: 0.99 } : {}}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 300 }}
          className={cn(
            'w-full relative overflow-hidden',
            'px-5 py-4 rounded-xl',
            'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
            'backdrop-blur-lg border border-border-white-15/60',
            'hover:border-border-white-25',
            'hover:from-card/85 hover:via-card/75 hover:to-card/70',
            'transition-all duration-300',
            'shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40',
            'group',
            (loading !== null || state.isLoading) &&
              'opacity-50 cursor-not-allowed'
          )}>
          {/* Glassmorphism overlay */}
          <div className='absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl' />

          {/* Hover glow effect */}
          <motion.div
            className='absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
            initial={false}
          />

          <div className='relative z-10 flex items-center justify-center gap-2.5'>
            {loading === 'evm' ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                <span className='text-sm font-medium text-text-primary'>
                  Connecting...
                </span>
              </>
            ) : (
              <>
                <Wallet className='w-5 h-5 text-text-primary' />
                <span className='text-sm font-medium text-text-primary'>
                  Connect EVM Wallet
                </span>
              </>
            )}
          </div>
        </motion.button>

        {/* Solana Wallet Button */}
        <motion.button
          onClick={handleSolanaConnect}
          disabled={loading !== null || state.isLoading}
          whileHover={loading === null ? { scale: 1.01, y: -1 } : {}}
          whileTap={loading === null ? { scale: 0.99 } : {}}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
          className={cn(
            'w-full relative overflow-hidden',
            'px-5 py-4 rounded-xl',
            'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
            'backdrop-blur-lg border border-border-white-15/60',
            'hover:border-border-white-25',
            'hover:from-card/85 hover:via-card/75 hover:to-card/70',
            'transition-all duration-300',
            'shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40',
            'group',
            (loading !== null || state.isLoading) &&
              'opacity-50 cursor-not-allowed'
          )}>
          {/* Glassmorphism overlay */}
          <div className='absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl' />

          {/* Hover glow effect */}
          <motion.div
            className='absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
            initial={false}
          />

          <div className='relative z-10 flex items-center justify-center gap-2.5'>
            {loading === 'solana' ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                <span className='text-sm font-medium text-text-primary'>
                  Connecting...
                </span>
              </>
            ) : (
              <>
                <span className='text-lg mr-1'>👻</span>
                <span className='text-sm font-medium text-text-primary'>
                  Connect Phantom
                </span>
              </>
            )}
          </div>
        </motion.button>
      </div>

      {/* Footer text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className='text-xs text-text-muted-50 text-center mt-7 leading-relaxed'>
        By connecting, you agree to our Terms of Service
      </motion.p>
    </Modal>
  );
}
