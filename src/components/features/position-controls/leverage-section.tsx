'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { leverageAtom } from './store';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';

interface LeverageSectionProps {
  className?: string;
}

export function LeverageSection({ className }: LeverageSectionProps) {
  const [leverage, setLeverage] = useAtom(leverageAtom);
  const selectedAsset = useAtomValue(selectedAssetAtom);

  const maxLeverage = selectedAsset?.maxLeverage || 5;

  useEffect(() => {
    if (leverage > maxLeverage) setLeverage(maxLeverage);
  }, [maxLeverage, leverage, setLeverage]);

  const currentLeverage = Math.min(leverage, maxLeverage);

  const getMarks = (max: number): number[] => {
    if (max <= 5) return [1, max];
    if (max <= 10) return [1, 5, max];
    if (max <= 20) return [1, 5, 10, 15, max];
    if (max <= 30) return [1, 5, 10, 20, max];
    if (max <= 50) return [1, 5, 10, 25, max];
    return [1, 5, 10, 25, 50, max];
  };

  const marks = getMarks(maxLeverage);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <label className="stat-label">Leverage</label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={1}
            max={maxLeverage}
            value={currentLeverage}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 1;
              setLeverage(Math.max(1, Math.min(maxLeverage, value)));
            }}
            className="w-12 h-8 bg-secondary border-border-white-10 rounded-sm text-text-primary text-xs text-center p-0 font-tabular focus:border-green/50 focus:ring-0"
          />
          <span className="text-xs text-text-muted-40">x</span>
        </div>
      </div>

      <Slider
        min={1}
        max={maxLeverage}
        step={1}
        value={currentLeverage}
        onValueChange={(v) => setLeverage(v)}
        marks={marks}
        className="w-full"
      />

      <AnimatePresence>
        {currentLeverage >= 10 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="p-2.5 rounded-sm bg-yellow-900/20 border border-yellow-600/20"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0 mt-px" />
              <p className="text-[10px] text-text-muted-60 leading-relaxed">
                High leverage increases liquidation risk on either or both legs when market is volatile.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
