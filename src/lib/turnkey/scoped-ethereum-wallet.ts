import { BaseEthereumWallet } from '@turnkey/wallet-stamper';
import type { Hex } from 'viem';
import type { Eip1193Requester } from '@/lib/wallet-discovery/eip6963';
import { createError, ErrorCode } from '@/lib/errors';

/**
 * Ethereum wallet stamper pinned to a specific EIP-1193 provider (EIP-6963),
 * instead of always using window.ethereum.
 */
export class ScopedEthereumWallet extends BaseEthereumWallet {
  constructor(private readonly provider: Eip1193Requester) {
    super();
  }

  async signMessage(message: string | Hex): Promise<Hex> {
    const accounts = (await this.provider.request({
      method: 'eth_requestAccounts',
      params: [],
    })) as string[] | undefined;

    const account = accounts?.[0];
    if (!account) {
      throw createError(ErrorCode.WALLET_NOT_AVAILABLE, {
        reason: 'No connected Ethereum account',
      });
    }

    const signature = (await this.provider.request({
      method: 'personal_sign',
      params: [message, account],
    })) as Hex;

    return signature;
  }
}
