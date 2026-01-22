/**
 * Login Page
 * Handles OAuth redirects and displays login options
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTurnkey } from '@/lib/turnkey';
import { ConnectWalletModal } from '@/components/ui/connect-wallet-modal';
import { useState } from 'react';

export default function LoginPage() {
  const { state, checkSession } = useTurnkey();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Handle OAuth redirect or check existing session
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    // Redirect to home if already logged in
    if (state.isLoggedIn) {
      router.push('/');
    } else if (!state.isLoading) {
      // Show modal if not loading and not logged in
      setIsModalOpen(true);
    }
  }, [state.isLoggedIn, state.isLoading, router]);

  if (state.isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='text-text-primary'>Loading...</div>
      </div>
    );
  }

  if (state.isLoggedIn) {
    return null; // Will redirect
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-background'>
      <ConnectWalletModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          router.push('/');
        }}
      />
    </div>
  );
}
