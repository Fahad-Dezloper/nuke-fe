/**
 * Footer Component
 * Main application footer
 */

import { APP_CONFIG } from '@/lib/constants';

export function Footer() {
  return (
    <footer className='border-t border-border-white-10 bg-background'>
      <div className='container flex flex-col items-center justify-between gap-4 py-6 px-3 md:flex-row'>
        <p className='text-sm text-text-muted-60'>
          © {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.
        </p>
        <p className='text-sm text-text-muted-40'>
          {APP_CONFIG.description}
        </p>
      </div>
    </footer>
  );
}

