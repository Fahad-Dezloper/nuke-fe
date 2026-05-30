'use client';

/**
 * Deposit Button Component
 * Button to open deposit modal
 */

import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
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
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
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
      <motion.button
        onClick={handleClick}
        className={cn(
          'relative overflow-hidden rounded-md',
          'bg-gradient-to-br from-card/60 via-card/50 to-card/40',
          'backdrop-blur-xl border border-border-white-10/50',
          'text-text-primary',
          'hover:border-border-white-20 hover:bg-card/70',
          'transition-colors duration-200 cursor-pointer',
          'outline-none focus:outline-none',
          'font-medium transition-all duration-300',
          'shadow-lg shadow-black/30 hover:shadow-black/40 cursor-pointer',
          'flex items-center gap-2',
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-[#008753] rounded-md" />
        {/* Button content */}{' '}
        <span className="relative z-10 text-xs text-white font-bold">DEPOSIT</span>
      </motion.button>

      <DepositModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        walletAddress={walletAddress}
        balance={balance}
      />
    </>
  );
}
