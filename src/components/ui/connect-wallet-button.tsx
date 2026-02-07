'use client';

/**
 * Connect Wallet Button Component
 * Reusable button with glassmorphism styling for wallet connection
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ConnectWalletModal } from './connect-wallet-modal';

interface ConnectWalletButtonProps {
  onClick?: () => void;
  onGoogleSignIn?: () => void;
  onEOAConnect?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children?: React.ReactNode;
  text?: string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function ConnectWalletButton({
  onClick,
  onGoogleSignIn,
  onEOAConnect,
  className,
  size = 'sm',
  fullWidth = false,
  children,
  text,
  disabled = false,
}: ConnectWalletButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleGoogleSignIn = () => {
    setIsModalOpen(false);
    onGoogleSignIn?.();
  };

  const handleEOAConnect = () => {
    setIsModalOpen(false);
    onEOAConnect?.();
  };

  return (
    <>
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'relative overflow-hidden rounded-xl',
          'bg-gradient-to-br from-card/60 via-card/50 to-card/40',
          'backdrop-blur-xl border border-border-white-10/50',
          'text-text-primary',
          'hover:border-border-white-30',
          'hover:from-card/70 hover:via-card/60 hover:to-card/50',
          'hover:backdrop-blur-2xl',
          'font-medium transition-all duration-300',
          'shadow-lg shadow-black/30 hover:shadow-black/40',
          sizeClasses[size],
          fullWidth && 'w-full',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />

        {/* Button text */}
        <span className="relative z-10">{children || text || 'CONNECT WALLET'}</span>
      </motion.button>

      <ConnectWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onEOAConnect={handleEOAConnect}
      />
    </>
  );
}
