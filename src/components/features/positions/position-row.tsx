'use client';

/**
 * Position Row Component
 * Individual position row in the positions table
 * Modular design supporting any number of protocols
 */

import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { ArbitragePosition, ProtocolDataMap, ProtocolPositionData } from '@/types/positions';
import { getProtocolConfig } from '@/lib/protocols/config';

interface PositionRowProps {
  position: ArbitragePosition;
  onClose?: (asset: string) => void;
}

/**
 * Tooltip component for showing protocol-specific details
 * Modular design that works with any number of protocols
 */
function ProtocolTooltip({
  isVisible,
  position: tooltipPosition,
  title,
  data,
  field,
}: {
  isVisible: boolean;
  position?: { x: number; y: number };
  title: string;
  data: ProtocolDataMap;
  field: 'size' | 'pnl' | 'funding' | 'margin';
}) {
  if (!isVisible) return null;

  // Get all protocols with data
  const protocolsWithData = Object.entries(data)
    .filter(([, value]) => value !== null)
    .map(([protocolId, value]) => {
      const config = getProtocolConfig(protocolId);
      return {
        protocolId,
        displayName: config?.displayName || protocolId,
        data: value!,
      };
    });

  if (protocolsWithData.length === 0) return null;

  // Get the value based on the field
  const getFieldValue = (
    data: ProtocolPositionData,
    field: 'size' | 'pnl' | 'funding' | 'margin'
  ): string => {
    switch (field) {
      case 'size':
        return data.size;
      case 'pnl':
        return data.pnl;
      case 'funding':
        return data.funding;
      case 'margin':
        return data.margin;
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        'absolute z-50 pointer-events-none',
        'bg-card/95 backdrop-blur-md border border-border-white-20/50',
        'rounded-lg shadow-2xl shadow-black/50',
        'px-3 py-2 min-w-[180px]',
        'animate-in fade-in-0 zoom-in-95 duration-200'
      )}
      style={{
        left: `${tooltipPosition?.x ?? 0}px`,
        top: `${tooltipPosition?.y ?? 0}px`,
      }}
    >
      <div className="text-xs font-semibold text-text-primary mb-1.5">{title}</div>
      <div className="flex flex-col gap-1">
        {protocolsWithData.map(({ protocolId, displayName, data }) => (
          <div key={protocolId} className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-text-muted-60">{displayName}:</span>
            <span className="text-[10px] font-medium text-text-primary tabular-nums">
              {getFieldValue(data, field)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Protocol Badge Component
 * Displays protocol logo and name with appropriate styling
 * Modular design that works with any protocol
 */
function ProtocolBadge({
  protocolId,
  label,
  type,
}: {
  protocolId: string;
  label: string;
  type?: 'long' | 'short';
}) {
  const config = getProtocolConfig(protocolId);

  if (!config) {
    // Fallback if protocol not found
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-500/10 border border-gray-500/20 w-fit">
        <span className="text-[10px] font-medium text-text-primary whitespace-nowrap">{label}</span>
      </div>
    );
  }

  // Use CSS variables with opacity - Tailwind classes for known protocols
  const getStyleClasses = (type: 'long' | 'short') => {
    if (type === 'long') {
      return {
        bg: 'bg-green-600/20',
        border: 'border-green-400/20',
        hoverBg: 'hover:bg-green-400/15',
        hoverBorder: 'hover:border-green-400/30',
      };
    }
    if (type === 'short') {
      return {
        bg: 'bg-red-600/20',
        border: 'border-red-400/20',
        hoverBg: 'hover:bg-red-400/15',
        hoverBorder: 'hover:border-red-400/30',
      };
    }
    // Default fallback for unknown protocols
    return {
      bg: 'bg-gray-500/10',
      border: 'border-gray-500/20',
      hoverBg: 'hover:bg-gray-500/15',
      hoverBorder: 'hover:border-gray-500/30',
    };
  };

  const styleClasses = getStyleClasses(
    type === 'long' ? 'long' : type === 'short' ? 'short' : (undefined as never)
  );

  // Text color based on position type: green for LONG, red for SHORT
  const textColorClass =
    type === 'long' ? 'text-green-400' : type === 'short' ? 'text-red-400' : 'text-text-primary';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all duration-200 w-fit',
        styleClasses.bg,
        styleClasses.border,
        styleClasses.hoverBg,
        styleClasses.hoverBorder
      )}
    >
      <Image
        src={config.logo}
        alt={config.displayName}
        width={14}
        height={14}
        className="shrink-0 rounded-sm"
      />
      <span className={cn('text-[10px] font-medium whitespace-nowrap', textColorClass)}>
        {config.displayName}
      </span>
    </div>
  );
}

export function PositionRow({ position, onClose }: PositionRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [hoveredField, setHoveredField] = useState<
    'size' | 'margin' | 'pricePnl' | 'fundingPnl' | null
  >(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const isTotalPnlPositive =
    position.totalPnl.startsWith('+') || parseFloat(position.totalPnl.replace(/[^0-9.-]/g, '')) > 0;
  const isPricePnlPositive =
    position.pricePnl.startsWith('+') || parseFloat(position.pricePnl.replace(/[^0-9.-]/g, '')) > 0;
  const isFundingPnlPositive =
    position.fundingPnl.current.startsWith('+') ||
    parseFloat(position.fundingPnl.current.replace(/[^0-9.-]/g, '')) > 0;

  const handleMouseEnter = (
    field: 'size' | 'margin' | 'pricePnl' | 'fundingPnl',
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!position.protocolData) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const rowRect = rowRef.current?.getBoundingClientRect();
    if (!rowRect) return;

    // Position tooltip below the hovered element, centered horizontally
    // Account for scroll position
    setTooltipPosition({
      x: rect.left - rowRect.left + rect.width / 2 - 90, // Center tooltip (tooltip width ~180px)
      y: rect.bottom - rowRect.top + 5,
    });
    setHoveredField(field);
  };

  const handleMouseLeave = () => {
    setHoveredField(null);
    setTooltipPosition(null);
  };

  return (
    <div
      ref={rowRef}
      className="relative border-b border-border-white-10/30 last:border-0 border-l-2 border-l-transparent hover:border-l-accent/50 hover:bg-card/20 hover:backdrop-blur-sm transition-all duration-200 group"
    >
      <div className="px-4 md:px-6 py-2.5">
        <div className="grid grid-cols-[minmax(80px,0.8fr)_minmax(140px,1.2fr)_minmax(65px,0.7fr)_minmax(80px,0.8fr)_minmax(80px,0.9fr)_minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(140px,1.4fr)_36px] gap-2 lg:gap-3 items-center max-w-full">
          {/* ASSET */}
          <div className="flex items-center gap-2">
            <Image
              src={`https://app.hyperliquid.xyz/coins/${position.asset.toUpperCase()}.svg`}
              alt={position.asset}
              width={20}
              height={20}
            />
            <div className="flex flex-col gap-0">
              <span className="text-xs font-semibold text-text-primary leading-tight">
                {position.asset}
              </span>
              <span className="text-[10px] text-text-muted-60 leading-tight">
                {position.leverage}
              </span>
            </div>
          </div>

          {/* LONG / SHORT */}
          <div className="flex flex-col gap-2 w-full">
            {/* LONG */}
            <ProtocolBadge
              protocolId={position.long.platform.toLowerCase()}
              label={position.long.platform}
              type="long"
            />
            {/* SHORT */}
            <ProtocolBadge
              protocolId={position.short.platform.toLowerCase()}
              label={position.short.platform}
              type="short"
            />
          </div>

          {/* SIZE */}
          <div
            className="min-w-0 cursor-help"
            onMouseEnter={(e) => handleMouseEnter('size', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="text-xs font-medium text-text-primary tabular-nums truncate block">
              {position.size}
            </span>
          </div>

          {/* MARGIN */}
          <div
            className="min-w-0 cursor-help"
            onMouseEnter={(e) => handleMouseEnter('margin', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="text-xs font-medium text-text-primary tabular-nums truncate block">
              {position.margin}
            </span>
          </div>

          {/* PRICE PNL */}
          <div
            className="min-w-0 cursor-help"
            onMouseEnter={(e) => handleMouseEnter('pricePnl', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span
              className={cn(
                'text-xs font-medium tabular-nums truncate block',
                isPricePnlPositive ? 'text-green-400' : 'text-red-400'
              )}
            >
              {position.pricePnl}
            </span>
          </div>

          {/* FUNDING PNL */}
          <div
            className="flex flex-col gap-0 min-w-0 cursor-help"
            onMouseEnter={(e) => handleMouseEnter('fundingPnl', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span
              className={cn(
                'text-xs font-medium tabular-nums truncate block',
                isFundingPnlPositive ? 'text-green-400' : 'text-red-400'
              )}
            >
              {position.fundingPnl.current}
            </span>
            <span className="text-[10px] text-text-muted-60 tabular-nums leading-tight truncate block">
              {position.fundingPnl.estimated}
            </span>
          </div>

          {/* TOTAL PNL */}
          <div className="min-w-0">
            <span
              className={cn(
                'text-xs font-semibold tabular-nums truncate block',
                isTotalPnlPositive ? 'text-green-400' : 'text-red-400'
              )}
            >
              {position.totalPnl}
            </span>
          </div>

          {/* LIQ PRICE — ordered to match LONG / SHORT column */}
          <div className="flex flex-col gap-1 min-w-0">
            {(() => {
              const longProtocolId = position.long.platform.toLowerCase();
              const shortProtocolId = position.short.platform.toLowerCase();
              const ordered = [
                { protocolId: longProtocolId, type: 'long' as const },
                { protocolId: shortProtocolId, type: 'short' as const },
              ];

              return ordered.map(({ protocolId, type }) => {
                const data = position.protocolData?.[protocolId];
                const config = getProtocolConfig(protocolId);
                // liquidationPrice is already formatted as "$XX,XXX.XX" from the service
                const liqPrice =
                  data?.liquidationPrice && data?.liquidationPrice !== ''
                    ? data?.liquidationPrice
                    : '—';

                return (
                  <div key={type} className="flex items-center gap-1.5">
                    {config && (
                      <Image
                        src={config.logo}
                        alt={config.displayName}
                        width={13}
                        height={13}
                        className="shrink-0 rounded-sm opacity-60"
                      />
                    )}
                    <span
                      className={cn(
                        'text-[11px] tabular-nums whitespace-nowrap',
                        type === 'long' ? 'text-text-primary' : 'text-text-muted-60'
                      )}
                    >
                      {liqPrice}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          {/* CLOSE BUTTON */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => onClose?.(`${position.asset}-${position.leverage}`)}
              className="p-1 rounded-md cursor-pointer text-text-muted-60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tooltips */}
      {position.protocolData && (
        <>
          {hoveredField === 'size' && (
            <ProtocolTooltip
              isVisible={true}
              position={tooltipPosition || undefined}
              title="Position Size"
              data={position.protocolData}
              field="size"
            />
          )}
          {hoveredField === 'margin' && (
            <ProtocolTooltip
              isVisible={true}
              position={tooltipPosition || undefined}
              title="Margin"
              data={position.protocolData}
              field="margin"
            />
          )}
          {hoveredField === 'pricePnl' && (
            <ProtocolTooltip
              isVisible={true}
              position={tooltipPosition || undefined}
              title="Price PNL"
              data={position.protocolData}
              field="pnl"
            />
          )}
          {hoveredField === 'fundingPnl' && (
            <ProtocolTooltip
              isVisible={true}
              position={tooltipPosition || undefined}
              title="Funding PNL"
              data={position.protocolData}
              field="funding"
            />
          )}
        </>
      )}
    </div>
  );
}
