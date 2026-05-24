'use client';

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
  variant?: 'default' | 'primary';
}

const sizeClasses = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
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
  variant = 'default',
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

  const label = children || text || 'Connect wallet';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'rounded-sm font-semibold cursor-pointer transition-all duration-150',
          sizeClasses[size],
          fullWidth && 'w-full',
          disabled && 'opacity-50 cursor-not-allowed',
          variant === 'primary'
            ? 'bg-green text-black hover:bg-green/90 active:scale-[0.99]'
            : 'border border-border-white-10 bg-secondary text-text-primary hover:border-border-white-20 hover:bg-card',
          className
        )}
      >
        {label}
      </button>

      <ConnectWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGoogleSignIn={() => {
          setIsModalOpen(false);
          onGoogleSignIn?.();
        }}
        onEOAConnect={() => {
          setIsModalOpen(false);
          onEOAConnect?.();
        }}
      />
    </>
  );
}
