'use client';

import { cn } from '@/lib/utils';

interface InfoCardProps {
  label: string;
  value: string;
  active?: boolean;
}

export function InfoCard({ label, value, active = false }: InfoCardProps) {
  return (
    <div
      className={cn(
        'flex min-h-[64px] flex-col justify-between border border-border-white-5 bg-card px-4 py-3',
        active && 'bg-[#1a1a1a]'
      )}
    >
      <span className="text-[11px] text-text-muted-60">{label}</span>
      <span className="text-[16px] font-medium text-text-primary">{value}</span>
    </div>
  );
}
