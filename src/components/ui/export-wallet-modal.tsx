'use client';

/**
 * Export Wallet Modal Component
 * Allows users to securely export their EVM or Solana wallet private key
 * via Turnkey's iframe-based export flow
 */

import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './modal';
import { useState, useRef, useCallback } from 'react';
import { turnkeyClient } from '@/lib/turnkey/client';
import { KeyFormat } from '@turnkey/iframe-stamper';

type WalletType = 'evm' | 'solana';

interface ExportWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  evmAddress: string;
  solanaAddress: string;
}

type ExportState = 'idle' | 'exporting' | 'success' | 'error';

export function ExportWalletModal({
  isOpen,
  onClose,
  evmAddress,
  solanaAddress,
}: ExportWalletModalProps) {
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType>('evm');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const iframeContainerRef = useRef<HTMLDivElement>(null);

  const activeAddress = selectedWallet === 'evm' ? evmAddress : solanaAddress;
  const activeKeyFormat = selectedWallet === 'evm' ? KeyFormat.Hexadecimal : KeyFormat.Solana;

  // Remove any existing Turnkey iframe so a fresh one can be created
  const clearIframe = useCallback(() => {
    if (iframeContainerRef.current) {
      iframeContainerRef.current.innerHTML = '';
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!iframeContainerRef.current || !activeAddress) return;

    // Clear stale iframe from a previous export
    clearIframe();

    setExportState('exporting');
    setErrorMessage('');

    try {
      const result = await turnkeyClient.exportWalletAccount(
        activeAddress,
        iframeContainerRef.current,
        activeKeyFormat
      );

      if (result.success) {
        setExportState('success');
      } else {
        setExportState('error');
        setErrorMessage(result.error || 'Export failed');
      }
    } catch (error) {
      setExportState('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }, [activeAddress, activeKeyFormat, clearIframe]);

  const handleClose = () => {
    clearIframe();
    setExportState('idle');
    setErrorMessage('');
    setCopied(false);
    setSelectedWallet('evm');
    setDropdownOpen(false);
    onClose();
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(activeAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleViewOnExplorer = () => {
    const explorerUrl =
      selectedWallet === 'evm'
        ? `https://basescan.org/address/${activeAddress}`
        : `https://solscan.io/account/${activeAddress}`;
    window.open(explorerUrl, '_blank');
  };

  const handleWalletSwitch = (type: WalletType) => {
    if (type === selectedWallet) {
      setDropdownOpen(false);
      return;
    }
    // Clear the old iframe before switching
    clearIframe();
    setSelectedWallet(type);
    setDropdownOpen(false);
    // Reset export state when switching wallets
    setExportState('idle');
    setErrorMessage('');
    setCopied(false);
  };

  const isSuccess = exportState === 'success';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="md" contentClassName="p-6 md:p-8">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-1 tracking-tight">
          EXPORT PRIVATE KEY
        </h2>
        <p className="text-xs text-text-muted-60">Securely export your wallet private key</p>
      </motion.div>

      {/* Wallet Type Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-4"
      >
        <label className="text-xs text-text-muted-60 font-medium mb-2 block">WALLET TYPE</label>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={exportState === 'exporting'}
            className={cn(
              'w-full flex items-center justify-between',
              'rounded-xl px-3.5 py-2.5',
              'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
              'backdrop-blur-lg border border-border-white-15/60',
              'text-xs font-medium text-text-primary',
              'hover:border-border-white-30 transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <span>{selectedWallet === 'evm' ? 'EVM (Hyperliquid)' : 'Solana'}</span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-text-muted-60 transition-transform',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>
          {dropdownOpen && (
            <div
              className={cn(
                'absolute z-20 mt-1 w-full rounded-xl overflow-hidden',
                'bg-card/95 backdrop-blur-lg border border-border-white-15/60',
                'shadow-xl shadow-black/40'
              )}
            >
              <button
                onClick={() => handleWalletSwitch('evm')}
                className={cn(
                  'w-full text-left px-3.5 py-2.5 text-xs',
                  'hover:bg-white/5 transition-colors',
                  selectedWallet === 'evm' ? 'text-text-primary font-medium' : 'text-text-muted-60'
                )}
              >
                EVM (Hyperliquid)
              </button>
              <button
                onClick={() => handleWalletSwitch('solana')}
                className={cn(
                  'w-full text-left px-3.5 py-2.5 text-xs',
                  'hover:bg-white/5 transition-colors',
                  selectedWallet === 'solana'
                    ? 'text-text-primary font-medium'
                    : 'text-text-muted-60'
                )}
              >
                Solana
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Wallet Address Display */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-5"
      >
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-text-muted-60 font-medium">WALLET ADDRESS</label>
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
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
          <div className="relative z-10">
            <p className="text-xs font-mono text-text-primary break-all leading-relaxed">
              {activeAddress}
            </p>
          </div>
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

      {/* Private Key — iframe container always mounted, visibility toggled */}
      <div className={cn(isSuccess ? 'mb-5' : '')}>
        {isSuccess && (
          <label className="text-xs text-text-muted-60 font-medium mb-2 block">PRIVATE KEY</label>
        )}
        <div
          className={cn(
            isSuccess
              ? [
                  'relative overflow-hidden rounded-xl',
                  'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
                  'backdrop-blur-lg border border-border-white-15/60',
                  'p-3.5',
                ]
              : 'w-0 h-0 overflow-hidden absolute pointer-events-none'
          )}
        >
          {isSuccess && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
          )}
          <div
            ref={iframeContainerRef}
            id="turnkey-export-iframe-container-id"
            className="relative z-10"
          />
        </div>
      </div>

      {/* Iframe styling — Turnkey iframe is cross-origin, must use global styles */}
      <style>{`
        #turnkey-export-iframe-container-id iframe {
          width: 100% !important;
          height: 48px !important;
          border: none !important;
          background: transparent !important;
          display: block !important;
          color-scheme: dark !important;
        }
      `}</style>

      {/* Error Message */}
      {exportState === 'error' && errorMessage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <p className="text-xs text-red-400 leading-relaxed">{errorMessage}</p>
        </motion.div>
      )}

      {/* Export Action */}
      {!isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-5"
        >
          <motion.button
            onClick={handleExport}
            disabled={exportState === 'exporting' || !activeAddress}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full relative overflow-hidden rounded-xl',
              'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
              'backdrop-blur-lg border border-border-white-15/60',
              'p-3.5',
              'text-text-primary hover:border-border-white-30',
              'hover:from-card/90 hover:via-card/80 hover:to-card/75',
              'transition-all duration-300 cursor-pointer',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-xl" />
            <div className="relative z-10 flex items-center justify-center gap-2">
              {exportState === 'exporting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-text-muted-60" />
                  <span className="text-xs font-medium text-text-muted-60">Exporting...</span>
                </>
              ) : (
                <span className="text-xs font-medium">Export Private Key</span>
              )}
            </div>
          </motion.button>
        </motion.div>
      )}

      {/* Info Message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="p-3 rounded-lg bg-yellow-700/10 border border-accent/20"
      >
        <p className="text-xs text-text-muted-60 leading-relaxed">
          {isSuccess
            ? 'Select the private key above to copy it. Store it securely offline. It will not be shown again after closing.'
            : 'Your private key grants full control of your wallet. Never share it with anyone and store it securely offline.'}
        </p>
      </motion.div>
    </Modal>
  );
}
