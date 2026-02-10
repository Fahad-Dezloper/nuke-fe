/**
 * Navbar Logo Component
 * Reusable logo component for the navbar
 */

import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface NavbarLogoProps {
  href?: string;
  text?: string;
  className?: string;
  onClick?: () => void;
}

export function NavbarLogo({ href = '/', text = 'Nuke', className, onClick }: NavbarLogoProps) {
  const content = (
    <motion.span
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn('text-xl font-bold text-accent tracking-tight', 'transition-colors', className)}
    >
      {text}
    </motion.span>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="flex items-center gap-2">
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className="flex items-center gap-2 group">
      {content}
    </Link>
  );
}
