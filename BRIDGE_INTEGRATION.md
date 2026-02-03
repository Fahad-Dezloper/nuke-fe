# Bridge API Integration Documentation

## Overview

This document describes how to integrate the Bridge API for transferring tokens from **Base** to **Arbitrum** using the Relay.link bridge service. The integration uses Turnkey client on the frontend for signing permits.

## Flow

1. **Get Quote**: Call the quote API with bridge parameters
2. **Sign Permit**: Sign the permit data returned from the quote using Turnkey
3. **Execute Permit**: Submit the signed permit to execute the bridge transaction

## Quick Reference

**Request Flow:**
```
POST /bridge/quote
  ↓
Parse response → Find step with kind: "signature"
  ↓
Extract requestId and permit data from signature step
  ↓
Sign permit data with Turnkey (EIP-712 typed data)
  ↓
POST /bridge/execute/permits with signature + requestId
```

**Key Fields:**
- `requestId`: Found in `steps[].requestId` (from signature step)
- `permit data`: Found in `steps[].items[].data` (from signature step)
- `signature`: 65-byte hex string (0x + 130 hex chars) from Turnkey

---

## API Endpoints

### Base URL
```
http://your-server-url:8000
```

### Endpoints

#### 1. Get Quote
```
POST /bridge/quote
```

#### 2. Execute Permit
```
POST /bridge/execute/permits
```

---

## Step 1: Get Quote

### Request

**Endpoint:** `POST /bridge/quote`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```typescript
interface QuoteRequest {
  // Required fields
  user: string;                    // User's EVM address (0x...)
  originChainId: number;           // 8453 for Base
  destinationChainId: number;      // 42161 for Arbitrum
  originCurrency: string;           // Token address on Base (e.g., USDC)
  destinationCurrency: string;     // Token address on Arbitrum
  amount: string;                   // Amount to bridge (in wei/smallest unit)
  tradeType: string;                // "EXACT_INPUT" | "EXACT_OUTPUT" | "EXPECTED_OUTPUT"
  
  // Optional but recommended for permit flow
  usePermit?: boolean;              // true to use permit-based approval (default: false)
  recipient?: string;                // Recipient address (defaults to user if not specified)
  
  // Other optional fields (see Relay.link docs for full list)
  permitExpiry?: number;            // Permit expiry in seconds (default: 600 = 10 min)
  slippageTolerance?: string;       // Slippage in basis points (e.g., "50" = 0.5%)
  // ... many more optional fields available
}
```

**Example Request:**
```json
{
  "user": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "originChainId": 8453,
  "destinationChainId": 42161,
  "originCurrency": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "destinationCurrency": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "amount": "1000000000",
  "tradeType": "EXACT_INPUT",
  "usePermit": true,
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

### Response

**Status:** `200 OK`

**Response Body:**
The response is a JSON string containing the quote data from Relay.link. The main structure includes:

- `steps`: Array of steps that need to be executed (transactions or signatures)
- `fees`: Fee breakdown information
- `details`: Summary of the swap/bridge operation
- `protocol`: Protocol-specific information

**Key Response Structure:**
```typescript
interface QuoteResponse {
  steps: Step[];
  fees: {
    gas: FeeInfo;
    relayer: FeeInfo;
    relayerGas: FeeInfo;
    relayerService: FeeInfo;
    app?: FeeInfo;
    subsidized?: FeeInfo;
  };
  details: {
    operation: string;
    sender: string;
    recipient: string;
    currencyIn: CurrencyAmount;
    currencyOut: CurrencyAmount;
    // ... other details
  };
  protocol?: {
    v2?: {
      orderId: string;
      orderData: any;
      paymentDetails: any;
    };
  };
}

interface Step {
  id: string;              // "deposit", "approve", "authorize", etc.
  action: string;          // User-facing action text
  description: string;      // Description of the step
  kind: "transaction" | "signature";  // Type of step
  requestId: string;       // Unique identifier for this request (IMPORTANT!)
  items: StepItem[];       // Array of items to execute
}

interface StepItem {
  status: "complete" | "incomplete";
  data: any;               // Transaction data or signature data
  check?: {                // Optional endpoint to verify completion
    endpoint: string;
    method: string;
  };
}
```

**Example Response Structure:**
```json
{
  "steps": [
    {
      "id": "authorize",
      "action": "Sign permit",
      "description": "Authorize the bridge to spend your tokens",
      "kind": "signature",
      "requestId": "0x92b99e6e1ee1deeb9531b5ad7f87091b3d71254b3176de9e8b5f6c6d0bd3a331",
      "items": [
        {
          "status": "incomplete",
          "data": {
            // Permit data to sign (EIP-712 or EIP-2612 format)
            // This will contain domain, types, message, etc.
          }
        }
      ]
    },
    {
      "id": "deposit",
      "action": "Confirm transaction in your wallet",
      "description": "Depositing funds to the relayer",
      "kind": "transaction",
      "requestId": "0x92b99e6e1ee1deeb9531b5ad7f87091b3d71254b3176de9e8b5f6c6d0bd3a331",
      "items": [
        {
          "status": "incomplete",
          "data": {
            "from": "0x...",
            "to": "0x...",
            "data": "0x...",
            "value": "1000000000000000000",
            "chainId": 8453
          }
        }
      ]
    }
  ],
  "fees": { /* fee information */ },
  "details": { /* operation details */ }
}
```

**Note:** 
- The `requestId` is found in each step object, not at the root level
- For permit-based flows, look for a step with `kind: "signature"` and `id: "authorize"` or `id: "approve"`
- The permit data to sign will be in `steps[].items[].data` for the signature step

---

## Step 2: Sign Permit (Frontend with Turnkey)

After receiving the quote response, you need to find the signature step and sign the permit data using Turnkey client.

**Important:** When `usePermit: true` is set in the quote request, Relay.link will return a step with `kind: "signature"` that must be completed before the bridge transaction can proceed. This step typically has an `id` of `"authorize"` or `"approve"`.

### Extract Permit Data

From the quote response, you need to:
1. Find the step with `kind: "signature"` (typically with `id: "authorize"` or `id: "approve"`)
2. Extract the `requestId` from that step
3. Extract the permit data from `items[0].data`

**Example:**
```typescript
// Parse the JSON string response
const quoteResponse = JSON.parse(quoteResponseString);

// Find the signature step
const signatureStep = quoteResponse.steps.find(
  (step: Step) => step.kind === "signature"
);

if (!signatureStep) {
  throw new Error("No signature step found in quote response");
}

// Extract requestId and permit data
const requestId = signatureStep.requestId;
const permitData = signatureStep.items[0].data;

// The permitData will typically contain EIP-712 or EIP-2612 formatted data
// Structure may include: domain, types, message, etc.
```

### Sign with Turnkey

The permit data structure from Relay.link typically follows EIP-712 (typed data signing) or EIP-2612 (permit) format. You'll need to sign this using Turnkey's signing capabilities.

**Example for EIP-712 Typed Data:**
```typescript
import { TurnkeyClient } from '@turnkey/sdk';

// Extract permit data (from above)
const permitData = signatureStep.items[0].data;

// The permitData structure for EIP-712 typically looks like:
// {
//   domain: { name, version, chainId, verifyingContract },
//   types: { Permit: [...], EIP712Domain: [...] },
//   message: { owner, spender, value, nonce, deadline }
// }

// Sign using Turnkey's signTypedData method
const signature = await turnkeyClient.signTypedData({
  domain: permitData.domain,
  types: permitData.types,
  message: permitData.message,
  // Additional Turnkey-specific parameters
  // (e.g., walletId, organizationId, etc.)
});

// The signature should be in hex format (0x...)
// Format: r + s + v (65 bytes total, 130 hex characters + 0x prefix)
```

**Example for EIP-2612 Permit:**
```typescript
// If the permit follows EIP-2612, you may need to construct the typed data
// or the data might already be in the correct format

const signature = await turnkeyClient.signTypedData({
  domain: {
    name: permitData.domain.name,
    version: permitData.domain.version,
    chainId: permitData.domain.chainId || 8453, // Base
    verifyingContract: permitData.domain.verifyingContract,
  },
  types: permitData.types || {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
  },
  message: permitData.message,
});
```

**Important:** 
- The signature format must match what Relay.link expects (typically EIP-712 typed data signature)
- Ensure you're signing on the correct chain (Base, chainId: 8453)
- The signer address must match the `user` address from the quote request
- The signature should be in the format: `0x` + `r` (32 bytes) + `s` (32 bytes) + `v` (1 byte) = 65 bytes total
- Verify the permit data structure by inspecting the actual quote response

---

## Step 3: Execute Permit

### Request

**Endpoint:** `POST /bridge/execute/permits`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```typescript
interface PermitRequest {
  signature: string;      // Hex-encoded signature (0x...) - 65 bytes (r + s + v)
  kind: string;           // Permit kind/type (typically "PERMIT" or "PERMIT2")
  requestId: string;      // The requestId from the signature step in quote response
  api: string;            // API identifier (typically "relay")
}
```

**Example Request:**
```json
{
  "signature": "0x1234567890abcdef...",
  "kind": "PERMIT",
  "requestId": "0x92b99e6e1ee1deeb9531b5ad7f87091b3d71254b3176de9e8b5f6c6d0bd3a331",
  "api": "relay"
}
```

**Note:** 
- The `requestId` should be extracted from the signature step's `requestId` field
- The `kind` is typically "PERMIT" for EIP-2612 or "PERMIT2" for Permit2 protocol
- The `signature` must be the full 65-byte signature (0x + 130 hex characters)

### Response

**Status:** `200 OK`

**Response Body:**
The response is a JSON string containing the execution result from Relay.link, which typically includes:
- Transaction hash
- Status
- Bridge transaction details

**Example Response:**
```json
{
  "transactionHash": "0x...",
  "status": "pending",
  // ... other execution details
}
```

---

## Complete Integration Example

```typescript
// TypeScript example
async function bridgeTokens(
  userAddress: string,
  amount: string,
  recipient: string,
  turnkeyClient: TurnkeyClient
) {
  // Step 1: Get Quote
  const quoteRequest = {
    user: userAddress,
    originChainId: 8453, // Base
    destinationChainId: 42161, // Arbitrum
    originCurrency: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    destinationCurrency: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
    amount: amount,
    tradeType: "EXACT_INPUT",
    usePermit: true,
    recipient: recipient,
  };

  const quoteResponse = await fetch('http://your-server:8000/bridge/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(quoteRequest),
  });

  const quoteData = await quoteResponse.json();
  const quote = JSON.parse(quoteData); // Response is a JSON string

  // Step 2: Find and Sign Permit
  // Find the signature step in the quote response
  const signatureStep = quote.steps.find(
    (step: any) => step.kind === "signature"
  );

  if (!signatureStep) {
    throw new Error("No signature step found in quote response");
  }

  const requestId = signatureStep.requestId;
  const permitData = signatureStep.items[0].data;

  // Sign using Turnkey
  const signature = await signPermitWithTurnkey(
    turnkeyClient, 
    permitData, 
    userAddress
  );

  // Step 3: Execute Permit
  const executeRequest = {
    signature: signature,
    kind: "PERMIT", // Typically "PERMIT" for EIP-2612, adjust if needed
    requestId: requestId,
    api: "relay",
  };

  const executeResponse = await fetch('http://your-server:8000/bridge/execute/permits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(executeRequest),
  });

  const executeData = await executeResponse.json();
  const result = JSON.parse(executeData); // Response is a JSON string

  return result;
}

// Helper function for Turnkey signing
async function signPermitWithTurnkey(
  turnkeyClient: TurnkeyClient,
  permitData: any,
  userAddress: string
): Promise<string> {
  // The permitData from Relay.link should already be in EIP-712 format
  // It typically contains: domain, types, and message
  
  // Verify the structure
  if (!permitData.domain || !permitData.types || !permitData.message) {
    throw new Error("Invalid permit data structure");
  }

  // Ensure chainId is set correctly (Base = 8453)
  const domain = {
    ...permitData.domain,
    chainId: permitData.domain.chainId || 8453,
  };

  // Sign using Turnkey's signTypedData
  // Note: Adjust parameters based on your Turnkey SDK version and setup
  const signature = await turnkeyClient.signTypedData({
    domain: domain,
    types: permitData.types,
    message: permitData.message,
    // Additional Turnkey parameters (adjust based on your setup):
    // walletId: "...",
    // organizationId: "...",
    // keyId: "...",
  });

  // Ensure signature is in the correct format (0x + 130 hex chars)
  if (!signature.startsWith('0x')) {
    return `0x${signature}`;
  }

  return signature;
}
```

---

## Chain IDs

- **Base**: `8453`
- **Arbitrum**: `42161`
- **Local/Test**: `1337`

---

## Error Handling

Both endpoints may return errors. Handle them appropriately:

```typescript
try {
  const response = await fetch('/bridge/quote', { ... });
  
  if (!response.ok) {
    const error = await response.json();
    // Handle error
    throw new Error(error.message || 'Quote request failed');
  }
  
  // Process response
} catch (error) {
  // Handle network or parsing errors
  console.error('Bridge error:', error);
}
```

---

## Important Notes

1. **Response Format**: Both endpoints return JSON strings, not JSON objects. You need to parse them:
   ```typescript
   const response = await fetch(...);
   const jsonString = await response.json(); // This is a string
   const data = JSON.parse(jsonString); // Parse to get the object
   ```

2. **Permit Structure**: The permit data is found in `steps[]` array where `kind === "signature"`. The data structure follows EIP-712 format with `domain`, `types`, and `message` fields. Inspect the actual quote response to verify the exact structure.

3. **Turnkey Integration**: The signing process with Turnkey depends on your specific Turnkey client setup. Ensure you're using the correct signing method (EIP-712, EIP-2612, etc.).

4. **Network**: Make sure you're connected to the Base network (chainId: 8453) when signing permits.

5. **Token Addresses**: Use the correct token contract addresses for Base and Arbitrum:
   - Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - Arbitrum USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`

6. **Amount Format**: The `amount` field should be in the smallest unit (wei for ETH, smallest decimals for tokens like USDC which has 6 decimals).

---

## Testing

1. Start with small amounts for testing
2. Verify the quote response structure matches expectations:
   - Check that `steps` array contains a step with `kind: "signature"`
   - Verify the `requestId` is present in the signature step
   - Inspect the permit data structure in `steps[].items[].data`
3. Test the signing flow with Turnkey before executing:
   - Verify the signature format (should be 65 bytes: 0x + 130 hex chars)
   - Ensure the signature is valid for the permit data
4. Monitor transaction status on both Base and Arbitrum explorers
5. Use the `check.endpoint` from step items to verify completion status

---

## Support

For issues or questions:
- Check Relay.link documentation: https://docs.relay.link
- Relay.link API reference: https://docs.relay.link/llms.txt
- Verify your Turnkey client configuration
- Review server logs for backend errors

## Additional Resources

- **Relay.link Mainnet API**: `https://api.relay.link`
- **Relay.link Testnet API**: `https://api.testnets.relay.link`
- **Base Chain ID**: `8453`
- **Arbitrum Chain ID**: `42161`
- **Common Token Addresses**:
  - Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
  - Arbitrum USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (6 decimals)
