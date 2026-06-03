/**
 * Wallet Status Component
 * Displays connected wallet information with USDC balance and sidebar menu
 */

'use client';

import { useTurnkey, getEVMAddress, getSolanaAddress } from '@/lib/turnkey';
import {
  LogOut,
  Wallet,
  Key,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUSDCBalanceSolana } from '@/hooks/use-usdc-balance-solana';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { getProtocolConfig } from '@/lib/protocols/config';
import Image from 'next/image';
import { DepositModal } from './deposit-modal';
import { ExportWalletModal } from './export-wallet-modal';
import { WithdrawModal } from './withdraw-modal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';

export function WalletStatus() {
  const { state, logout } = useTurnkey();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEvm, setCopiedEvm] = useState(false);
  const { formattedBalance, isLoading: isBalanceLoading } = useUSDCBalanceSolana();
  const {
    hlBalance,
    pacBalance,
    phoenixBalance,
    ltBalance,
    solanaBalance,
    isLoading: isExchangeLoading,
  } = useExchangeBalances();

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
  const evmAddress = getEVMAddress(state.userWallets) || '';
  const solanaAddress = getSolanaAddress(state.userWallets) || '';

  const handleCopyAddress = useCallback(() => {
    if (!solanaAddress) return;
    navigator.clipboard.writeText(solanaAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [solanaAddress]);

  const handleCopyEvmAddress = useCallback(() => {
    if (!evmAddress || evmAddress === 'Connected') return;
    navigator.clipboard.writeText(evmAddress).then(() => {
      setCopiedEvm(true);
      setTimeout(() => setCopiedEvm(false), 1500);
    });
  }, [evmAddress]);

  if (!state.isLoggedIn) {
    return null;
  }

  const hlConfig = getProtocolConfig('hyperliquid');
  const pacConfig = getProtocolConfig('pacifica');
  const phxConfig = getProtocolConfig('phoenix');
  const ltConfig = getProtocolConfig('lighter');

  const totalBalance =
    hlBalance + pacBalance + phoenixBalance + ltBalance + solanaBalance;
  const formattedTotalBalance = totalBalance.toFixed(2);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
    setIsSidebarOpen(false);
  };

  const handleOpenDeposit = () => {
    setIsSidebarOpen(false);
    setIsDepositModalOpen(true);
  };

  const handleOpenWithdraw = () => {
    setIsSidebarOpen(false);
    setIsWithdrawModalOpen(true);
  };

  const handleOpenExport = () => {
    setIsSidebarOpen(false);
    setIsExportModalOpen(true);
  };

  // Balance has never been fetched yet (null initial state)
  const hasLoaded =
    formattedBalance !== '0.00' || (!isBalanceLoading && formattedBalance === '0.00');
  const showSkeleton = (isBalanceLoading && !hasLoaded) || isExchangeLoading;

  return (
    <>
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetTrigger asChild>
          <button
            className={cn(
              'bg-[#2ECC71] border-2 border-[#242930] rounded-md px-3 py-1.5 flex items-center gap-2',
              'hover:border-border-white-20 transition-colors cursor-pointer outline-none relative'
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
                <>
                  <span className="text-xs font-semibold text-black tabular-nums">
                    ${formattedTotalBalance}
                  </span>
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyAddress();
                    }}
                    className="flex shrink-0 items-center justify-center w-7 h-7 bg-black/10 border border-black/10 hover:bg-black/20 hover:border-black/20 transition-all rounded-md cursor-pointer ml-1"
                    title="Copy Solana Address"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-black" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-black/70" />
                    )}
                  </div>
                </>
              )}

              {/* Margin Breakdown Hover Card */}
              <AnimatePresence>
                {balanceHover && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    onMouseEnter={handleBalanceEnter}
                    onMouseLeave={handleBalanceLeave}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50',
                      'w-56 rounded-sm',
                      'bg-card border border-border-white-10',
                      'pointer-events-auto shadow-xl'
                    )}
                  >
                    {/* Caret arrow */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card border-l border-t border-border-white-10/50" />

                    <div className="relative z-10 p-3 space-y-3 text-white">
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

                      {/* Lighter row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            {ltConfig && (
                              <Image
                                src={ltConfig.logo}
                                alt={ltConfig.displayName}
                                width={20}
                                height={20}
                                className="rounded-full ring-1 ring-white/10"
                              />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-text-primary leading-tight">
                              {ltConfig?.displayName ?? 'Lighter'}
                            </span>
                          </div>
                        </div>
                        {isExchangeLoading ? (
                          <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                        ) : (
                          <span className="text-xs font-semibold text-text-primary tabular-nums">
                            ${ltBalance.toFixed(2)}
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
                            ${solanaBalance.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </button>
        </SheetTrigger>

        <SheetContent className="bg-[#18181A] border-l border-white/10 text-white w-full sm:max-w-md p-6 flex flex-col gap-6">
          <SheetHeader className="p-0 space-y-1">
            <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#2ECC71]" />
              Wallet Overview
            </SheetTitle>
            <SheetDescription className="text-xs text-white/40">
              Manage your connected wallets and balances
            </SheetDescription>
          </SheetHeader>

          {evmAddress && evmAddress !== 'Connected' && (
            <div className="bg-[#202024] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">EVM Address</span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white/60 select-all break-all pr-2 truncate">
                    {evmAddress}
                  </span>
                  <button
                    onClick={handleCopyEvmAddress}
                    className="flex shrink-0 items-center justify-center w-7 h-7 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all rounded-md cursor-pointer"
                    title="Copy EVM Address"
                  >
                    {copiedEvm ? (
                      <Check className="w-3.5 h-3.5 text-[#2ECC71]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-white/70" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Section */}
          <div className="flex flex-col gap-2.5 mt-4">
            <button
              onClick={handleOpenDeposit}
              className="bg-[#2ECC71] hover:bg-[#27ae60] text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-black/10 text-xs"
            >
              <ArrowUpToLine className="w-4 h-4" />
              DEPOSIT FUNDS
            </button>

            <button
              onClick={handleOpenWithdraw}
              className="bg-[#202024] hover:bg-[#28282c] border border-white/10 hover:border-white/20 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
            >
              <ArrowDownToLine className="w-4 h-4 text-white/70" />
              WITHDRAW FUNDS
            </button>
          </div>

          {/* Settings / Footer Utilities */}
          <div className="flex flex-col gap-2 mt-auto pt-6 border-t border-white/5">
            <button
              onClick={handleOpenExport}
              className="w-full px-3 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
            >
              <Key className="w-4 h-4 text-white/40" />
              Export Private Key
            </button>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full px-3 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" />
              ) : (
                <LogOut className="w-4 h-4 text-red-400/80" />
              )}
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        walletAddress={solanaAddress}
      />

      <ExportWalletModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        evmAddress={evmAddress}
        solanaAddress={solanaAddress}
      />

      <WithdrawModal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} />
    </>
  );
}
