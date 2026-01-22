/**
 * Session Manager
 * Handles session refresh and validation
 */

import { Turnkey } from '@turnkey/sdk-browser';
import { SESSION_EXPIRATION_SECONDS } from './constants';

export class SessionManager {
  constructor(private turnkey: Turnkey) {}

  /**
   * Refresh session if expired
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
        // Try to get wallets to check if session is valid
        await indexedDbClient.getWallets({
          organizationId: session.organizationId,
        });
        return true;
      } catch (error) {
        // Session expired, try to refresh
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
   * Get current session
   */
  async getSession() {
    return await this.turnkey.getSession();
  }

  /**
   * Check if session exists and is valid
   */
  async hasValidSession(): Promise<boolean> {
    const session = await this.turnkey.getSession();
    if (!session || !session.organizationId) {
      return false;
    }

    return await this.refreshSessionIfNeeded();
  }
}
