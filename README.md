# Nuke - Perpetual Arbitrage Terminal

Chain agnostic delta-neutral funding arbitrage terminal.

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── layout.tsx         # Root layout with header/footer
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles and theme
├── components/            # React components
│   ├── ui/               # Reusable UI components (Button, Card, Input, etc.)
│   ├── layout/           # Layout components (Header, Footer)
│   └── features/         # Feature-specific components
├── hooks/                # Custom React hooks
│   ├── use-api.ts        # API call hook with loading/error states
│   ├── use-debounce.ts  # Debounce hook
│   └── use-local-storage.ts # LocalStorage hook
├── lib/                  # Utilities and configurations
│   ├── api/              # API client and services
│   │   ├── client.ts     # API client configuration
│   │   ├── endpoints.ts  # API endpoint definitions
│   │   └── services/     # API service functions
│   ├── utils.ts          # Utility functions
│   └── constants.ts      # Application constants
└── types/                # TypeScript type definitions
    └── index.ts          # Shared types and interfaces
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

3. Update `.env` with your API URL and other configuration

4. Run the development server:

```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Features

### API Client

The API client (`src/lib/api/client.ts`) provides a centralized way to make HTTP requests:

```typescript
import { apiClient } from '@/lib/api';

// GET request
const data = await apiClient.get('/endpoint', { page: 1 });

// POST request
const result = await apiClient.post('/endpoint', { name: 'Strategy' });
```

### Custom Hooks

#### useApi Hook

Make API calls with built-in loading and error states:

```typescript
import { useApi } from '@/hooks';
import { arbitrageService } from '@/lib/api';

function MyComponent() {
  const { data, loading, error, execute } = useApi(
    () => arbitrageService.getPositions(),
    {
      onSuccess: (data) => console.log('Success!', data),
      onError: (error) => console.error('Error!', error),
    }
  );

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && <div>{/* Render data */}</div>}
    </div>
  );
}
```

#### useDebounce Hook

Debounce values for search inputs:

```typescript
import { useDebounce } from '@/hooks';

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    // API call with debounced value
    search(debouncedSearch);
  }, [debouncedSearch]);
}
```

### UI Components

All UI components are located in `src/components/ui/` and follow a consistent design system:

```typescript
import { Button, Card, Input } from '@/components/ui';

<Button variant="primary" size="md">Click me</Button>
<Card variant="bordered">Content here</Card>
<Input placeholder="Enter text..." />
```

### Color Palette

The application uses a custom color palette defined in `globals.css`:

- **Background**: `#020202` (near-black)
- **Card/Surface**: `#111` (dark gray)
- **Accent**: `#89CFF0` (light blue/cyan)
- **Accent Secondary**: `#3a5866`
- **Text**: White with various opacity levels (10%, 30%, 40%, 60%, 80%, 100%)

Use Tailwind classes like:

- `bg-background`, `bg-card`
- `text-text-primary`, `text-text-muted-60`
- `text-accent`, `bg-accent-secondary`
- `border-border-white-10`

## Development

### Adding New Components

1. Create component in appropriate folder:
   - `components/ui/` for reusable UI components
   - `components/features/` for feature-specific components
   - `components/layout/` for layout components

2. Export from the appropriate `index.ts` file

3. Use the component with proper TypeScript types

### Adding New API Endpoints

1. Add endpoint to `src/lib/api/endpoints.ts`:

```typescript
export const API_ENDPOINTS = {
  myFeature: {
    list: '/my-feature/list',
    create: '/my-feature/create',
  },
};
```

2. Create service in `src/lib/api/services/`:

```typescript
export const myFeatureService = {
  async getList() {
    return apiClient.get(API_ENDPOINTS.myFeature.list);
  },
};
```

3. Export from `src/lib/api/services/index.ts`

### Adding New Hooks

1. Create hook in `src/hooks/`
2. Export from `src/hooks/index.ts`
3. Use throughout the application

## Building for Production

```bash
pnpm build
pnpm start
```

## Tech Stack

- **Framework**: Next.js 16
- **React**: 19
- **Styling**: Tailwind CSS v4
- **TypeScript**: 5
- **Font**: Roboto Mono

## License

Private
