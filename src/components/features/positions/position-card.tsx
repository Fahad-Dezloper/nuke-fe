/**
 * Position Card Component
 * Example feature component demonstrating the pattern
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Position } from '@/types';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface PositionCardProps {
  position: Position;
  onClose?: (id: string) => void;
}

export function PositionCard({ position, onClose }: PositionCardProps) {
  const isProfit = position.pnl >= 0;

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-accent'>{position.symbol}</CardTitle>
          <span
            className={`text-sm font-medium ${
              isProfit ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {formatPercent(position.pnlPercent)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          <div className='flex justify-between text-sm'>
            <span className='text-text-muted-60'>Size:</span>
            <span className='text-text-primary'>{position.size}</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-text-muted-60'>Entry Price:</span>
            <span className='text-text-primary'>
              {formatCurrency(position.entryPrice)}
            </span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-text-muted-60'>Current Price:</span>
            <span className='text-text-primary'>
              {formatCurrency(position.currentPrice)}
            </span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-text-muted-60'>P&L:</span>
            <span
              className={`font-medium ${
                isProfit ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatCurrency(position.pnl)}
            </span>
          </div>
          {position.status === 'open' && onClose && (
            <Button
              variant='outline'
              size='sm'
              className='w-full mt-4'
              onClick={() => onClose(position.id)}
            >
              Close Position
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

