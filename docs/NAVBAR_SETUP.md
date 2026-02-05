# Navbar Setup

## Installation

First, install framer-motion:

```bash
pnpm add framer-motion
```

## Components Created

### 1. **Navbar** (`components/layout/navbar.tsx`)

Main navbar component that combines all sub-components.

**Features:**

- Smooth entrance animation
- Logo with hover effects
- Navigation tabs with active state indicator
- User actions (icon + connect wallet button)
- Fully customizable via props

**Usage:**

```tsx
import { Navbar } from '@/components/layout/navbar';

<Navbar
  onConnectWallet={() => console.log('Connect wallet')}
  navItems={[
    { label: 'FUNDING ARBITRAGE', href: '/' },
    { label: 'TRADE', href: '/trade', soon: true },
  ]}
/>;
```

### 2. **NavbarLogo** (`components/layout/navbar-logo.tsx`)

Reusable logo component.

**Usage:**

```tsx
import { NavbarLogo } from '@/components/layout/navbar-logo';

<NavbarLogo text="Nuke" href="/" />;
```

### 3. **NavbarTabs** (`components/layout/navbar-tabs.tsx`)

Navigation tabs component with active state.

**Usage:**

```tsx
import { NavbarTabs } from '@/components/layout/navbar-tabs';

<NavbarTabs
  items={[
    { label: 'FUNDING ARBITRAGE', href: '/' },
    { label: 'TRADE', href: '/trade', soon: true },
  ]}
/>;
```

### 4. **NavbarActions** (`components/layout/navbar-actions.tsx`)

User actions section (icons + buttons).

**Usage:**

```tsx
import { NavbarActions } from '@/components/layout/navbar-actions';

<NavbarActions
  onConnectWallet={() => console.log('Connect')}
  iconType="send"
  connectWalletText="CONNECT WALLET"
/>;
```

## Animations

All components use Framer Motion for smooth animations:

- **Entrance**: Fade in + slide down
- **Logo**: Scale on hover/tap
- **Tabs**: Active indicator with spring animation
- **Icons**: Rotate and scale on hover
- **Buttons**: Scale on tap

## Customization

The navbar follows your design theme:

- Background: `#020202` (near-black)
- Accent: `#89CFF0` (light blue/cyan)
- Text: White with varying opacity
- Borders: White with low opacity

All colors are defined in `globals.css` and can be customized there.
