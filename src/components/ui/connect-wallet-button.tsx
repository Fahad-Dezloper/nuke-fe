'use client';

/**
 * Connect Wallet Button Component
 * Reusable button for wallet connection
 */

import { useState } from 'react';
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
      <button
        onClick={handleClick}
        className={cn(
          'rounded-sm cursor-pointer font-medium transition-colors',
          sizeClasses[size],
          fullWidth
            ? 'w-full bg-green text-black font-bold hover:bg-green/90'
            : 'bg-card border border-border-white-10 text-text-primary hover:border-border-white-20',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {children || text || 'Connect Wallet'}
      </button>

      <ConnectWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onEOAConnect={handleEOAConnect}
      />
    </>
  );
}
