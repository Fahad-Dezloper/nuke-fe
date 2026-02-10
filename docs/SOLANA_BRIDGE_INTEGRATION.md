# Solana Bridge Integration Documentation

## Overview

This document describes how to integrate the Bridge API for transferring tokens from **Base** to **Solana** using the Relay.link bridge service with permit-based approvals. The integration uses Turnkey client on the frontend for signing EIP-3009 TransferWithAuthorization signatures.

## Flow

1. **Get Quote**: Call the quote API with bridge parameters (set `usePermit: true`)
2. **Sign TransferWithAuthorization**: Sign the EIP-3009 authorization data returned from the quote using Turnkey
3. **Execute Permit**: Submit the signed authorization to execute the bridge transaction

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
  destinationChainId: number;      // 792703809 for Solana, 42161 for Arbitrum
  amount: string;                   // Amount to bridge (in smallest unit)
  tradeType: string;                // "EXACT_INPUT" | "EXACT_OUTPUT" | "EXPECTED_OUTPUT"
  
  // Required for permit flow
  usePermit: boolean;                // Must be true for permit-based flow
  recipient: string;                 // Recipient address (Solana base58 or EVM 0x...)
}
```

**Note:** The following fields are automatically set by the backend:
- `originChainId`: Always **Base** (8453) - bridging only available from Base
- `originCurrency`: Base USDC address (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- `destinationCurrency`: Automatically derived from `destinationChainId`:
  - Solana (792703809): `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
  - Arbitrum (42161): `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`

**Example Request:**
```json
{
  "user": "0x03508bb71268bba25ecacc8f620e01866650532c",
  "destinationChainId": 792703809,
  "amount": "100000000",
  "tradeType": "EXACT_INPUT",
  "usePermit": true,
  "recipient": "9bS7eeCArHd5cyL43cd2KrrFfxmRjGS3sBXzi6PK78V8"
}
```

### Response

**Status:** `200 OK`

**Response Body:**
The response is a JSON string containing the quote data from Relay.link. The main structure includes:

- `steps`: Array of steps that need to be executed (signatures)
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
  id: string;              // "authorize1" for Solana
  action: string;          // User-facing action text
  description: string;      // Description of the step
  kind: "signature";       // Always "signature" for permit flow
  requestId: string;       // Unique identifier for this request
  items: StepItem[];       // Array of items to execute
}

interface StepItem {
  status: "complete" | "incomplete";
  data: {
    sign: {
      signatureKind: "eip712";
      types: {
        TransferWithAuthorization: Array<{name: string; type: string}>;
      };
      domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: string;
      };
      primaryType: "TransferWithAuthorization";
      value: {
        from: string;
        to: string;
        value: string;
        validAfter: number;
        validBefore: number;
        nonce: string; // bytes32 hex string
      };
    };
    post: {
      endpoint: string;
      method: string;
      body: {
        kind: "eip3009";
        requestId: string;
        api: "swap";
      };
    };
  };
  check?: {
    endpoint: string;
    method: string;
  };
}
```

**Example Response:**
```json
{
  "steps": [
    {
      "id": "authorize1",
      "action": "Sign authorization",
      "description": "Sign to approve swap of USDC for USDC",
      "kind": "signature",
      "requestId": "0x1355c01f322e4c5304dae26f2a865b79f6ca42cfea5c0d7525dc91a3dfb19e12",
      "items": [
        {
          "status": "incomplete",
          "data": {
            "sign": {
              "signatureKind": "eip712",
              "types": {
                "TransferWithAuthorization": [
                  { "name": "from", "type": "address" },
                  { "name": "to", "type": "address" },
                  { "name": "value", "type": "uint256" },
                  { "name": "validAfter", "type": "uint256" },
                  { "name": "validBefore", "type": "uint256" },
                  { "name": "nonce", "type": "bytes32" }
                ]
              },
              "domain": {
                "name": "USD Coin",
                "version": "2",
                "chainId": 8453,
                "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
              },
              "primaryType": "TransferWithAuthorization",
              "value": {
                "from": "0x03508bb71268bba25ecacc8f620e01866650532c",
                "to": "0xf70da97812cb96acdf810712aa562db8dfa3dbef",
                "value": "100000000",
                "validAfter": 0,
                "validBefore": 1770114518,
                "nonce": "0x6444c7c1315f1b38de9449f710ad8ca23fea8c5ff3a5af048035f3035b77cbe6"
              }
            },
            "post": {
              "endpoint": "/execute/permits",
              "method": "POST",
              "body": {
                "kind": "eip3009",
                "requestId": "0x1355c01f322e4c5304dae26f2a865b79f6ca42cfea5c0d7525dc91a3dfb19e12",
                "api": "swap"
              }
            }
          },
          "check": {
            "endpoint": "/intents/status/v3?requestId=0x1355c01f322e4c5304dae26f2a865b79f6ca42cfea5c0d7525dc91a3dfb19e12",
            "method": "GET"
          }
        }
      ]
    }
  ],
  "fees": { /* fee information */ },
  "details": { /* operation details */ }
}
```

**Important Notes:**
- The signature data is nested in `steps[].items[].data.sign` (not directly in `data`)
- The `post.body` object shows the exact parameters needed for execution
- The `requestId` is found in the step object
- The signature uses EIP-3009 `TransferWithAuthorization` standard

---

## Step 2: Sign TransferWithAuthorization (Frontend with Turnkey)

After receiving the quote response, you need to find the signature step and sign the EIP-3009 TransferWithAuthorization data using Turnkey client.

### Extract Signature Data

From the quote response, you need to:
1. Find the step with `kind: "signature"` (typically with `id: "authorize1"`)
2. Extract the `requestId` from that step
3. Extract the signature data from `items[0].data.sign` (note: nested in `sign`)

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

// Extract requestId and signature data (nested in 'sign')
const requestId = signatureStep.requestId;
const signData = signatureStep.items[0].data.sign;

// The signData contains:
// - domain: EIP-712 domain
// - types: TransferWithAuthorization type definition
// - primaryType: "TransferWithAuthorization"
// - value: The message to sign (from, to, value, validAfter, validBefore, nonce)
```

### Sign with Turnkey

The signature data uses **EIP-3009 TransferWithAuthorization** format, which is an EIP-712 typed data signature. You'll need to sign this using Turnkey's signing capabilities.

**Important:** Unlike EIP-2612 Permit, EIP-3009 uses:
- `TransferWithAuthorization` as the primary type
- `value` field (not `message`) for the message data
- `from` and `to` fields (not `owner` and `spender`)
- `validAfter` and `validBefore` fields (not `deadline`)

**Example:**
```typescript
import { TurnkeyClient } from '@turnkey/sdk';

// Extract signature data (from above)
const signData = signatureStep.items[0].data.sign;

// Sign using Turnkey's signTypedData method
const signature = await turnkeyClient.signTypedData({
  domain: signData.domain,
  types: {
    TransferWithAuthorization: signData.types.TransferWithAuthorization,
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
  },
  primaryType: "TransferWithAuthorization", // Explicitly required
  message: signData.value, // Note: it's 'value' not 'message'
  // Additional Turnkey-specific parameters
  // (e.g., walletId, organizationId, etc.)
});

// The signature should be in hex format (0x...)
// Format: r + s + v (65 bytes total, 130 hex characters + 0x prefix)
```

**Important:** 
- The signature format must match what Relay.link expects (EIP-712 typed data signature)
- Ensure you're signing on the correct chain (Base, chainId: 8453)
- The signer address must match the `user` address from the quote request
- The signature should be in the format: `0x` + `r` (32 bytes) + `s` (32 bytes) + `v` (1 byte) = 65 bytes total
- **Must explicitly set `primaryType: "TransferWithAuthorization"`**
- **Use `signData.value` for the message, not `signData.message`**

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
  kind: string;           // Must be "eip3009" for Solana bridge
  requestId: string;      // The requestId from the signature step in quote response
  api?: string;           // Optional: "swap" for Solana bridge, "bridge" for others
}
```

**Example Request:**
```json
{
  "signature": "0x1234567890abcdef...",
  "kind": "eip3009",
  "requestId": "0x1355c01f322e4c5304dae26f2a865b79f6ca42cfea5c0d7525dc91a3dfb19e12",
  "api": "swap"
}
```

**How the Backend Forwards to Relay API:**

The backend sends to Relay.link using a hybrid format:
- `signature` → **Query parameter**
- `kind`, `requestId`, `api` → **JSON body**

```
POST https://api.relay.link/execute/permits?signature=0x1234567890abcdef...
Content-Type: application/json

{
  "kind": "eip3009",
  "requestId": "0x1355c01f322e4c5304dae26f2a865b79f6ca42cfea5c0d7525dc91a3dfb19e12",
  "api": "swap"
}
```

**Important Notes:**
- The `kind` must be `"eip3009"` (lowercase, exact format) - NOT `"PERMIT"` or `"PERMIT2"`
- The `api` is optional but recommended: use `"swap"` for Solana bridge
- The `requestId` should be extracted from the signature step's `requestId` field
- The `signature` must be the full 65-byte signature (0x + 130 hex characters)
- You can find these exact values in `steps[].items[].data.post.body` from the quote response

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
import { TurnkeyClient } from '@turnkey/sdk';

async function bridgeBaseToSolana(
  userAddress: string,
  amount: string,
  solanaRecipient: string,
  turnkeyClient: TurnkeyClient
) {
  // Step 1: Get Quote (simplified - backend auto-fills origin chain/currency)
  const quoteRequest = {
    user: userAddress,
    destinationChainId: 792703809, // Solana
    amount: amount,
    tradeType: "EXACT_INPUT",
    usePermit: true, // Required for permit flow
    recipient: solanaRecipient,
  };

  const quoteResponse = await fetch('http://your-server:8000/bridge/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(quoteRequest),
  });

  if (!quoteResponse.ok) {
    const error = await quoteResponse.json();
    throw new Error(error.message || 'Quote request failed');
  }

  const quoteData = await quoteResponse.json();
  const quote = JSON.parse(quoteData); // Response is a JSON string

  // Step 2: Find signature step
  const signatureStep = quote.steps.find(
    (step: any) => step.kind === "signature"
  );

  if (!signatureStep) {
    throw new Error("No signature step found in quote response");
  }

  // Extract signature data (nested in data.sign)
  const signData = signatureStep.items[0].data.sign;
  const requestId = signatureStep.requestId;

  // Step 3: Sign EIP-3009 TransferWithAuthorization
  const signature = await signTransferWithAuthorization(
    turnkeyClient,
    signData,
    userAddress
  );

  // Step 4: Execute permit
  // Note: Use values from post.body if available, or construct manually
  const executeRequest = {
    signature: signature,
    kind: "eip3009", // Important: lowercase "eip3009"
    requestId: requestId,
    api: "swap", // Optional but recommended for Solana bridge
  };

  const executeResponse = await fetch('http://your-server:8000/bridge/execute/permits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(executeRequest),
  });

  if (!executeResponse.ok) {
    const error = await executeResponse.json();
    throw new Error(error.message || 'Execute permit failed');
  }

  const executeData = await executeResponse.json();
  const result = JSON.parse(executeData); // Response is a JSON string

  return result;
}

// Helper function for signing TransferWithAuthorization
async function signTransferWithAuthorization(
  turnkeyClient: TurnkeyClient,
  signData: any,
  userAddress: string
): Promise<string> {
  // Verify the structure
  if (!signData.domain || !signData.types || !signData.value) {
    throw new Error("Invalid signature data structure");
  }

  // Ensure chainId is set correctly (Base = 8453)
  const domain = {
    ...signData.domain,
    chainId: signData.domain.chainId || 8453,
  };

  // Sign using Turnkey's signTypedData
  // Note: Adjust parameters based on your Turnkey SDK version and setup
  const signature = await turnkeyClient.signTypedData({
    domain: domain,
    types: {
      TransferWithAuthorization: signData.types.TransferWithAuthorization,
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
    },
    primaryType: "TransferWithAuthorization", // Explicitly required
    message: signData.value, // Note: 'value' not 'message'
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
- **Solana**: `792703809`

---

## Token Addresses

- **Base USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
- **Solana USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (6 decimals)

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

1. **Simplified Quote Request**: The quote API has been simplified:
   - You only need to provide: `user`, `destinationChainId`, `amount`, `tradeType`, `usePermit`, `recipient`
   - The backend automatically sets `originChainId` (Base), `originCurrency` (Base USDC), and `destinationCurrency` (based on destination chain)
   - Bridging is currently only available **from Base**

2. **Response Format**: Both endpoints return JSON strings, not JSON objects. You need to parse them:
   ```typescript
   const response = await fetch(...);
   const jsonString = await response.json(); // This is a string
   const data = JSON.parse(jsonString); // Parse to get the object
   ```

3. **Signature Data Location**: The signature data is nested in `steps[].items[].data.sign` (not directly in `data`). This is different from Base → Arbitrum flow.

4. **EIP-3009 Format**: The signature uses EIP-3009 `TransferWithAuthorization` standard, which is different from EIP-2612 `Permit`:
   - Uses `TransferWithAuthorization` as primary type
   - Message fields: `from`, `to`, `value`, `validAfter`, `validBefore`, `nonce`
   - Uses `value` field for message data (not `message`)

5. **Execute Permits API Format**: 
   - `kind` must be `"eip3009"` (lowercase, exact format)
   - `api` is optional but recommended: use `"swap"` for Solana bridge
   - These values are shown in `steps[].items[].data.post.body` from the quote response
   - Backend sends signature as query param and rest as JSON body to Relay API

6. **Turnkey Integration**: The signing process with Turnkey requires:
   - Explicitly setting `primaryType: "TransferWithAuthorization"`
   - Using `signData.value` for the message (not `signData.message`)
   - Including `EIP712Domain` in the types

7. **Network**: Make sure you're connected to the Base network (chainId: 8453) when signing.

8. **Amount Format**: The `amount` field should be in the smallest unit (6 decimals for USDC, so 100 USDC = `"100000000"`).

9. **Recipient Format**: The `recipient` field should be a Solana address in base58 format (e.g., `"9bS7eeCArHd5cyL43cd2KrrFfxmRjGS3sBXzi6PK78V8"`).

10. **Supported Destination Chains**:
    - Solana: `792703809`
    - Arbitrum: `42161`

---

## Testing

1. Start with small amounts for testing
2. Verify the simplified quote request works:
   - Only send: `user`, `destinationChainId`, `amount`, `tradeType`, `usePermit`, `recipient`
   - Do NOT send `originChainId`, `originCurrency`, or `destinationCurrency` (auto-filled by backend)
3. Verify the quote response structure matches expectations:
   - Check that `steps` array contains a step with `kind: "signature"`
   - Verify the signature data is in `steps[].items[].data.sign` (nested)
   - Check that `post.body` contains `kind: "eip3009"` and optionally `api: "swap"`
4. Test the signing flow with Turnkey before executing:
   - Verify the signature format (should be 65 bytes: 0x + 130 hex chars)
   - Ensure `primaryType` is set correctly
   - Ensure you're using `signData.value` not `signData.message`
5. Monitor transaction status on Base explorer and Solana explorer
6. Use the `check.endpoint` from step items to verify completion status

---

## Differences from Base → Arbitrum Flow

| Aspect | Base → Solana | Base → Arbitrum |
|--------|---------------|-----------------|
| **Destination Chain ID** | `792703809` | `42161` |
| **Signature Standard** | EIP-3009 TransferWithAuthorization | EIP-2612 Permit |
| **Data Location** | `steps[].items[].data.sign` | `steps[].items[].data` |
| **Primary Type** | `TransferWithAuthorization` | `Permit` |
| **Message Field** | `value` | `message` |
| **Message Fields** | `from`, `to`, `value`, `validAfter`, `validBefore`, `nonce` | `owner`, `spender`, `value`, `nonce`, `deadline` |
| **Execute `kind`** | `"eip3009"` | `"PERMIT"` or `"PERMIT2"` |
| **Execute `api`** | `"swap"` (optional) | `"bridge"` (optional) |
| **Recipient Format** | Solana base58 address | EVM 0x address |

---

## Support

For issues or questions:
- Check Relay.link documentation: https://docs.relay.link
- Relay.link API reference: https://docs.relay.link/llms.txt
- Verify your Turnkey client configuration
- Review server logs for backend errors

---

## Additional Resources

- **Relay.link Mainnet API**: `https://api.relay.link`
- **Relay.link Testnet API**: `https://api.testnets.relay.link`

### Supported Chains

| Chain | Chain ID | USDC Address |
|-------|----------|--------------|
| **Base** (origin only) | `8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **Solana** (destination) | `792703809` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| **Arbitrum** (destination) | `42161` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |

All USDC tokens use 6 decimals.
