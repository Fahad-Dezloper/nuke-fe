'use client';

/**
 * Animated Number Component
 * Smoothly animates numbers from old to new value with color changes based on direction
 * Similar to Svelte tweened animation
 */

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAnimate } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  formatter?: (val: number) => string;
  duration?: number;
  direction?: 'up' | 'down' | null;
  className?: string;
}

export function AnimatedNumber({
  value,
  formatter = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(val);
  },
  duration = 300,
  direction: externalDirection = null,
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [localDirection, setLocalDirection] = useState<'up' | 'down' | null>(
    null
  );
  const previousValueRef = useRef(value);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (value !== previousValueRef.current) {
      // Determine direction
      const dir =
        externalDirection ||
        (value > previousValueRef.current
          ? 'up'
          : value < previousValueRef.current
          ? 'down'
          : null);
      setLocalDirection(dir);
      setIsAnimating(true);

      // Animate from previous to new value
      const startValue = previousValueRef.current;
      const endValue = value;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (cubicOut equivalent)
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentValue = startValue + (endValue - startValue) * eased;
        setDisplayValue(currentValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
          setIsAnimating(false);
          // Clear direction after a short delay
          setTimeout(() => {
            setLocalDirection(null);
          }, 100);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
      previousValueRef.current = value;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration, externalDirection]);

  // Update direction if externally provided
  useEffect(() => {
    if (externalDirection !== null && externalDirection !== undefined) {
      setLocalDirection(externalDirection);
    }
  }, [externalDirection]);

  const colorClass =
    isAnimating && localDirection
      ? localDirection === 'up'
        ? 'text-green-400'
        : 'text-red-400'
      : 'text-text-primary';

  return (
    <span
      className={cn(
        'inline-block tabular-nums transition-colors duration-200',
        colorClass,
        className
      )}>
      {formatter(displayValue)}
    </span>
  );
}
