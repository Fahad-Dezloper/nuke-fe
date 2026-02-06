/**
 * Pacifica Deposit Service
 * Handles Pacifica deposit API calls for Solana
 */

import { apiClient } from '@/lib/api/client';
import type { PacificaDepositRequest, PacificaDepositResponse } from './types';

/**
 * Pacifica Deposit Service
 */
export const pacificaDepositService = {
    /**
     * Get partially signed deposit transaction from backend
     * The fee payer has already signed, user needs to sign and submit
     * 
     * @param request - Deposit request parameters
     * @returns Base64 encoded partially signed Solana transaction
     */
    async getPartiallySignedTransaction(
        request: PacificaDepositRequest
    ): Promise<PacificaDepositResponse> {
        try {
            const response = await apiClient.post<PacificaDepositResponse>('/pacifica/deposit', {
                user_address: request.user_address,
                amount: parseInt(request.amount, 10), // BE expects u64
            });

            // Response is a Base64 encoded transaction string
            return response;
        } catch (error) {
            console.error('Error getting Pacifica deposit transaction:', error);
            throw new Error(
                error instanceof Error ? error.message : 'Failed to get Pacifica deposit transaction'
            );
        }
    },
};
