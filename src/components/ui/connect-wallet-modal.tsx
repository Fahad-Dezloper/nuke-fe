'use client';

/**
 * Connect Wallet Modal Component
 * Modal for wallet connection with Google Sign-in plus EVM (EIP-6963) and Solana injects.
 * Gated behind an access code validated server-side before Turnkey is touched.
 */

import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, Wallet } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Modal } from './modal';
import { useTurnkey } from '@/lib/turnkey';
import { useState, useCallback, useEffect } from 'react';
import { storeAccessCode } from '@/lib/auth/access-code';
import {
  subscribeEip6963Providers,
  type Eip6963ProviderDetail,
} from '@/lib/wallet-discovery/eip6963';
import {
  listDetectedSolanaWallets,
  type SolanaWalletKind,
} from '@/lib/wallet-discovery/solana-injected';

const WALLET_GRID_BTN = cn(
  'flex min-h-[3.25rem] w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
  'border-border-white-15/60 bg-card/50 hover:bg-card/70',
  'text-xs font-medium text-text-primary cursor-pointer'
);

const WALLET_GRID_ICON_WRAP = cn(
  'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5'
);

const SOLANA_BRAND_ICON: Record<SolanaWalletKind, string> = {
  phantom: '/wallets/phantom.jpg',
  solflare: '/wallets/solflare.jpg',
  backpack: '/tokens/backpack.svg',
};

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn?: () => void;
  onEOAConnect?: () => void;
}

type LoadingKey = 'google' | 'validating' | null;

function evmConnectingKey(uuid: string) {
  return `evm:${uuid}`;
}

function solConnectingKey(kind: SolanaWalletKind) {
  return `sol:${kind}`;
}

export function ConnectWalletModal({
  isOpen,
  onClose,
  onGoogleSignIn,
  onEOAConnect,
}: ConnectWalletModalProps) {
  const { loginWithGoogle, loginWithEVMWallet, loginWithSolanaWallet, state } = useTurnkey();
  const [loading, setLoading] = useState<LoadingKey>(null);
  const [walletConnectKey, setWalletConnectKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isCodeValidated, setIsCodeValidated] = useState(false);
  const [evmProviders, setEvmProviders] = useState<Eip6963ProviderDetail[]>([]);

  useEffect(() => {
    if (!isOpen || !isCodeValidated) {
      setEvmProviders([]);
      return;
    }
    return subscribeEip6963Providers(setEvmProviders);
  }, [isOpen, isCodeValidated]);

  const solanaWallets = isOpen && isCodeValidated ? listDetectedSolanaWallets() : [];

  const handleValidateCode = useCallback(async () => {
    if (!accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setLoading('validating');
    setError('');

    try {
      const res = await fetch('/api/validate-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode.trim() }),
      });

      const data = await res.json();

      if (data.valid) {
        storeAccessCode(accessCode.trim());
        setIsCodeValidated(true);
      } else {
        setError('Invalid access code');
      }
    } catch {
      setError('Failed to validate access code');
    } finally {
      setLoading(null);
    }
  }, [accessCode]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading('google');
      setError('');
      await loginWithGoogle();
      onGoogleSignIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(null);
    }
  };

  const handleEvmWallet = async (detail: Eip6963ProviderDetail) => {
    const key = evmConnectingKey(detail.info.uuid);
    setWalletConnectKey(key);
    setError('');
    try {
      const result = await loginWithEVMWallet(detail.provider);
      if (!result.success) {
        setError(result.error ?? 'Could not connect Ethereum wallet');
        return;
      }
      onEOAConnect?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Ethereum wallet');
    } finally {
      setWalletConnectKey(null);
    }
  };

  const handleSolanaWallet = async (kind: SolanaWalletKind) => {
    const key = solConnectingKey(kind);
    setWalletConnectKey(key);
    setError('');
    try {
      const result = await loginWithSolanaWallet(kind);
      if (!result.success) {
        setError(result.error ?? 'Could not connect Solana wallet');
        return;
      }
      onEOAConnect?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Solana wallet');
    } finally {
      setWalletConnectKey(null);
    }
  };

  const handleClose = useCallback(() => {
    setAccessCode('');
    setError('');
    setIsCodeValidated(false);
    setLoading(null);
    setWalletConnectKey(null);
    onClose();
  }, [onClose]);

  const optionsDisabled =
    walletConnectKey !== null || state.isLoggingIn || state.isLoading || loading === 'google';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="md" contentClassName="p-8 md:p-10">
      {/* Logo and Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-8"
      >
        <h2 className="text-xl font-semibold text-text-primary mb-2 tracking-tight">
          CONNECT WALLET
        </h2>
        <p className="text-xs text-text-muted-60 text-center max-w-xs leading-relaxed">
          {isCodeValidated
            ? 'Choose your preferred method to connect and start trading'
            : 'Enter your access code to continue'}
        </p>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-300 text-sm"
        >
          {error}
        </motion.div>
      )}

      {!isCodeValidated ? (
        /* ── Access Code Gate ────────────────────────────────── */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-md',
              'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
              'backdrop-blur-lg border border-border-white-15/60',
              'p-3.5 flex items-center gap-3'
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-md" />
            <ShieldCheck className="relative z-10 w-4 h-4 text-text-muted-60 shrink-0" />
            <input
              type="text"
              placeholder="Enter access code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && accessCode.trim()) handleValidateCode();
              }}
              disabled={loading !== null}
              autoFocus
              className={cn(
                'relative z-10 flex-1 bg-transparent outline-none',
                'text-sm font-medium text-text-primary',
                'placeholder:text-text-muted-60/30 caret-white',
                'disabled:opacity-50'
              )}
            />
          </div>

          <button
            type="button"
            onClick={handleValidateCode}
            disabled={!accessCode.trim() || loading !== null}
            className={cn(
              'w-full py-3 rounded-md text-sm font-semibold tracking-wide cursor-pointer',
              'transition-all duration-200',
              !accessCode.trim() || loading !== null
                ? 'bg-white/5 text-text-muted-60/40 cursor-not-allowed border border-border-white-10/30'
                : 'bg-gradient-to-r from-accent/80 to-accent/60 text-white hover:from-accent hover:to-accent/80 border border-accent/30 shadow-lg shadow-accent/10'
            )}
          >
            {loading === 'validating' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </span>
            ) : (
              'CONTINUE'
            )}
          </button>
        </motion.div>
      ) : (
        /* ── Sign-in Options ─────────────────────────────────── */
        <div className="space-y-5">
          <motion.button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={optionsDisabled}
            whileHover={!optionsDisabled ? { scale: 1.01, y: -1 } : {}}
            whileTap={!optionsDisabled ? { scale: 0.99 } : {}}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              'w-full relative overflow-hidden cursor-pointer',
              'px-5 py-4 rounded-md',
              'bg-gradient-to-br from-card/80 via-card/70 to-card/65',
              'backdrop-blur-lg border border-border-white-15/60',
              'hover:border-border-white-25',
              'hover:from-card/85 hover:via-card/75 hover:to-card/70',
              'transition-all duration-300',
              'shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40',
              'group',
              optionsDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/3 to-transparent pointer-events-none rounded-md" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={false}
            />
            <div className="relative z-10 flex items-center justify-center">
              {loading === 'google' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  <span className="text-sm font-medium text-text-primary">Signing in...</span>
                </>
              ) : (
                <div className="text-sm flex items-center gap-2 font-medium text-text-primary">
                  <Image src="/google.png" alt="Google" width={20} height={20} />
                  <span>Sign in with Google</span>
                </div>
              )}
            </div>
          </motion.button>

          <div className="relative flex items-center gap-4 py-1">
            <div className="h-px flex-1 bg-border-white-15/50" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted-50 whitespace-nowrap">
              Or wallet
            </span>
            <div className="h-px flex-1 bg-border-white-15/50" />
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted-50 mb-2">
                Ethereum
              </p>
              {evmProviders.length === 0 ? (
                <p className="text-xs text-text-muted-50 leading-relaxed">
                  No Ethereum browser wallet detected yet. Install MetaMask or Rabby, then reopen
                  this screen.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {evmProviders.map((p) => (
                    <div key={p.info.uuid} className="min-w-0">
                      <button
                        type="button"
                        disabled={optionsDisabled}
                        onClick={() => handleEvmWallet(p)}
                        className={cn(
                          WALLET_GRID_BTN,
                          optionsDisabled && 'cursor-not-allowed opacity-45'
                        )}
                      >
                        <span className={WALLET_GRID_ICON_WRAP}>
                          {p.info.icon ? (
                            /* EIP-6963 icons are arbitrary data URIs — use plain img */
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={p.info.icon}
                              alt=""
                              className="size-7 object-contain"
                              width={28}
                              height={28}
                            />
                          ) : (
                            <Wallet className="size-5 text-text-muted-50" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {walletConnectKey === evmConnectingKey(p.info.uuid)
                            ? `${p.info.name}…`
                            : p.info.name}
                        </span>
                        {walletConnectKey === evmConnectingKey(p.info.uuid) && (
                          <Loader2 className="size-4 shrink-0 animate-spin text-text-muted-50" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted-50 mb-2">
                Solana
              </p>
              {solanaWallets.length === 0 ? (
                <p className="text-xs text-text-muted-50 leading-relaxed">
                  No Solana wallet extension detected (Phantom, Solflare, Backpack).
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {solanaWallets.map((w) => (
                    <div key={w.kind} className="min-w-0">
                      <button
                        type="button"
                        disabled={optionsDisabled}
                        onClick={() => handleSolanaWallet(w.kind)}
                        className={cn(
                          WALLET_GRID_BTN,
                          optionsDisabled && 'cursor-not-allowed opacity-45'
                        )}
                      >
                        <span className={WALLET_GRID_ICON_WRAP}>
                          <Image
                            src={SOLANA_BRAND_ICON[w.kind]}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 object-contain"
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {walletConnectKey === solConnectingKey(w.kind) ? `${w.name}…` : w.name}
                        </span>
                        {walletConnectKey === solConnectingKey(w.kind) && (
                          <Loader2 className="size-4 shrink-0 animate-spin text-text-muted-50" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-text-muted-50 text-center mt-7 leading-relaxed"
      >
        By connecting, you agree to our Terms of Service
      </motion.p>
    </Modal>
  );
}
