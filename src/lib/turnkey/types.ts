export interface Wallet {
  walletId: string;
  walletName: string;
  accounts?: Array<{
    address: string;
    addressFormat: string;
    path: string;
    publicKey: string;
  }>;
}

export interface TurnkeyState {
  isLoggedIn: boolean;
  isLoading: boolean;
  isLoggingIn: boolean;
  isCreatingWallet: boolean;
  userWallets: Wallet[];
  turnkeySubOrgId: string | null;
  publicKey: string | null;
  nonce: string | null;
  googleIdToken: string | null;
}

export interface LoginResult {
  success: boolean;
  subOrgId?: string;
  wallets?: Wallet[];
  error?: string;
}

export interface WalletCreationResult {
  success: boolean;
  wallet?: Wallet;
  error?: string;
}

export interface SignTransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface SignPayloadResult {
  success: boolean;
  signature?: {
    r: string;
    s: string;
    v: number;
  };
  error?: string;
}
