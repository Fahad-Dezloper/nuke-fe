'use client';

/**
 * Flip Animation Component
 * Creates a stopwatch-style flip animation for numbers/text
 * Similar to digital clock or stopwatch display
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FlipAnimationProps {
  value: string;
  className?: string;
}

export function FlipAnimation({ value, className }: FlipAnimationProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (value !== displayValue) {
      setIsFlipping(true);
      // Small delay to show the flip effect
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setKey((k) => k + 1);
        setIsFlipping(false);
      }, 150); // Half of animation duration

      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <div className={cn('relative inline-block overflow-hidden', className)}>
      <AnimatePresence mode="wait">
        <motion.span
          key={key}
          initial={{
            rotateX: -90,
            opacity: 0,
            transformOrigin: '50% 50%',
          }}
          animate={{
            rotateX: 0,
            opacity: 1,
          }}
          exit={{
            rotateX: 90,
            opacity: 0,
            transformOrigin: '50% 50%',
          }}
          transition={{
            duration: 0.3,
            ease: [0.34, 1.56, 0.64, 1], // Custom easing for smooth flip
          }}
          style={{
            transformStyle: 'preserve-3d',
            display: 'inline-block',
          }}
          className="inline-block"
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
