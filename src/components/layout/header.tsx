/**
 * Header Component
 * Main application header/navigation
 */

import Link from 'next/link';
import { ROUTES } from '@/lib/constants';

export function Header() {
  return (
    <header className='sticky top-0 z-50 w-full border-b border-border-white-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='container flex h-16 items-center justify-between px-4'>
        <div className='flex items-center gap-6'>
          <Link href={ROUTES.home} className='flex items-center gap-2'>
            <span className='text-xl font-bold text-accent'>Nuke</span>
          </Link>
          <nav className='hidden md:flex items-center gap-6'>
            <Link
              href={ROUTES.dashboard}
              className='text-sm font-medium text-text-muted-60 hover:text-text-primary transition-colors'
            >
              Dashboard
            </Link>
            <Link
              href={ROUTES.positions}
              className='text-sm font-medium text-text-muted-60 hover:text-text-primary transition-colors'
            >
              Positions
            </Link>
            <Link
              href={ROUTES.strategies}
              className='text-sm font-medium text-text-muted-60 hover:text-text-primary transition-colors'
            >
              Strategies
            </Link>
          </nav>
        </div>
        <div className='flex items-center gap-4'>
          {/* Add user menu, notifications, etc. here */}
        </div>
      </div>
    </header>
  );
}

