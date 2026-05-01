'use client';

import { cn } from '@/lib/utils';

interface InfoCardProps {
  label: string;
  value: string;
  active?: boolean;
  valueClassName?: string;
}

export function InfoCard({ label, value, active = false, valueClassName }: InfoCardProps) {
  return (
    <div
      className={cn(
        'flex min-h-16 flex-col justify-between border border-border-white-5 bg-card px-4 py-3',
        active && 'bg-[#1a1a1a]'
      )}
    >
      <span className="text-[11px] text-text-muted-60">{label}</span>
      <span className={cn('text-[16px] font-medium text-text-primary', valueClassName)}>
        {value}
      </span>
    </div>
  );
}
