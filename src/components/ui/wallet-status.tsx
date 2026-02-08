/**
 * Wallet Status Component
 * Displays connected wallet information with USDC balance and dropdown menu
 */

'use client';

import { useTurnkey, getEVMAddress } from '@/lib/turnkey';
import { motion } from 'framer-motion';
import { LogOut, Wallet, Key, ArrowDownToLine, ChevronDown, ArrowUpToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useUSDCBalanceBase } from '@/hooks/use-usdc-balance-base';
import Image from 'next/image';
import { DepositModal } from './deposit-modal';
import { ExportWalletModal } from './export-wallet-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function WalletStatus() {
  const { state, logout } = useTurnkey();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const { formattedBalance, isLoading: isBalanceLoading } = useUSDCBalanceBase();

  if (!state.isLoggedIn) {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  const handleExportWallet = () => {
    setIsExportModalOpen(true);
  };

  // Get first wallet address for display
  const walletAddress = getEVMAddress(state.userWallets) || 'Connected';

  // Truncate address for display
  const displayAddress =
    walletAddress.length > 20
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : walletAddress;

  // Format balance for display
  const displayBalance = isBalanceLoading
    ? '...'
    : formattedBalance
      ? `$${formattedBalance}`
      : '$0.00';

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg',
            'bg-card/50 border border-border-white-10/50',
            'hover:border-border-white-20 hover:bg-card/70',
            'transition-colors duration-200 cursor-pointer',
            'outline-none focus:outline-none'
          )}
        >
          {/* USDC Balance */}
          <Image
            src="/tokens/usdc.png"
            alt="USDC"
            width={16}
            height={16}
            className="rounded-full"
          />
          <span className="text-xs font-semibold text-white">{displayBalance}</span>

          {/* Divider */}
          <div className="w-px h-4 bg-border-white-10/50" />

          {/* Wallet Address */}
          <Wallet className="w-3.5 h-3.5 text-text-muted-60" />
          <span className="text-xs font-medium text-text-primary">{displayAddress}</span>

          {/* Chevron */}
          <ChevronDown className="w-3 h-3 text-text-muted-40" />
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-48 bg-card border border-border-white-10/50 backdrop-blur-xl"
      >
        {/* Deposit */}
        <DropdownMenuItem
          onClick={() => setIsDepositModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-white/5 cursor-pointer"
        >
          <ArrowUpToLine className="w-4 h-4 text-text-muted-60" />
          Deposit
        </DropdownMenuItem>

        {/* Export Wallet */}
        <DropdownMenuItem
          onClick={handleExportWallet}
          className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-white/5 cursor-pointer"
        >
          <Key className="w-4 h-4 text-text-muted-60" />
          Export Wallet
        </DropdownMenuItem>

        {/* Withdraw (Coming Soon) */}
        <DropdownMenuItem
          disabled
          className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted-40 cursor-not-allowed"
        >
          <ArrowDownToLine className="w-4 h-4 text-text-muted-40" />
          Withdraw
          <span className="ml-auto text-[10px] text-text-muted-40 uppercase tracking-wider">
            Soon
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border-white-10/50" />

        {/* Logout */}
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
        >
          {isLoggingOut ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DepositModal
      isOpen={isDepositModalOpen}
      onClose={() => setIsDepositModalOpen(false)}
      walletAddress={walletAddress}
    />

    <ExportWalletModal
      isOpen={isExportModalOpen}
      onClose={() => setIsExportModalOpen(false)}
      walletAddress={walletAddress}
    />
    </>
  );
}
