# Project Structure Guide

This document outlines the production-grade folder structure and conventions used in this project.

## Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with Header/Footer
│   ├── page.tsx                 # Home page
│   ├── globals.css              # Global styles & theme
│   ├── (routes)/                # Route groups (optional)
│   │   ├── dashboard/
│   │   ├── positions/
│   │   └── strategies/
│   └── api/                     # API routes (if needed)
│       └── [route]/
│           └── route.ts
│
├── components/                  # React Components
│   ├── ui/                      # Reusable UI Components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── index.ts             # Barrel export
│   │
│   ├── layout/                  # Layout Components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   └── index.ts
│   │
│   └── features/                # Feature-Specific Components
│       ├── positions/
│       │   ├── position-card.tsx
│       │   ├── position-list.tsx
│       │   └── index.ts
│       ├── strategies/
│       │   ├── strategy-form.tsx
│       │   └── index.ts
│       └── index.ts
│
├── hooks/                       # Custom React Hooks
│   ├── use-api.ts               # API calls with loading/error
│   ├── use-debounce.ts          # Debounce values
│   ├── use-local-storage.ts     # LocalStorage sync
│   └── index.ts                 # Barrel export
│
├── lib/                         # Utilities & Configurations
│   ├── api/                     # API Layer
│   │   ├── client.ts            # API client (fetch wrapper)
│   │   ├── endpoints.ts         # Endpoint definitions
│   │   ├── services/            # API Services
│   │   │   ├── arbitrage.service.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── utils.ts                 # Utility functions
│   ├── constants.ts             # App constants
│   └── index.ts                 # Barrel export
│
└── types/                       # TypeScript Definitions
    └── index.ts                 # Shared types & interfaces
```

## Component Organization

### UI Components (`components/ui/`)

Basic, reusable UI components that are style-only and don't contain business logic:

- **Button**: Various button variants (primary, secondary, outline, ghost, danger)
- **Card**: Container component with header, content, footer
- **Input**: Form input with error states
- **Add more**: Select, Modal, Toast, etc.

**Pattern:**
```typescript
// components/ui/button.tsx
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  // ...
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...);
```

### Layout Components (`components/layout/`)

Components that define the overall page structure:

- **Header**: Navigation and top bar
- **Footer**: Footer content
- **Sidebar**: (if needed)

### Feature Components (`components/features/`)

Feature-specific components organized by domain:

- Group by feature/domain (e.g., `positions/`, `strategies/`)
- Each feature folder contains related components
- Export via `index.ts` for clean imports

**Example:**
```typescript
// components/features/positions/position-card.tsx
export function PositionCard({ position }: { position: Position }) {
  // Component implementation
}

// components/features/positions/index.ts
export { PositionCard } from './position-card';
export { PositionList } from './position-list';
```

## API Layer

### API Client (`lib/api/client.ts`)

Centralized HTTP client with:
- Request/response handling
- Error handling
- Type safety
- Query parameter support

**Usage:**
```typescript
import { apiClient } from '@/lib/api';

const data = await apiClient.get('/endpoint', { page: 1 });
const result = await apiClient.post('/endpoint', { name: 'Strategy' });
```

### Endpoints (`lib/api/endpoints.ts`)

Centralized endpoint definitions for type safety:

```typescript
export const API_ENDPOINTS = {
  arbitrage: {
    positions: '/arbitrage/positions',
    strategies: '/arbitrage/strategies',
  },
} as const;
```

### Services (`lib/api/services/`)

Service functions that wrap API calls with business logic:

```typescript
// lib/api/services/arbitrage.service.ts
export const arbitrageService = {
  async getPositions() {
    return apiClient.get(API_ENDPOINTS.arbitrage.positions);
  },
};
```

## Custom Hooks

### useApi Hook

Handles API calls with loading and error states:

```typescript
const { data, loading, error, execute } = useApi(
  () => arbitrageService.getPositions(),
  {
    onSuccess: (data) => console.log(data),
    onError: (error) => console.error(error),
  }
);
```

### useDebounce Hook

Debounces values (useful for search):

```typescript
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 500);
```

### useLocalStorage Hook

Syncs state with localStorage:

```typescript
const [value, setValue] = useLocalStorage('key', 'default');
```

## Type Definitions

All shared types in `types/index.ts`:

```typescript
export interface Position {
  id: string;
  // ...
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
}
```

## Best Practices

### 1. Barrel Exports

Use `index.ts` files for clean imports:

```typescript
// Instead of:
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Use:
import { Button, Card } from '@/components/ui';
```

### 2. Component Naming

- **UI Components**: PascalCase, descriptive (e.g., `Button`, `Card`)
- **Feature Components**: Feature prefix (e.g., `PositionCard`, `StrategyForm`)
- **Layout Components**: Descriptive (e.g., `Header`, `Footer`)

### 3. File Organization

- One component per file
- Co-locate related files (e.g., `position-card.tsx` + `position-card.test.tsx`)
- Use folders for feature groups

### 4. API Calls

- Always use services, never call `apiClient` directly in components
- Use `useApi` hook for component-level API calls
- Handle errors consistently

### 5. Type Safety

- Define types in `types/index.ts`
- Use TypeScript interfaces for props
- Avoid `any` types

### 6. Styling

- Use Tailwind utility classes
- Use `cn()` utility for conditional classes
- Follow the color palette defined in `globals.css`

## Adding New Features

### 1. Add a New Route

```typescript
// app/dashboard/page.tsx
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
```

### 2. Add a New API Service

```typescript
// lib/api/services/my-feature.service.ts
export const myFeatureService = {
  async getData() {
    return apiClient.get('/my-feature');
  },
};

// lib/api/services/index.ts
export { myFeatureService } from './my-feature.service';
```

### 3. Add a New Component

```typescript
// components/features/my-feature/my-component.tsx
export function MyComponent() {
  return <div>Content</div>;
}

// components/features/my-feature/index.ts
export { MyComponent } from './my-component';
```

### 4. Add a New Hook

```typescript
// hooks/use-my-hook.ts
export function useMyHook() {
  // Implementation
}

// hooks/index.ts
export { useMyHook } from './use-my-hook';
```

## Environment Variables

Create `.env.local` (not committed):

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Access in code:
```typescript
process.env.NEXT_PUBLIC_API_URL
```

## Import Paths

Use `@/` alias for `src/`:

```typescript
import { Button } from '@/components/ui';
import { useApi } from '@/hooks';
import { apiClient } from '@/lib/api';
import type { Position } from '@/types';
```

