'use client';

/**
 * Shadcn-style dual-thumb range slider (Radix-free).
 * Maps two handles on a linear [min, max] domain.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function snapToStep(value: number, min: number, step: number) {
  const steps = Math.round((value - min) / step);
  return min + steps * step;
}

export function DualRangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  className,
  disabled = false,
  'aria-label': ariaLabel = 'Exit range',
}: DualRangeSliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = React.useState<0 | 1 | null>(null);

  const span = max - min;
  const [lo, hi] = value;
  const loPct = span > 0 ? ((lo - min) / span) * 100 : 0;
  const hiPct = span > 0 ? ((hi - min) / span) * 100 : 100;

  const valueFromClientX = React.useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || span <= 0) return min;
      const rect = track.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return snapToStep(min + ratio * span, min, step);
    },
    [min, span, step]
  );

  const updateThumb = React.useCallback(
    (thumb: 0 | 1, raw: number) => {
      const next: [number, number] = [...value];
      next[thumb] = clamp(raw, min, max);
      if (thumb === 0 && next[0] >= next[1] - step) {
        next[0] = next[1] - step;
      }
      if (thumb === 1 && next[1] <= next[0] + step) {
        next[1] = next[0] + step;
      }
      next[0] = clamp(next[0], min, max);
      next[1] = clamp(next[1], min, max);
      if (next[0] < next[1]) {
        onValueChange(next);
      }
    },
    [value, min, max, step, onValueChange]
  );

  React.useEffect(() => {
    if (activeThumb == null || disabled) return;

    const onMove = (e: PointerEvent) => {
      updateThumb(activeThumb, valueFromClientX(e.clientX));
    };
    const onUp = () => setActiveThumb(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [activeThumb, disabled, updateThumb, valueFromClientX]);

  const startDrag = (thumb: 0 | 1) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setActiveThumb(thumb);
    updateThumb(thumb, valueFromClientX(e.clientX));
  };

  return (
    <div
      className={cn('relative w-full select-none touch-none py-3', disabled && 'opacity-50', className)}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        ref={trackRef}
        className="relative h-2 w-full rounded-full bg-muted/80 border border-border-white-10"
      >
        <div
          className="absolute h-full rounded-full bg-accent/35"
          style={{ left: `${loPct}%`, width: `${hiPct - loPct}%` }}
        />
      </div>

      <button
        type="button"
        disabled={disabled}
        aria-label="Lower exit price"
        aria-valuemin={min}
        aria-valuemax={hi - step}
        aria-valuenow={lo}
        className={cn(
          'absolute top-1/2 z-10 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full',
          'border-2 border-accent bg-background shadow-md',
          'ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          'disabled:pointer-events-none',
          activeThumb === 0 && 'ring-2 ring-accent ring-offset-2'
        )}
        style={{ left: `${loPct}%` }}
        onPointerDown={startDrag(0)}
      />

      <button
        type="button"
        disabled={disabled}
        aria-label="Upper exit price"
        aria-valuemin={lo + step}
        aria-valuemax={max}
        aria-valuenow={hi}
        className={cn(
          'absolute top-1/2 z-10 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full',
          'border-2 border-accent bg-background shadow-md',
          'ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          'disabled:pointer-events-none',
          activeThumb === 1 && 'ring-2 ring-accent ring-offset-2'
        )}
        style={{ left: `${hiPct}%` }}
        onPointerDown={startDrag(1)}
      />
    </div>
  );
}
