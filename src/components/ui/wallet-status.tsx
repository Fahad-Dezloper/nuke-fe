/**
 * Wallet Status Component
 * Displays connected wallet information and logout option
 */

'use client';

import { useTurnkey, getEVMAddress } from '@/lib/turnkey';
import { motion } from 'framer-motion';
import { LogOut, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function WalletStatus() {
  const { state, logout } = useTurnkey();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!state.isLoggedIn) {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  // Get first wallet address for display
  const walletAddress = getEVMAddress(state.userWallets) || 'Connected';

  // Truncate address for display
  const displayAddress =
    walletAddress.length > 20
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : walletAddress;

  return (
    <div className='flex items-center gap-2'>
      {/* Wallet Info */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border-white-10/50'>
        <Wallet className='w-4 h-4 text-text-primary' />
        <span className='text-xs font-medium text-text-primary'>
          {displayAddress}
        </span>
      </motion.div>

      {/* Logout Button */}
      <motion.button
        onClick={handleLogout}
        disabled={isLoggingOut}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'p-1.5 rounded-lg',
          'bg-card/50 border border-border-white-10/50',
          'text-text-muted-60 hover:text-text-primary',
          'hover:border-border-white-20 hover:bg-card/70',
          'transition-colors duration-200',
          isLoggingOut && 'opacity-50 cursor-not-allowed'
        )}
        title='Logout'>
        {isLoggingOut ? (
          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-text-primary' />
        ) : (
          <LogOut className='w-4 h-4' />
        )}
      </motion.button>
    </div>
  );
}
