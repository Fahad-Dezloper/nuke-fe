'use client';

/**
 * Position Row Component
 * Individual position row in the positions table
 * Modular design supporting any number of protocols
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { ArbitragePosition, ProtocolDataMap, ProtocolPositionData } from '@/types/positions';
import { POSITIONS_TABLE_GRID } from './positions-table-grid';
import { getProtocolConfig } from '@/lib/protocols/config';
import { hyperliquidCoinIconUrl } from '@/lib/hyperliquid/coin-icon-url';
import { useNavigateToAssetPair } from '@/hooks/use-navigate-to-asset-pair';

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
  anchorRect,
  title,
  data,
  field,
}: {
  isVisible: boolean;
  anchorRect?: DOMRect | null;
  title: string;
  data: ProtocolDataMap;
  field: 'size' | 'pnl' | 'funding' | 'margin';
}) {
  if (!isVisible || !anchorRect || typeof document === 'undefined') return null;

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

  const left = anchorRect.left + anchorRect.width / 2;
  const top = anchorRect.bottom + 8;

  return createPortal(
    <div
      className={cn(
        'fixed z-[200] pointer-events-none -translate-x-1/2',
        'bg-[#141418] border border-white/15',
        'rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.85)]',
        'px-3 py-2.5 min-w-[200px]'
      )}
      style={{ left, top }}
      role="tooltip"
    >
      <div className="text-xs font-semibold text-text-primary mb-1.5">{title}</div>
      <div className="flex flex-col gap-1.5">
        {protocolsWithData.map(({ protocolId, displayName, data }) => (
          <div key={protocolId} className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-text-muted-60">{displayName}</span>
            <span className="text-[10px] font-medium text-text-primary tabular-nums">
              {getFieldValue(data, field)}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body
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
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        hoverBg: 'hover:bg-emerald-500/20',
        hoverBorder: 'hover:border-emerald-500/30',
      };
    }
    if (type === 'short') {
      return {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        hoverBg: 'hover:bg-rose-500/20',
        hoverBorder: 'hover:border-rose-500/30',
      };
    }
    // Default fallback for unknown protocols
    return {
      bg: 'bg-white/5',
      border: 'border-white/10',
      hoverBg: 'hover:bg-white/10',
      hoverBorder: 'hover:border-white/20',
    };
  };

  const styleClasses = getStyleClasses(
    type === 'long' ? 'long' : type === 'short' ? 'short' : (undefined as never)
  );

  // Text color based on position type: emerald for LONG, rose for SHORT
  const textColorClass =
    type === 'long' ? 'text-emerald-400' : type === 'short' ? 'text-rose-400' : 'text-text-primary';

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-all duration-200 w-fit'
        // styleClasses.bg,
        // styleClasses.border,
        // styleClasses.hoverBg,
        // styleClasses.hoverBorder
      )}
    >
      <Image
        src={config.logo}
        alt={config.displayName}
        width={16}
        height={16}
        className="shrink-0 rounded-xs"
      />
      {/* <span
        className={cn(
          'text-[9px] font-bold tracking-tight uppercase whitespace-nowrap',
          textColorClass
        )}
      >
        {config.displayName}
      </span> */}
    </div>
  );
}

export function PositionRow({ position, onClose }: PositionRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const navigateToAssetPair = useNavigateToAssetPair();
  const [hoveredField, setHoveredField] = useState<
    'size' | 'margin' | 'pricePnl' | 'fundingPnl' | null
  >(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect | null>(null);

  const isTotalPnlPositive =
    position.totalPnl.startsWith('+') || parseFloat(position.totalPnl.replace(/[^0-9.-]/g, '')) > 0;
  const isPricePnlPositive =
    position.pricePnl.startsWith('+') || parseFloat(position.pricePnl.replace(/[^0-9.-]/g, '')) > 0;
  const isFundingPnlPositive =
    position.fundingPnl.current.startsWith('+') ||
    parseFloat(position.fundingPnl.current.replace(/[^0-9.-]/g, '')) > 0;
  const isFundingAprPositive =
    position.fundingApr.startsWith('+') ||
    (position.fundingApr !== '—' && parseFloat(position.fundingApr.replace(/[^0-9.-]/g, '')) > 0);

  const handleMouseEnter = (
    field: 'size' | 'margin' | 'pricePnl' | 'fundingPnl',
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!position.protocolData) return;
    setTooltipAnchor(event.currentTarget.getBoundingClientRect());
    setHoveredField(field);
  };

  const handleMouseLeave = () => {
    setHoveredField(null);
    setTooltipAnchor(null);
  };

  const handleRowClick = () => {
    navigateToAssetPair(position.asset, position.long.platform, position.short.platform);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick();
    }
  };

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      className={cn(
        'relative border-b border-white/[0.04] last:border-b-0',
        'border-l-2 border-l-transparent',
        'cursor-pointer transition-all duration-200 ease-in-out',
        ' hover:bg-[#1A1B1E]',
        'focus-visible:outline-none focus-visible:border-l-emerald-500 focus-visible:bg-[#1A1B1E]/60',
        'min-h-[68px] flex items-center w-full'
      )}
    >
      <div className="px-5 py-4 w-full">
        <div className={`${POSITIONS_TABLE_GRID} items-center max-w-full`}>
          {/* ASSET */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Image
                src={hyperliquidCoinIconUrl(position.asset)}
                alt={position.asset}
                width={26}
                height={26}
                className="rounded-full ring-1 ring-white/10"
              />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-bold text-text-primary leading-none">
                {position.asset}
              </span>
              <span className="inline-flex items-center text-[9px] font-bold px-1 py-0.2 rounded-xs bg-white/5 text-white/50 w-fit">
                {position.leverage}
              </span>
            </div>
          </div>

          {/* LONG / SHORT */}
          <div className="flex items-center gap-1.5 w-full">
            <ProtocolBadge
              protocolId={position.long.platform.toLowerCase()}
              label={position.long.platform}
              type="long"
            />
            <span className="text-white text-base font-medium shrink-0">→</span>
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
            <span className="text-xs font-semibold text-white/90 tabular-nums font-mono truncate block">
              {position.size}
            </span>
          </div>

          {/* MARGIN */}
          <div
            className="min-w-0 cursor-help"
            onMouseEnter={(e) => handleMouseEnter('margin', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="text-xs font-semibold text-white/90 tabular-nums font-mono truncate block">
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
                'text-xs font-semibold tabular-nums font-mono truncate block',
                isPricePnlPositive ? 'text-emerald-400' : 'text-rose-400'
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
                'text-xs font-semibold tabular-nums font-mono truncate block',
                isFundingPnlPositive ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {position.fundingPnl.current}
            </span>
            <span className="text-[10px] text-white/40 tabular-nums font-mono leading-none mt-0.5 truncate block">
              {position.fundingPnl.estimated}
            </span>
          </div>

          {/* FUNDING APR (realized, annualized) */}
          <div className="min-w-0">
            <span
              className={cn(
                'text-xs font-semibold tabular-nums font-mono truncate block',
                position.fundingApr === '—'
                  ? 'text-white/30'
                  : isFundingAprPositive
                    ? 'text-emerald-400'
                    : 'text-rose-400'
              )}
            >
              {position.fundingApr}
            </span>
          </div>

          {/* TOTAL PNL */}
          <div className="min-w-0">
            <span
              className={cn(
                'inline-flex items-center justify-center text-xs font-bold tabular-nums font-mono px-2 py-0.5 rounded-md border shadow-xs',
                isTotalPnlPositive
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_2px_10px_rgba(16,185,129,0.06)]'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_2px_10px_rgba(244,63,94,0.06)]'
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
                const liqPrice =
                  data?.liquidationPrice && data?.liquidationPrice !== ''
                    ? data?.liquidationPrice
                    : '—';

                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-[9px] font-bold px-1 rounded-xs w-3.5 text-center',
                        type === 'long'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      )}
                    >
                      {type === 'long' ? 'L' : 'S'}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-mono tabular-nums whitespace-nowrap',
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.(`${position.asset}-${position.leverage}`);
              }}
              className="p-1.5 rounded-md cursor-pointer text-white bg-[#D55145] hover:bg-[#D55145]/80 border border-transparent shadow-xs transition-all duration-200 flex items-center justify-center w-7 h-7"
              aria-label={`Close ${position.asset} position`}
            >
              <X className="h-4 w-4" />
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
              anchorRect={tooltipAnchor}
              title="Position Size"
              data={position.protocolData}
              field="size"
            />
          )}
          {hoveredField === 'margin' && (
            <ProtocolTooltip
              isVisible={true}
              anchorRect={tooltipAnchor}
              title="Margin"
              data={position.protocolData}
              field="margin"
            />
          )}
          {hoveredField === 'pricePnl' && (
            <ProtocolTooltip
              isVisible={true}
              anchorRect={tooltipAnchor}
              title="Price PNL"
              data={position.protocolData}
              field="pnl"
            />
          )}
          {hoveredField === 'fundingPnl' && (
            <ProtocolTooltip
              isVisible={true}
              anchorRect={tooltipAnchor}
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
