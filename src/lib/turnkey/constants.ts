export const SESSION_EXPIRATION_SECONDS = 3600 * 24 * 10; // 10 days

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export const TURNKEY_API_BASE_URL = 'https://api.turnkey.com';

export const WALLET_NAMES = {
  DEFAULT: 'Default Wallet',
  ETHEREUM: 'Ethereum Wallet',
  SOLANA: 'Solana Wallet',
} as const;

export const ADDRESS_FORMATS = {
  ETHEREUM: 'ADDRESS_FORMAT_ETHEREUM',
  SOLANA: 'ADDRESS_FORMAT_SOLANA',
} as const;

export const CURVES = {
  SECP256K1: 'CURVE_SECP256K1',
  ED25519: 'CURVE_ED25519',
} as const;

export const PATH_FORMATS = {
  BIP32: 'PATH_FORMAT_BIP32',
} as const;

export const DERIVATION_PATHS = {
  ETHEREUM: "m/44'/60'/0'/0/0",
  SOLANA: "m/44'/501'/0'/0/0",
} as const;
