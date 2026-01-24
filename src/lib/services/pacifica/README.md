# Pacifica Service

This service provides a complete implementation for interacting with the Pacifica API, including order creation with Turnkey-based Solana message signing.

## Structure

- `pacifica.service.ts` - Main service class with order creation methods
- `types.ts` - TypeScript interfaces for requests and responses
- `store.ts` - Jotai atoms for trading state management
- `utils/signing.ts` - Utilities for preparing signing data (recursive JSON sorting, compact JSON)
- `utils/turnkey-signing.ts` - Turnkey integration for Solana message signing

## Usage

```typescript
import { pacificaService } from '@/lib/services/pacifica';

// Create a market order
const result = await pacificaService.createMarketOrder(
  {
    symbol: 'BTC',
    amount: '0.1',
    side: 'bid',
    slippage_percent: '0.5',
    reduce_only: false,
  },
  walletAddress, // Turnkey Solana wallet address
  organizationId  // Turnkey organization ID
);

if (result.success) {
  console.log('Order created:', result.order_id);
} else {
  console.error('Error:', result.error);
}
```

## Dependencies

This service requires:
- `@turnkey/solana` - For TurnkeySigner (Solana message signing)
- `@turnkey/sdk-browser` - For Turnkey wallet integration
- `bs58` - For Base58 encoding/decoding (already installed)

All dependencies should already be installed.

## Signing Flow

1. **Prepare Operation Data**: Collect order parameters (symbol, amount, side, etc.)
2. **Create Signature Header**: Add timestamp, expiry_window, and operation type
3. **Wrap in "data" Key**: Combine header with operation data wrapped in "data"
4. **Recursive Sort**: Sort all JSON keys alphabetically at all levels
5. **Compact JSON**: Create compact JSON string (no whitespace)
6. **Convert to Bytes**: Encode message as UTF-8 bytes
7. **Sign with Turnkey**: Use Turnkey's indexedDbClient to sign (currently via transaction workaround)
8. **Base58 Encode**: Convert signature to Base58 string
9. **Build Final Request**: Combine signature header fields with operation data (flat, not wrapped)

## Signing Implementation

The signing implementation uses `TurnkeySigner` from `@turnkey/solana`, which provides direct message signing:
- Uses `TurnkeySigner.signMessage()` to sign the message bytes directly
- Returns a 64-byte Ed25519 signature (Uint8Array)
- Converts the signature to Base58 encoding for the Pacifica API

This is the proper way to sign messages for Pacifica, as it directly signs the message bytes without needing to create a transaction.

## API Requirements

- **Amounts**: Must be strings (e.g., `"0.1"` not `0.1`)
- **Slippage**: Must be string (e.g., `"0.5"` not `0.5`)
- **Side**: Must be lowercase (`"bid"` or `"ask"`)
- **Operation Type**: `"create_market_order"` for market orders

## State Management

The service includes Jotai atoms for state management:
- `pacificaTradingStateAtom` - Main trading state
- `isPacificaTradingLoadingAtom` - Loading state
- `pacificaTradingErrorAtom` - Error state
- `isPacificaSigningInProgressAtom` - Signing progress state
