/**
 * Bridge Modal Component
 * Modal for bridging USDC from Base to Arbitrum
 */

'use client';

import { useState, useEffect } from 'react';
import { Modal } from './modal';
import { Input } from './input';
import { Button } from './button';
import { useBridge } from '@/lib/bridge';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';

interface BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  protocol: 'hyperliquid' | 'pacifica';
  defaultAmount?: number; // Pre-filled amount in USD
}

export function BridgeModal({ isOpen, onClose, protocol, defaultAmount = 0 }: BridgeModalProps) {
  const { state: turnkeyState } = useTurnkey();
  // Initialize amount with defaultAmount, will be reset via key prop
  const [amount, setAmount] = useState(() => (defaultAmount > 0 ? defaultAmount.toFixed(6) : ''));
  const [balance, setBalance] = useState<string | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);

  const { status, error, bridge, checkBalance, isLoading } = useBridge({
    onSuccess: (result) => {
      console.log('Bridge successful:', result);
      onClose();
    },
    onError: (err) => {
      console.error('Bridge error:', err);
    },
  });

  // Initialize amount when modal opens with defaultAmount
  useEffect(() => {
    if (isOpen) {
      setAmount(defaultAmount > 0 ? defaultAmount.toFixed(6) : '');
    }
  }, [isOpen, defaultAmount]);

  // Check balance when modal opens
  useEffect(() => {
    if (!isOpen) {
      setBalance(null);
      return;
    }

    // Check balance when modal opens
    if (turnkeyState.isLoggedIn) {
      const walletAddress = getEVMAddress(turnkeyState.userWallets || []);
      if (walletAddress) {
        setIsCheckingBalance(true);
        checkBalance(walletAddress)
          .then((bal) => {
            setBalance(bal);
          })
          .catch((err) => {
            console.error('Error checking balance:', err);
            setBalance(null);
          })
          .finally(() => {
            setIsCheckingBalance(false);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, turnkeyState.isLoggedIn, checkBalance]);

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    // Convert amount to smallest unit (USDC has 6 decimals)
    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000)).toString();

    await bridge(amountInSmallestUnit);
  };

  const handleMax = () => {
    if (balance) {
      setAmount(balance);
    }
  };

  const isValidAmount =
    amount && parseFloat(amount) > 0 && (!balance || parseFloat(amount) <= parseFloat(balance));

  const protocolName = protocol === 'hyperliquid' ? 'HyperLiquid' : 'Pacifica';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Fund ${protocolName} Leg`}
      description={`Bridge USDC from Base to Arbitrum to fund your ${protocolName} position`}
      maxWidth="md"
    >
      <div className="p-8 md:p-10 pt-6 space-y-6">
        {/* Balance Display */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border-white-10/50">
          <span className="text-xs text-text-muted-60">Available on Base</span>
          {isCheckingBalance ? (
            <Loader2 className="w-4 h-4 animate-spin text-text-muted-60" />
          ) : balance !== null ? (
            <span className="text-sm font-medium text-text-primary">{balance} USDC</span>
          ) : (
            <span className="text-xs text-text-muted-60">Unable to fetch</span>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted-60 uppercase tracking-wide">
            Amount (USDC)
          </label>
          <div className="flex gap-2">
            <Input
              key={`bridge-amount-${isOpen}-${defaultAmount}`}
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
              step="0.000001"
              min="0"
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleMax}
              disabled={!balance || isLoading}
              className="shrink-0"
            >
              Max
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-400">{error.message}</p>
              {error.details && (
                <p className="text-xs text-red-400/70 mt-1">{String(error.details)}</p>
              )}
            </div>
          </div>
        )}

        {/* Status Display */}
        {status !== 'idle' && status !== 'error' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-border-white-10/50">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span className="text-xs text-text-primary">
              {status === 'checking-balance' && 'Checking balance...'}
              {status === 'getting-quote' && 'Getting bridge quote...'}
              {status === 'signing-permit' && 'Signing permit...'}
              {status === 'executing-permit' && 'Executing bridge...'}
              {status === 'success' && 'Bridge successful!'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleBridge}
            disabled={!isValidAmount || isLoading || !turnkeyState.isLoggedIn}
            className={cn(
              'flex-1',
              protocol === 'hyperliquid'
                ? 'bg-[var(--chart-hyperliquid)]/20 hover:bg-[var(--chart-hyperliquid)]/30 border-[var(--chart-hyperliquid)]/50'
                : 'bg-[var(--chart-pink)]/20 hover:bg-[var(--chart-pink)]/30 border-[var(--chart-pink)]/50'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Bridging...
              </>
            ) : (
              'Bridge & Fund'
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="pt-2 border-t border-border-white-10/50">
          <p className="text-xs text-text-muted-60">
            This will bridge USDC from Base to Arbitrum. After bridging, you can deposit to{' '}
            {protocolName}.
          </p>
        </div>
      </div>
    </Modal>
  );
}
