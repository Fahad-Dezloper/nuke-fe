'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import { DepositModal } from './deposit-modal';

interface DepositButtonProps {
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  walletAddress?: string;
  balance?: string;
}

const sizeClasses = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

export function DepositButton({
  onClick,
  className,
  size = 'sm',
  fullWidth = false,
  walletAddress,
  balance,
}: DepositButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'btn-primary font-semibold tracking-tight',
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
      >
        Deposit
      </button>

      <DepositModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        walletAddress={walletAddress}
        balance={balance}
      />
    </>
  );
}
