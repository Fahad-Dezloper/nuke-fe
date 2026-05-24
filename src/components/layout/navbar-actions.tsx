/**
 * Navbar Actions Component
 * User actions section (icons, buttons, etc.)
 */

import { motion } from 'framer-motion';
import { Send, Bell, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarActionsProps {
  onConnectWallet?: () => void;
  showIcon?: boolean;
  iconType?: 'send' | 'bell' | 'settings';
  connectWalletText?: string;
  className?: string;
}

export function NavbarActions({
  onConnectWallet,
  showIcon = true,
  iconType = 'send',
  connectWalletText = 'CONNECT WALLET',
  className,
}: NavbarActionsProps) {
  const icons = {
    send: Send,
    bell: Bell,
    settings: Settings,
  };

  const Icon = icons[iconType];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={cn('flex items-center gap-2.5', className)}
    >
      {/* Icon Button */}
      {showIcon && Icon && (
        <motion.button
          whileHover={{ scale: 1.1, rotate: iconType === 'send' ? 15 : 0 }}
          whileTap={{ scale: 0.9 }}
          className="p-2 rounded-sm text-text-muted-60 hover:text-text-primary hover:bg-card transition-colors"
          aria-label={iconType}
        >
          <Icon className="h-4 w-4" />
        </motion.button>
      )}

      {/* Connect Wallet Button */}
      <motion.button
        onClick={onConnectWallet}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="px-3.5 py-1.5 rounded-sm bg-white text-background hover:bg-white/90 font-medium text-sm transition-colors shadow-sm"
      >
        {connectWalletText}
      </motion.button>
    </motion.div>
  );
}
