/**
 * Exchange metadata for automation UI (logos match portfolio ExchangeLogo paths).
 */
export const AUTOMATION_EXCHANGES = [
  {
    id: 'pacifica',
    label: 'Pacifica',
    logo: { src: '/tokens/pacifica.jpg', alt: 'Pacifica', className: 'rounded-full' },
  },
  {
    id: 'hyperliquid',
    label: 'Hyperliquid',
    logo: { src: '/tokens/hype.png', alt: 'Hyperliquid', className: 'rounded-full' },
  },
  {
    id: 'backpack',
    label: 'Backpack',
    logo: { src: '/tokens/backpack.svg', alt: 'Backpack' },
  },
  {
    id: 'lighter',
    label: 'Lighter',
    logo: { src: '/tokens/lighter.jpg', alt: 'Lighter', className: 'rounded-full' },
  },
] as const;

export type AutomationExchangeId = (typeof AUTOMATION_EXCHANGES)[number]['id'];

/** Venues supported by NukeTrade Automation API (Nest). */
export const AUTOMATION_NEST_VENUE_IDS = ['hyperliquid', 'pacifica'] as const satisfies readonly AutomationExchangeId[];

export type AutomationNestVenueId = (typeof AUTOMATION_NEST_VENUE_IDS)[number];

export function isNestAutomationVenue(id: string): id is AutomationNestVenueId {
  return id === 'hyperliquid' || id === 'pacifica';
}
