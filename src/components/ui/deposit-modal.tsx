'use client';

/**
 * Deposit Modal Component
 * Modal for depositing USDC on Base network
 */

import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Modal } from './modal';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { useUSDCBalanceBase } from '@/hooks/use-usdc-balance-base';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  balance?: string;
}

// USDC logo URL - using CDN link
// Fallback to simple colored circles if image fails to load
const USDC_LOGO_URL =
  'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png?1547042389';

export function DepositModal({
  isOpen,
  onClose,
  walletAddress: propWalletAddress,
  balance: propBalance,
}: DepositModalProps) {
  const { state: turnkeyState } = useTurnkey();
  const { formattedBalance, isLoading: isLoadingBalance, refresh } = useUSDCBalanceBase();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usdcImageError, setUsdcImageError] = useState(false);
  const [baseImageError, setBaseImageError] = useState(false);
  const lastFetchedAddressRef = useRef<string>('');

  // Get wallet address from Turnkey if not provided
  // Extract address first to avoid dependency on array reference
  const extractedAddress =
    propWalletAddress ||
    (turnkeyState.isLoggedIn && turnkeyState.userWallets?.length
      ? getEVMAddress(turnkeyState.userWallets) || ''
      : '');

  // Memoize based on the actual address string, not the wallets array
  const walletAddress = useMemo(() => extractedAddress, [extractedAddress]);

  // Use prop balance if provided, otherwise use global balance
  const balance = propBalance || formattedBalance;

  // Fetch balance when modal opens or wallet address changes (only once per address)
  useEffect(() => {
    if (isOpen && walletAddress && !propBalance && !isLoadingBalance) {
      // Only fetch if we haven't fetched for this address yet
      if (lastFetchedAddressRef.current !== walletAddress) {
        lastFetchedAddressRef.current = walletAddress;
        refresh();
      }
    } else if (!isOpen) {
      // Reset when modal closes
      lastFetchedAddressRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, walletAddress, propBalance]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleRefreshBalance = async () => {
    if (!walletAddress) return;

    setIsRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      console.error('Error refreshing balance:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewOnExplorer = () => {
    const explorerUrl = `https://basescan.org/address/${walletAddress}`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" contentClassName="p-6 md:p-8">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-1 tracking-tight">
          DEPOSIT USDC
        </h2>
        <p className="text-xs text-text-muted-60">
          Send USDC to your deposit address on Base network
        </p>
      </motion.div>

      {/* Balance Display */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-5"
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-xl',
            'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
            'backdrop-blur-lg border border-border-white-15/60',
            'p-4'
          )}
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative w-7 h-7 flex items-center justify-center">
                {!usdcImageError ? (
                  <Image
                    src={USDC_LOGO_URL}
                    alt="USDC"
                    width={28}
                    height={28}
                    className="rounded-full"
                    onError={() => setUsdcImageError(true)}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                    <span className="text-xs font-semibold text-blue-400">U</span>
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                {isLoadingBalance ? (
                  <span className="text-xl font-semibold text-text-muted-60">...</span>
                ) : (
                  <span className="text-xl font-semibold text-text-primary">{balance}</span>
                )}
                <span className="text-sm text-text-muted-60 font-medium">USDC</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card/50 border border-border-white-10/50">
                <div className="relative w-3.5 h-3.5 flex items-center justify-center">
                  {!baseImageError ? (
                    <Image
                      src="/tokens/base.jpg"
                      alt="Base"
                      width={14}
                      height={14}
                      className="rounded-full"
                      onError={() => setBaseImageError(true)}
                    />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-400/30 border border-blue-400/50 flex items-center justify-center">
                      <span className="text-[7px] font-semibold text-blue-300">B</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-text-muted-60 font-medium">Base</span>
              </div>
              <motion.button
                onClick={handleRefreshBalance}
                disabled={isRefreshing}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-lg',
                  'text-text-muted-60 hover:text-text-primary',
                  'hover:bg-card/50 transition-colors duration-200',
                  isRefreshing && 'opacity-50 cursor-not-allowed'
                )}
                title="Refresh balance"
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Address Display */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-5"
      >
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-text-muted-60 font-medium">DEPOSIT ADDRESS</label>
          <motion.button
            onClick={handleViewOnExplorer}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 text-xs text-text-muted-60 hover:text-text-primary transition-colors"
          >
            <span>Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </motion.button>
        </div>
        <div
          className={cn(
            'relative overflow-hidden rounded-xl',
            'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
            'backdrop-blur-lg border border-border-white-15/60',
            'p-3.5 pr-11'
          )}
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />

          <div className="relative z-10">
            <p className="text-xs font-mono text-text-primary break-all leading-relaxed">
              {walletAddress}
            </p>
          </div>

          {/* Copy Button */}
          <motion.button
            onClick={handleCopyAddress}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'absolute top-1/2 right-2.5 -translate-y-1/2',
              'w-7 h-7 flex items-center justify-center',
              'rounded-lg bg-card/50 border border-border-white-10/50',
              'text-text-muted-60 hover:text-text-primary',
              'backdrop-blur-sm transition-colors duration-200',
              'hover:border-border-white-20 hover:bg-card/70'
            )}
            title={copied ? 'Copied!' : 'Copy address'}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Info Message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="p-3 rounded-lg text-yellow-600 bg-yellow-700/10 border border-accent/20"
      >
        <p className="text-xs text-text-muted-60 leading-relaxed">
          Only send USDC on Base network. Other tokens or networks may result in permanent loss.
        </p>
      </motion.div>
    </Modal>
  );
}
