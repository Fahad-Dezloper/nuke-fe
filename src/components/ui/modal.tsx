'use client';

/**
 * Modal Component
 * Reusable modal component with glassmorphism styling and animations
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  description?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
  backdropClassName?: string;
  contentClassName?: string;
  preventBodyScroll?: boolean;
  zIndex?: number;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  description,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  maxWidth = 'md',
  className,
  backdropClassName,
  contentClassName,
  preventBodyScroll = true,
  zIndex = 9999,
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!preventBodyScroll) return;

    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, preventBodyScroll]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className={cn('absolute inset-0 bg-black/70', backdropClassName)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              duration: 0.3,
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative w-full z-10',
              'bg-card border border-border-white-10',
              'rounded-sm shadow-2xl shadow-black/60',
              'overflow-hidden',
              maxWidthClasses[maxWidth],
              className
            )}
          >
            {/* Close button */}
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  'absolute top-4 right-4 z-20',
                  'w-7 h-7 flex items-center justify-center cursor-pointer',
                  'rounded-sm bg-background border border-border-white-10',
                  'text-text-muted-60 hover:text-text-primary',
                  'transition-colors duration-150',
                  'hover:border-border-white-20'
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Content */}
            <div className={cn('relative z-10', contentClassName)}>
              {/* Title and Description */}
              {(title || description) && (
                <div className="p-8 md:p-10 pb-6">
                  {title && (
                    <h2 className="text-sm font-bold text-text-primary mb-1.5 tracking-tight uppercase">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-xs text-text-muted-60 leading-relaxed">{description}</p>
                  )}
                </div>
              )}

              {/* Children */}
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Render modal to document body using portal to avoid parent container issues
  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
}
