import { Turnkey } from '@turnkey/sdk-browser';
import { SESSION_EXPIRATION_SECONDS } from './constants';

/**
 * SessionManager handles Turnkey session lifecycle operations.
 * Manages session refresh, validation, and expiration handling.
 */
export class SessionManager {
  /**
   * Creates a new SessionManager instance.
   *
   * @param turnkey - Turnkey SDK instance
   */
  constructor(private turnkey: Turnkey) { }

  /**
   * Refreshes the current session if it has expired or is invalid.
   * Attempts to validate the session by checking wallets, and if that fails,
   * refreshes the session using the stored public key.
   *
   * @returns Promise resolving to true if session is valid or was successfully refreshed, false otherwise
   *
   * @example
   * ```typescript
   * const isValid = await sessionManager.refreshSessionIfNeeded();
   * if (!isValid) {
   *   // Handle expired session
   * }
   * ```
   */
  async refreshSessionIfNeeded(): Promise<boolean> {
    try {
      const session = await this.turnkey.getSession();
      if (!session || !session.organizationId) {
        return false;
      }

      const indexedDbClient = await this.turnkey.indexedDbClient();
      await indexedDbClient.init();

      try {
        await indexedDbClient.getWallets({
          organizationId: session.organizationId,
        });
        return true;
      } catch (error) {
        const publicKey = await indexedDbClient.getPublicKey();
        if (publicKey) {
          await indexedDbClient.refreshSession({
            sessionType: 'SESSION_TYPE_READ_WRITE',
            publicKey: publicKey,
            expirationSeconds: SESSION_EXPIRATION_SECONDS.toString(),
          });
          return true;
        } else {
          console.error('No public key available for session refresh');
          return false;
        }
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
      return false;
    }
  }

  /**
   * Gets the current Turnkey session.
   *
   * @returns Promise resolving to the current session object, or null if no session exists
   */
  async getSession() {
    return await this.turnkey.getSession();
  }

  /**
   * Checks if the current session is valid and active.
   * Validates the session exists and attempts to refresh it if needed.
   *
   * @returns Promise resolving to true if session is valid, false otherwise
   *
   * @example
   * ```typescript
   * const isValid = await sessionManager.hasValidSession();
   * if (isValid) {
   *   // Proceed with authenticated operations
   * }
   * ```
   */
  async hasValidSession(): Promise<boolean> {
    const session = await this.turnkey.getSession();
    if (!session || !session.organizationId) {
      return false;
    }

    return await this.refreshSessionIfNeeded();
  }
}
