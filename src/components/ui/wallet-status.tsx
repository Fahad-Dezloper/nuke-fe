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
import { useState, useCallback } from 'react';
import { useUSDCBalanceSolana } from '@/hooks/use-usdc-balance-solana';
import { useExchangeBalances } from '@/hooks/use-exchange-balances';
import { getProtocolConfig } from '@/lib/protocols/config';
import Image from 'next/image';
import { DepositModal } from './deposit-modal';
import { ExportWalletModal } from './export-wallet-modal';
import { WithdrawModal } from './withdraw-modal';
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
    isLoading: isExchangeLoading,
  } = useExchangeBalances();

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

  // Truncate address for display on the trigger button
  const displayAddress =
    solanaAddress.length > 20
      ? `${solanaAddress.slice(0, 3)}...${solanaAddress.slice(-3)}`
      : solanaAddress;

  // Calculate total USDC
  const totalBalance = Number(formattedBalance) + hlBalance + pacBalance + phoenixBalance;
  const isLoading = isBalanceLoading || isExchangeLoading;

  return (
    <>
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetTrigger asChild>
          <button
            className={cn(
              'bg-[#2ECC71] border-2 border-[#242930] rounded-md px-3 py-1.5 flex items-center gap-2',
              'hover:border-border-white-20 transition-colors cursor-pointer outline-none'
            )}
          >
            <WalletIcon />
            <span className="text-xs font-semibold text-black">{displayAddress}</span>
          </button>
        </SheetTrigger>

        <SheetContent className="bg-[#18181A] border-l border-white/10 text-white w-full sm:max-w-md p-6 flex flex-col gap-6">
          <SheetHeader className="p-0 space-y-1">
            <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#2ECC71]" />
              Wallet Overview
            </SheetTitle>
            <SheetDescription className="text-xs text-white/40">
              Manage your balances, deposit, and withdraw funds
            </SheetDescription>
          </SheetHeader>

          {/* Account Details Card */}
          <div className="bg-[#202024] border border-white/5 rounded-xl p-4 space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Solana Address</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-white/80 select-all break-all pr-2">
                  {solanaAddress}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="flex shrink-0 items-center justify-center w-7 h-7 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all rounded-md cursor-pointer"
                  title="Copy Solana Address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#2ECC71]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/70" />
                  )}
                </button>
              </div>
            </div>

            {evmAddress && evmAddress !== 'Connected' && (
              <div className="pt-2.5 border-t border-white/5 space-y-1">
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
            )}
          </div>

          {/* Balances Card */}
          <div className="bg-gradient-to-b from-[#202024] to-[#1C1C20] border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Total Balance</span>
              {isLoading ? (
                <div className="w-32 h-8 rounded bg-white/5 animate-pulse mt-1" />
              ) : (
                <span className="text-3xl font-extrabold text-white tabular-nums tracking-tight">
                  ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            <div className="border-t border-white/5 pt-3 space-y-3">
              {/* Solana Wallet row */}
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
                      width={18}
                      height={18}
                      className="rounded-full ring-1 ring-white/10"
                    />
                  </div>
                  <span className="text-xs font-medium text-white/80">Solana Wallet USDC</span>
                </div>
                {isBalanceLoading ? (
                  <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                ) : (
                  <span className="text-xs font-bold text-white tabular-nums">
                    ${Number(formattedBalance).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Hyperliquid row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {hlConfig && (
                    <Image
                      src={hlConfig.logo}
                      alt={hlConfig.displayName}
                      width={18}
                      height={18}
                      className="rounded-full ring-1 ring-white/10"
                    />
                  )}
                  <span className="text-xs font-medium text-white/80">{hlConfig?.displayName ?? 'Hyperliquid'}</span>
                </div>
                {isExchangeLoading ? (
                  <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                ) : (
                  <span className="text-xs font-bold text-white tabular-nums">
                    ${hlBalance.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Pacifica row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {pacConfig && (
                    <Image
                      src={pacConfig.logo}
                      alt={pacConfig.displayName}
                      width={18}
                      height={18}
                      className="rounded-full ring-1 ring-white/10"
                    />
                  )}
                  <span className="text-xs font-medium text-white/80">{pacConfig?.displayName ?? 'Pacifica'}</span>
                </div>
                {isExchangeLoading ? (
                  <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                ) : (
                  <span className="text-xs font-bold text-white tabular-nums">
                    ${pacBalance.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Phoenix row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {phxConfig && (
                    <Image
                      src={phxConfig.logo}
                      alt={phxConfig.displayName}
                      width={18}
                      height={18}
                      className="rounded-full ring-1 ring-white/10"
                    />
                  )}
                  <span className="text-xs font-medium text-white/80">{phxConfig?.displayName ?? 'Phoenix'}</span>
                </div>
                {isExchangeLoading ? (
                  <div className="w-14 h-4 rounded bg-white/5 animate-pulse" />
                ) : (
                  <span className="text-xs font-bold text-white tabular-nums">
                    ${phoenixBalance.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="flex flex-col gap-2.5">
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

const WalletIcon = () => {
  return (
    <svg width="16" height="13" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.06043 12.2417C2.21881 12.2417 1.49833 11.942 0.899 11.3427C0.299667 10.7434 0 10.0229 0 9.18128V3.06043C0 2.21881 0.299667 1.49833 0.899 0.899001C1.49833 0.299667 2.21881 4.76837e-07 3.06043 4.76837e-07H12.2417C13.0833 4.76837e-07 13.8038 0.299667 14.4031 0.899001C15.0025 1.49833 15.3021 2.21881 15.3021 3.06043V9.18128C15.3021 10.0229 15.0025 10.7434 14.4031 11.3427C13.8038 11.942 13.0833 12.2417 12.2417 12.2417H3.06043ZM3.06043 3.06043H12.2417C12.5222 3.06043 12.79 3.09231 13.0451 3.15606C13.3001 3.21982 13.5424 3.32184 13.7719 3.46211V3.06043C13.7719 2.63962 13.6221 2.27938 13.3224 1.97971C13.0227 1.68005 12.6625 1.53021 12.2417 1.53021H3.06043C2.63962 1.53021 2.27938 1.68005 1.97971 1.97971C1.68005 2.27938 1.53021 2.63962 1.53021 3.06043V3.46211C1.75974 3.32184 2.00203 3.21982 2.25706 3.15606C2.5121 3.09231 2.77989 3.06043 3.06043 3.06043ZM1.64498 5.54702L10.1568 7.61281C10.2716 7.63831 10.3863 7.63831 10.5011 7.61281C10.6159 7.58731 10.7242 7.5363 10.8263 7.45979L13.485 5.24098C13.3447 5.0497 13.1662 4.89349 12.9494 4.77235C12.7326 4.65121 12.4967 4.59064 12.2417 4.59064H3.06043C2.72888 4.59064 2.43878 4.67671 2.19012 4.84886C1.94146 5.02101 1.75974 5.25373 1.64498 5.54702Z"
        fill="#000000"
      />
    </svg>
  );
};
