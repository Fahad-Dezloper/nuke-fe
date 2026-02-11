import { Turnkey } from '@turnkey/sdk-browser';
import type { LoginResult } from './types';
import { GOOGLE_AUTH_URL } from './constants';
import { extractOAuthParams, isOAuthRedirectInProgress } from './utils';
import { ErrorCode, createError, toAppError, getUserMessage } from '@/lib/errors';

/**
 * OAuthHandler manages OAuth authentication flows, particularly Google OAuth.
 * Handles OAuth redirects, URL generation, and authentication with OAuth providers.
 */
export class OAuthHandler {
  /**
   * Creates a new OAuthHandler instance.
   *
   * @param turnkey - Turnkey SDK instance
   * @param getPublicKey - Function to get current public key
   * @param getNonce - Function to get current nonce
   * @param checkExistingKeyPair - Function to check for existing key pair
   * @param calculateSha256 - Function to calculate SHA-256 hash
   */
  constructor(
    private turnkey: Turnkey,
    private getPublicKey: () => string | null,
    private getNonce: () => string | null,
    private checkExistingKeyPair: () => Promise<string | null>,
    private calculateSha256: (input: string) => Promise<string>
  ) {}

  /**
   * Handles OAuth redirect callback after user authentication.
   * Extracts OAuth parameters from URL, validates them, and completes the login process.
   *
   * @param loginWithGoogle - Function to perform Google OAuth login
   * @param loadUserData - Function to load user data after successful login
   * @param prepareForLogin - Function to prepare for login if redirect is not in progress
   * @returns Promise that resolves when OAuth redirect handling is complete
   *
   * @example
   * ```typescript
   * await oauthHandler.handleOAuthRedirect(
   *   (credential, publicKey) => loginWithGoogle(credential, publicKey),
   *   (subOrgId) => loadUserData(subOrgId),
   *   () => prepareForLogin()
   * );
   * ```
   */
  async handleOAuthRedirect(
    loginWithGoogle: (credential: string, publicKey?: string) => Promise<LoginResult>,
    loadUserData: (subOrgId: string) => Promise<void>,
    prepareForLogin: () => Promise<void>
  ): Promise<void> {
    try {
      if (!isOAuthRedirectInProgress()) {
        await prepareForLogin();
        return;
      }

      const { idToken, provider, flow } = extractOAuthParams();

      if (idToken && provider === 'google' && flow === 'redirect') {
        let publicKey = this.getPublicKey();
        if (!publicKey) {
          const existingPublicKey = await this.checkExistingKeyPair();
          if (existingPublicKey) {
            await this.calculateSha256(existingPublicKey);
            publicKey = existingPublicKey;
          } else {
            throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
              reason: 'No public key available during OAuth redirect',
            });
          }
        }

        const result = await loginWithGoogle(idToken, publicKey);

        if (result.success) {
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search
          );

          await loadUserData(result.subOrgId!);
          return;
        }
      }

      if (!isOAuthRedirectInProgress()) {
        await prepareForLogin();
      }
    } catch (error) {
      console.error('OAuth redirect handling failed:', error);
      if (!isOAuthRedirectInProgress()) {
        await prepareForLogin();
      }
    }
  }

  /**
   * Generates a Google OAuth authentication URL with required parameters.
   * Includes client ID, redirect URI, nonce, and state parameters for secure OAuth flow.
   *
   * @param clientId - Google OAuth client ID
   * @param redirectUri - URI to redirect to after authentication
   * @returns The complete Google OAuth authentication URL
   *
   * @throws {AppError} If public key or nonce is not available
   *
   * @example
   * ```typescript
   * const authUrl = oauthHandler.generateGoogleAuthUrl(
   *   'your-google-client-id',
   *   'https://yourapp.com/callback'
   * );
   * window.location.href = authUrl;
   * ```
   */
  generateGoogleAuthUrl(clientId: string, redirectUri: string): string {
    const publicKey = this.getPublicKey();
    if (!publicKey) {
      throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
        reason: 'Public key not available for OAuth',
      });
    }

    const nonce = this.getNonce();
    if (!nonce) {
      throw createError(ErrorCode.INTERNAL_STATE_ERROR, {
        reason: 'Nonce not available for OAuth',
      });
    }

    const flow = 'redirect';
    const normalizedRedirectUri = redirectUri.replace(/\/$/, '');

    // Generate CSRF token and store it for validation on return
    const csrfToken = crypto.randomUUID();
    try {
      sessionStorage.setItem('oauth_csrf_token', csrfToken);
    } catch { /* sessionStorage not available */ }

    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', normalizedRedirectUri);
    googleAuthUrl.searchParams.set('response_type', 'id_token');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('nonce', nonce);
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('state', `provider=google&flow=${flow}&csrf=${csrfToken}`);

    return googleAuthUrl.toString();
  }

  /**
   * Redirects the browser to Google OAuth authentication page.
   * Generates the OAuth URL and immediately redirects the user.
   *
   * @param clientId - Google OAuth client ID
   * @param redirectUri - URI to redirect to after authentication
   *
   * @example
   * ```typescript
   * oauthHandler.redirectToGoogle(
   *   'your-google-client-id',
   *   'https://yourapp.com/callback'
   * );
   * ```
   */
  redirectToGoogle(clientId: string, redirectUri: string): void {
    const authUrl = this.generateGoogleAuthUrl(clientId, redirectUri);
    window.location.href = authUrl;
  }

  /**
   * Performs login with Google OAuth credential.
   * Creates or retrieves a Turnkey sub-organization for the user,
   * authenticates with the OIDC token, and establishes a session.
   *
   * @param googleCredential - Google OAuth ID token (JWT)
   * @param publicKeyOverride - Optional public key override (for OAuth redirect scenarios)
   * @returns Promise resolving to login result with success status, sub-organization ID, or error
   *
   * @throws {AppError} If public key is not available or authentication fails
   *
   * @example
   * ```typescript
   * const result = await oauthHandler.loginWithGoogle(idToken);
   * if (result.success) {
   *   console.log('Logged in with sub-org:', result.subOrgId);
   * }
   * ```
   */
  async loginWithGoogle(
    googleCredential: string,
    publicKeyOverride?: string
  ): Promise<LoginResult> {
    try {
      const publicKey = publicKeyOverride || this.getPublicKey();
      if (!publicKey) {
        throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
          reason: 'Public key not available for Google login',
        });
      }

      let targetSubOrgId: string;

      const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterType: 'OIDC_TOKEN',
          filterValue: googleCredential,
        }),
      });

      const suborgsData = await getSuborgsResponse.json();

      if (suborgsData.organizationIds && suborgsData.organizationIds.length > 0) {
        targetSubOrgId = suborgsData.organizationIds[0];
      } else {
        const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oauthProviders: [{ providerName: 'Google-Test', oidcToken: googleCredential }],
            apiKeys: [],
          }),
        });

        const createResult = await createSuborgResponse.json();

        console.log('Suborg created with id: ', createResult);
        targetSubOrgId = createResult.subOrganizationId;
      }

      const authResponse = await fetch('/api/turnkey/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suborgID: targetSubOrgId,
          publicKey: publicKey,
          oidcToken: googleCredential,
        }),
      });

      const authResult = await authResponse.json();

      if (authResult.session) {
        const indexedDbClient = await this.turnkey.indexedDbClient();
        await indexedDbClient.init();
        await indexedDbClient.loginWithSession(authResult.session);

        return {
          success: true,
          subOrgId: targetSubOrgId,
        };
      } else {
        throw createError(ErrorCode.AUTH_INVALID_CREDENTIALS, {
          reason: 'No session received from authentication',
        });
      }
    } catch (error: unknown) {
      const appError = toAppError(error, ErrorCode.AUTH_INVALID_CREDENTIALS);
      console.error('Login error:', appError);
      return {
        success: false,
        error: getUserMessage(appError),
      };
    }
  }
}
