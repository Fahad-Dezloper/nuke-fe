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
    (position.fundingApr !== '—' &&
      parseFloat(position.fundingApr.replace(/[^0-9.-]/g, '')) > 0);

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
    navigateToAssetPair(
      position.asset,
      position.long.platform,
      position.short.platform
    );
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
        'relative border-b border-white/[0.08] last:border-b-0',
        'border-l-2 border-l-transparent',
        'cursor-pointer transition-colors duration-150',
        'hover:border-l-accent/60 hover:bg-white/[0.04]',
        'focus-visible:outline-none focus-visible:border-l-accent focus-visible:bg-white/[0.05]'
      )}
    >
      <div className="px-4 md:px-6 py-3">
        <div className={`${POSITIONS_TABLE_GRID} items-center max-w-full`}>
          {/* ASSET */}
          <div className="flex items-center gap-2">
            <Image
              src={hyperliquidCoinIconUrl(position.asset)}
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

          {/* FUNDING APR (realized, annualized) */}
          <div className="min-w-0">
            <span
              className={cn(
                'text-xs font-medium tabular-nums truncate block',
                position.fundingApr === '—'
                  ? 'text-text-muted-60'
                  : isFundingAprPositive
                    ? 'text-green-400'
                    : 'text-red-400'
              )}
            >
              {position.fundingApr}
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.(`${position.asset}-${position.leverage}`);
              }}
              className="p-1 rounded-md cursor-pointer text-text-muted-60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
              aria-label={`Close ${position.asset} position`}
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
