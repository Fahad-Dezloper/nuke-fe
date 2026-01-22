/**
 * Turnkey Barrel Export
 * Centralized export for all Turnkey-related modules
 */

// Core
export { TurnkeyClient, turnkeyClient } from './client';
export { TurnkeyProvider } from './provider';
export { useTurnkey } from './hooks';

// Store atoms (for advanced usage)
export {
  turnkeyStateAtom,
  isLoggedInAtom,
  isLoadingAtom,
  isLoggingInAtom,
  isCreatingWalletAtom,
  userWalletsAtom,
  turnkeySubOrgIdAtom,
  publicKeyAtom,
  nonceAtom,
} from './store';

// Managers (for advanced usage)
export { SessionManager } from './session-manager';
export { OAuthHandler } from './oauth-handler';
export { WalletManager } from './wallet-manager';

// Helpers
export {
  loginWithEVMWallet,
  loginWithSolanaWallet,
  PhantomSolanaWallet,
} from './wallet-helpers';
export { calculateSha256, isOAuthRedirectInProgress, extractOAuthParams } from './utils';
export { getEVMAddress, getSolanaAddress } from './wallet-utils';

// Types
export type {
  Wallet,
  TurnkeyState,
  LoginResult,
  WalletCreationResult,
  SignTransactionResult,
  SignPayloadResult,
} from './types';

// Constants
export {
  SESSION_EXPIRATION_SECONDS,
  GOOGLE_AUTH_URL,
  TURNKEY_API_BASE_URL,
  WALLET_NAMES,
  ADDRESS_FORMATS,
  CURVES,
  PATH_FORMATS,
  DERIVATION_PATHS,
} from './constants';
