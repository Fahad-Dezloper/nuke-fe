/**
 * Protocol Configuration
 * Centralized configuration for all supported protocols
 * Adding a new protocol only requires adding an entry here
 */

export interface ProtocolConfig {
  /** Protocol ID (lowercase, e.g., 'hyperliquid', 'pacifica', 'drift') */
  id: string;
  /** Display name */
  displayName: string;
  /** Logo image path */
  logo: string;
  /** CSS variable for primary color */
  colorVar: string;
  /** Background color opacity for badges */
  bgOpacity?: number;
  /** Border color opacity for badges */
  borderOpacity?: number;
  /** Compact label for exchange chips (e.g. HL) */
  chipLabel: string;
}

/**
 * Protocol Registry
 * Maps protocol IDs to their configuration
 */
export const PROTOCOL_CONFIGS: Record<string, ProtocolConfig> = {
  hyperliquid: {
    id: 'hyperliquid',
    displayName: 'Hyperliquid',
    chipLabel: 'Hyperliquid',
    logo: '/tokens/Hype2.png',
    colorVar: '--chart-hyperliquid',
    bgOpacity: 0.1,
    borderOpacity: 0.2,
  },
  pacifica: {
    id: 'pacifica',
    displayName: 'Pacifica',
    chipLabel: 'Pacifica',
    logo: '/tokens/pacifica.jpg',
    colorVar: '--chart-pink',
    bgOpacity: 0.1,
    borderOpacity: 0.2,
  },
  phoenix: {
    id: 'phoenix',
    displayName: 'Phoenix',
    chipLabel: 'Phoenix',
    logo: '/tokens/phoenix.svg',
    colorVar: '--chart-phoenix',
    bgOpacity: 0.1,
    borderOpacity: 0.2,
  },
  backpack: {
    id: 'backpack',
    displayName: 'Backpack',
    chipLabel: 'Backpack',
    logo: '/tokens/backpack.svg',
    colorVar: '--chart-backpack',
    bgOpacity: 0.1,
    borderOpacity: 0.2,
  },
  lighter: {
    id: 'lighter',
    displayName: 'Lighter',
    chipLabel: 'Lighter',
    logo: '/tokens/lighter.jpg',
    colorVar: '--chart-lighter',
    bgOpacity: 0.1,
    borderOpacity: 0.2,
  },
  // Future protocols can be added here:
  // drift: {
  //   id: 'drift',
  //   displayName: 'Drift',
  //   logo: '/tokens/drift.png',
  //   colorVar: '--chart-drift',
  //   bgOpacity: 0.1,
  //   borderOpacity: 0.2,
  // },
};

/**
 * Get protocol configuration by ID
 * @param protocolId - Protocol ID (case-insensitive)
 * @returns Protocol configuration or undefined if not found
 */
export function getProtocolConfig(protocolId: string): ProtocolConfig | undefined {
  const normalizedId = protocolId.toLowerCase();
  return PROTOCOL_CONFIGS[normalizedId];
}

/**
 * Get protocol configuration by display name
 * @param displayName - Protocol display name
 * @returns Protocol configuration or undefined if not found
 */
export function getProtocolConfigByDisplayName(displayName: string): ProtocolConfig | undefined {
  return Object.values(PROTOCOL_CONFIGS).find(
    (config) => config.displayName.toLowerCase() === displayName.toLowerCase()
  );
}

/**
 * Get all protocol IDs
 */
export function getAllProtocolIds(): string[] {
  return Object.keys(PROTOCOL_CONFIGS);
}
