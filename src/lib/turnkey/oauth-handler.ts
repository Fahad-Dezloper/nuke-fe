/**
 * OAuth Handler
 * Handles Google OAuth login flow
 */

import { Turnkey } from '@turnkey/sdk-browser';
import type { LoginResult } from './types';
import { GOOGLE_AUTH_URL } from './constants';
import { extractOAuthParams, isOAuthRedirectInProgress } from './utils';

export class OAuthHandler {
  constructor(
    private turnkey: Turnkey,
    private getPublicKey: () => string | null,
    private getNonce: () => string | null,
    private checkExistingKeyPair: () => Promise<string | null>,
    private calculateSha256: (input: string) => Promise<string>
  ) {}

  /**
   * Handle OAuth redirect after Google login
   */
  async handleOAuthRedirect(
    loginWithGoogle: (credential: string) => Promise<LoginResult>,
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
        // Ensure we have a public key
        let publicKey = this.getPublicKey();
        if (!publicKey) {
          const existingPublicKey = await this.checkExistingKeyPair();
          if (existingPublicKey) {
            const nonce = await this.calculateSha256(existingPublicKey);
            publicKey = existingPublicKey;
            // Note: We can't update state here, so we'll handle it in the result
          } else {
            throw new Error('No public key available during OAuth redirect');
          }
        }

        const result = await loginWithGoogle(idToken);

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
   * Generate Google OAuth URL
   */
  generateGoogleAuthUrl(clientId: string, redirectUri: string): string {
    const publicKey = this.getPublicKey();
    if (!publicKey) {
      throw new Error('Public key not available');
    }

    const nonce = this.getNonce();
    if (!nonce) {
      throw new Error('Nonce not available');
    }

    const flow = 'redirect';

    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri.replace(/\/$/, ''));
    googleAuthUrl.searchParams.set('response_type', 'id_token');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('nonce', nonce);
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('state', `provider=google&flow=${flow}`);

    return googleAuthUrl.toString();
  }

  /**
   * Redirect to Google OAuth
   */
  redirectToGoogle(clientId: string, redirectUri: string): void {
    const authUrl = this.generateGoogleAuthUrl(clientId, redirectUri);
    window.location.href = authUrl;
  }

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(googleCredential: string): Promise<LoginResult> {
    try {
      const publicKey = this.getPublicKey();
      if (!publicKey) {
        throw new Error('Public key not available');
      }

      let targetSubOrgId: string;

      // Check if suborg exists
      const getSuborgsResponse = await fetch('/api/turnkey/getSuborg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterType: 'OIDC_TOKEN',
          filterValue: googleCredential,
        }),
      });

      const suborgsData = await getSuborgsResponse.json();

      if (
        suborgsData.organizationIds &&
        suborgsData.organizationIds.length > 0
      ) {
        targetSubOrgId = suborgsData.organizationIds[0];
      } else {
        // Create new suborg
        const createSuborgResponse = await fetch('/api/turnkey/createSuborg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oauthProviders: [
              { providerName: 'Google-Test', oidcToken: googleCredential },
            ],
            apiKeys: [],
          }),
        });

        const createResult = await createSuborgResponse.json();
        targetSubOrgId = createResult.subOrganizationId;
      }

      // Authenticate and get session
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
        throw new Error('No session received from authentication');
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
