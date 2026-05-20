/**
 * Wallet Status Component
 * Displays connected wallet information with USDC balance and dropdown menu
 */

'use client';

import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  Wallet,
  Key,
  ArrowDownToLine,
  ChevronDown,
  ArrowUpToLine,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useUSDCBalanceSolana } from '@/hooks/use-usdc-balance-solana';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { getProtocolConfig } from '@/lib/protocols/config';
import Image from 'next/image';
import { DepositModal } from './deposit-modal';
import { ExportWalletModal } from './export-wallet-modal';
import { WithdrawModal } from './withdraw-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function WalletStatus() {
  const { state, logout } = useTurnkey();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { formattedBalance, isLoading: isBalanceLoading } = useUSDCBalanceSolana();
  const { hlBalance, pacBalance, phoenixBalance, isLoading: isExchangeLoading } = useExchangeBalances();
  const [balanceHover, setBalanceHover] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBalanceEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setBalanceHover(true);
  }, []);

  const handleBalanceLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setBalanceHover(false), 150);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  // Get wallet addresses
  const walletAddress = getEVMAddress(state.userWallets) || 'Connected';
  const solanaAddress = getSolanaAddress(state.userWallets) || '';

  const handleCopyAddress = useCallback(() => {
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [walletAddress]);

  if (!state.isLoggedIn) {
    return null;
  }

  const hlConfig = getProtocolConfig('hyperliquid');
  const pacConfig = getProtocolConfig('pacifica');
  const phxConfig = getProtocolConfig('phoenix');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  const handleExportWallet = () => {
    setIsExportModalOpen(true);
  };

  // Truncate address for display
  const displayAddress =
    walletAddress.length > 20
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : walletAddress;

  // Balance has never been fetched yet (null initial state)
  const hasLoaded =
    formattedBalance !== '0.00' || (!isBalanceLoading && formattedBalance === '0.00');
  const showSkeleton = isBalanceLoading && !hasLoaded;

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
            {/* USDC Balance with hover breakdown */}
            <div
              className="relative flex items-center gap-2"
              onMouseEnter={handleBalanceEnter}
              onMouseLeave={handleBalanceLeave}
            >
              <Image
                src="/tokens/usdc.png"
                alt="USDC"
                width={16}
                height={16}
                className="rounded-full"
              />
              {showSkeleton ? (
                <div className="w-12 h-3.5 rounded bg-white/10 animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-white tabular-nums">
                  ${formattedBalance}
                </span>
              )}

              {/* Margin Breakdown Hover Card */}
              <AnimatePresence>
                {balanceHover && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    onMouseEnter={handleBalanceEnter}
                    onMouseLeave={handleBalanceLeave}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50',
                      'w-56 rounded-xl',
                      'bg-card border border-border-white-10/50 backdrop-blur-xl',
                      'shadow-xl shadow-black/60',
                      'pointer-events-auto'
                    )}
                  >
                    {/* Caret arrow */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card border-l border-t border-border-white-10/50" />

                    <div className="relative z-10 p-3 space-y-3">
                      {/* Hyperliquid row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            {hlConfig && (
                              <Image
                                src={hlConfig.logo}
                                alt={hlConfig.displayName}
                                width={20}
                                height={20}
                                className="rounded-full ring-1 ring-white/10"
                              />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-text-primary leading-tight">
                              {hlConfig?.displayName ?? 'Hyperliquid'}
                            </span>
                          </div>
                        </div>
                        {isExchangeLoading ? (
                          <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                        ) : (
                          <span className="text-xs font-semibold text-text-primary tabular-nums">
                            ${hlBalance.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Pacifica row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            {pacConfig && (
                              <Image
                                src={pacConfig.logo}
                                alt={pacConfig.displayName}
                                width={20}
                                height={20}
                                className="rounded-full ring-1 ring-white/10"
                              />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-text-primary leading-tight">
                              {pacConfig?.displayName ?? 'Pacifica'}
                            </span>
                          </div>
                        </div>
                        {isExchangeLoading ? (
                          <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                        ) : (
                          <span className="text-xs font-semibold text-text-primary tabular-nums">
                            ${pacBalance.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Phoenix row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            {phxConfig && (
                              <Image
                                src={phxConfig.logo}
                                alt={phxConfig.displayName}
                                width={20}
                                height={20}
                                className="rounded-full ring-1 ring-white/10"
                              />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-text-primary leading-tight">
                              {phxConfig?.displayName ?? 'Phoenix'}
                            </span>
                          </div>
                        </div>
                        {isExchangeLoading ? (
                          <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                        ) : (
                          <span className="text-xs font-semibold text-text-primary tabular-nums">
                            ${phoenixBalance.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Separator */}
                      <div className="border-t border-border-white-10/50" />

                      {/* Solana wallet row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <Image
                              src="/tokens/solana.webp"
                              alt="Solana"
                              width={10}
                              height={10}
                              className="rounded-full ring-1 ring-white/10 absolute -top-[2px] -right-[2px]"
                            />
                            <Image
                              src="/tokens/usdc.png"
                              alt="USDC"
                              width={20}
                              height={20}
                              className="rounded-full ring-1 ring-white/10"
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-text-primary leading-tight">
                              SOLANA USDC
                            </span>
                          </div>
                        </div>
                        {showSkeleton ? (
                          <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                        ) : (
                          <span className="text-xs font-semibold text-text-primary tabular-nums">
                            ${Number(formattedBalance).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
          {/* Wallet Address */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleCopyAddress();
            }}
            className="flex items-center justify-between px-3 py-2 text-xs text-text-muted-60 hover:bg-white/5 cursor-pointer"
          >
            <span className="font-mono">{displayAddress}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border-white-10/50" />

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

          {/* Withdraw */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenuItem
                    // onClick={() => setIsWithdrawModalOpen(true)}
                    disabled
                    className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-white/5 cursor-pointer"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-text-muted-60" />
                    Withdraw
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                Coming soon
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

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
        evmAddress={walletAddress}
        solanaAddress={solanaAddress}
      />

      <WithdrawModal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} />
    </>
  );
}
