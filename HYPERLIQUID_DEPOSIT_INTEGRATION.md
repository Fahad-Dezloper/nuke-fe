# Hyperliquid Deposit Integration Documentation

## Overview

This document describes how to integrate the Hyperliquid deposit API for depositing USDC from **Arbitrum** to Hyperliquid. The integration uses **permit-based approvals** (EIP-2612) where the user signs a permit on the frontend with Turnkey, and the backend (fee payer) executes the deposit transaction on behalf of the user.

## Flow

1. **Sign Permit**: User signs an EIP-2612 permit for USDC on Arbitrum using Turnkey
2. **Submit Deposit**: Send permit signature + deposit amount to backend API
3. **Backend Execution**: Backend (fee payer) executes the transaction and returns tx hash

---

## API Endpoint

### Base URL
```
http://your-server-url:8000
```

### Endpoint
```
POST /hyperliquid/deposit
```

---

## Step 1: Sign Permit (Frontend with Turnkey)

Before calling the deposit API, you need to sign an EIP-2612 permit for USDC on Arbitrum.

### Permit Structure

The permit follows EIP-2612 standard with the following structure:

```typescript
interface PermitMessage {
  owner: string;      // User's address (0x...)
  spender: string;   // Hyperliquid deposit contract address
  value: string;      // Amount in smallest unit (USDC has 6 decimals)
  nonce: number;     // User's nonce from USDC contract
  deadline: number;  // Unix timestamp (deadline for permit validity)
}

interface PermitDomain {
  name: string;              // "USD Coin" (for USDC)
  version: string;            // "2" (for USDC)
  chainId: number;           // 42161 (Arbitrum)
  verifyingContract: string;  // USDC contract address on Arbitrum
}
```

### Get User Nonce

Before signing, you need to get the user's nonce from the USDC contract:

```typescript
// USDC contract on Arbitrum
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// Call the nonces function
const nonce = await provider.call({
  to: USDC_ADDRESS,
  data: ethers.utils.hexConcat([
    "0x7ecebe00", // nonces(address) function selector
    ethers.utils.defaultAbiCoder.encode(["address"], [userAddress])
  ])
});
```

### Sign Permit with Turnkey

```typescript
import { TurnkeyClient } from '@turnkey/sdk';

async function signUSDCPermit(
  turnkeyClient: TurnkeyClient,
  userAddress: string,
  amount: string, // Amount in smallest unit (e.g., "10000000" for 10 USDC)
  deadline: number, // Unix timestamp (e.g., Math.floor(Date.now() / 1000) + 600 for 10 min)
  depositContractAddress: string // Hyperliquid deposit contract address
): Promise<PermitSignature> {
  const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  
  // Get user's nonce
  const nonce = await getUserNonce(userAddress);
  
  // EIP-2612 permit domain
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: 42161, // Arbitrum
    verifyingContract: USDC_ADDRESS,
  };
  
  // EIP-2612 permit types
  const types = {
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
  };
  
  // Permit message
  const message = {
    owner: userAddress,
    spender: depositContractAddress,
    value: amount,
    nonce: nonce,
    deadline: deadline,
  };
  
  // Sign with Turnkey
  const signature = await turnkeyClient.signTypedData({
    domain,
    types,
    message,
    // Additional Turnkey parameters (adjust based on your setup):
    // walletId: "...",
    // organizationId: "...",
    // keyId: "...",
  });
  
  // Parse signature into v, r, s components
  // Signature format: 0x + r (32 bytes) + s (32 bytes) + v (1 byte)
  const sig = signature.slice(2); // Remove 0x
  const r = "0x" + sig.slice(0, 64);
  const s = "0x" + sig.slice(64, 128);
  const v = parseInt(sig.slice(128, 130), 16);
  
  // Convert r and s to byte arrays
  const rBytes = ethers.utils.arrayify(r);
  const sBytes = ethers.utils.arrayify(s);
  
  // Ensure r and s are 32 bytes
  if (rBytes.length !== 32 || sBytes.length !== 32) {
    throw new Error("Invalid signature format");
  }
  
  return {
    v: v,
    r: rBytes, // [u8; 32]
    s: sBytes, // [u8; 32]
    deadline: deadline.toString(), // Convert to string for U256
  };
}
```

---

## Step 2: Submit Deposit Request

### Request

**Endpoint:** `POST /hyperliquid/deposit`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```typescript
interface DepositParams {
  amount: number;              // Amount in smallest unit (6 decimals for USDC)
                              // e.g., 10000000 = 10 USDC
  user_address: string;        // User's EVM address (0x...)
  permit: PermitSignature;     // Permit signature components
}

interface PermitSignature {
  v: number;                  // Recovery id (0 or 1, typically 27 or 28)
  r: number[];                // Array of 32 bytes (signature r component)
  s: number[];                // Array of 32 bytes (signature s component)
  deadline: string;            // Deadline as string (U256 format)
}
```

**Example Request:**
```json
{
  "amount": 10000000,
  "user_address": "0x03508bb71268bba25ecacc8f620e01866650532c",
  "permit": {
    "v": 27,
    "r": [123, 45, 67, ...],  // 32 bytes array
    "s": [234, 56, 78, ...],  // 32 bytes array
    "deadline": "1735689600"
  }
}
```

### Response

**Status:** `200 OK`

**Response Body:**
```json
"0x1234567890abcdef..." // Transaction hash string
```

**Status:** `400 Bad Request` (various error cases)

**Error Response:**
```json
{
  "error": "BelowMinimumDeposit",
  "message": "Deposit amount 5000000 is below minimum 10000000 USDC"
}
```

Possible errors:
- `BelowMinimumDeposit`: Amount is less than 10 USDC (10,000,000 in smallest unit)
- `InsufficientBalance`: User doesn't have enough USDC balance
- `SimulationFailed`: Transaction simulation failed
- `ContractError`: Contract call error
- `InvalidAddress`: Invalid address format
- `SignerError`: Fee payer signing error

---

## Complete Integration Example

```typescript
import { TurnkeyClient } from '@turnkey/sdk';
import { ethers } from 'ethers';

// Constants
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ARBITRUM_CHAIN_ID = 42161;
const MIN_DEPOSIT = 10_000_000; // 10 USDC (6 decimals)

async function depositToHyperliquid(
  turnkeyClient: TurnkeyClient,
  userAddress: string,
  amountUSDC: number, // Amount in USDC (e.g., 10.5)
  depositContractAddress: string,
  apiBaseUrl: string
): Promise<string> {
  // Step 1: Convert amount to smallest unit
  const amount = Math.floor(amountUSDC * 1_000_000); // USDC has 6 decimals
  
  // Validate minimum deposit
  if (amount < MIN_DEPOSIT) {
    throw new Error(`Minimum deposit is ${MIN_DEPOSIT / 1_000_000} USDC`);
  }
  
  // Step 2: Get user's nonce
  const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC_URL);
  const usdcContract = new ethers.Contract(
    USDC_ADDRESS,
    [
      "function nonces(address owner) view returns (uint256)",
      "function name() view returns (string)",
      "function version() view returns (string)",
    ],
    provider
  );
  
  const nonce = await usdcContract.nonces(userAddress);
  
  // Step 3: Set deadline (10 minutes from now)
  const deadline = Math.floor(Date.now() / 1000) + 600;
  
  // Step 4: Sign permit
  const permit = await signUSDCPermit(
    turnkeyClient,
    userAddress,
    amount.toString(),
    deadline,
    depositContractAddress
  );
  
  // Step 5: Prepare request body
  const depositParams = {
    amount: amount,
    user_address: userAddress,
    permit: {
      v: permit.v,
      r: Array.from(permit.r), // Convert Uint8Array to number array
      s: Array.from(permit.s), // Convert Uint8Array to number array
      deadline: permit.deadline.toString(),
    },
  };
  
  // Step 6: Submit deposit request
  const response = await fetch(`${apiBaseUrl}/hyperliquid/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(depositParams),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Deposit failed');
  }
  
  const txHash = await response.json();
  return txHash;
}

// Helper function to sign permit
async function signUSDCPermit(
  turnkeyClient: TurnkeyClient,
  userAddress: string,
  amount: string,
  deadline: number,
  depositContractAddress: string
): Promise<{ v: number; r: Uint8Array; s: Uint8Array; deadline: number }> {
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: ARBITRUM_CHAIN_ID,
    verifyingContract: USDC_ADDRESS,
  };
  
  const types = {
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
  };
  
  const message = {
    owner: userAddress,
    spender: depositContractAddress,
    value: amount,
    nonce: 0, // You need to fetch this from the contract
    deadline: deadline,
  };
  
  const signature = await turnkeyClient.signTypedData({
    domain,
    types,
    message,
  });
  
  // Parse signature
  const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
  const r = ethers.utils.arrayify("0x" + sig.slice(0, 64));
  const s = ethers.utils.arrayify("0x" + sig.slice(64, 128));
  const v = parseInt(sig.slice(128, 130), 16);
  
  return {
    v: v,
    r: r,
    s: s,
    deadline: deadline,
  };
}
```

---

## Backend Processing Flow

When the backend receives the deposit request, it:

1. **Validates minimum deposit**: Checks if amount >= 10 USDC (10,000,000)
2. **Checks user balance**: Verifies user has sufficient USDC on Arbitrum
3. **Simulates transaction**: Calls the contract to simulate the deposit
4. **Executes transaction**: Fee payer submits the transaction to Arbitrum
5. **Returns tx hash**: Returns the transaction hash for tracking

The backend uses a fee payer wallet to execute the transaction, so the user doesn't pay gas fees.

---

## Important Notes

1. **Minimum Deposit**: Minimum deposit is **10 USDC** (10,000,000 in smallest unit with 6 decimals)

2. **Amount Format**: 
   - Amount must be in smallest unit (6 decimals for USDC)
   - Example: 10 USDC = `10000000`
   - Example: 10.5 USDC = `10500000`

3. **Permit Signature Format**:
   - `v`: Recovery id (0 or 1, typically 27 or 28)
   - `r`: 32-byte array (signature r component)
   - `s`: 32-byte array (signature s component)
   - `deadline`: Unix timestamp as string

4. **Network**: Must be on **Arbitrum** (chainId: 42161)

5. **Token Address**: 
   - Arbitrum USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`

6. **Nonce**: You must fetch the user's current nonce from the USDC contract before signing

7. **Deadline**: Set a reasonable deadline (e.g., 10 minutes from now). The permit expires after the deadline.

8. **Deposit Contract**: You need the Hyperliquid deposit contract address. Currently set to `0x0000000000000000000000000000000000000000` in the code (needs to be updated).

---

## Error Handling

```typescript
try {
  const txHash = await depositToHyperliquid(
    turnkeyClient,
    userAddress,
    10.5, // 10.5 USDC
    depositContractAddress,
    apiBaseUrl
  );
  
  console.log("Deposit successful! Tx hash:", txHash);
  
  // Monitor transaction status
  const receipt = await provider.waitForTransaction(txHash);
  console.log("Transaction confirmed:", receipt);
  
} catch (error) {
  if (error.message.includes("BelowMinimumDeposit")) {
    console.error("Amount too small. Minimum is 10 USDC");
  } else if (error.message.includes("InsufficientBalance")) {
    console.error("Insufficient USDC balance");
  } else {
    console.error("Deposit failed:", error.message);
  }
}
```

---

## Testing

1. **Test with minimum amount**: Start with exactly 10 USDC (10,000,000)
2. **Verify permit signature**: Ensure the permit is signed correctly before submitting
3. **Check user balance**: Verify user has sufficient USDC on Arbitrum
4. **Monitor transaction**: Track the transaction hash on Arbitrum explorer
5. **Test error cases**: Test with insufficient balance, below minimum, etc.

---

## Differences from Bridge Flow

| Aspect | Bridge Flow | Hyperliquid Deposit |
|--------|-------------|---------------------|
| **Purpose** | Bridge tokens between chains | Deposit to Hyperliquid |
| **Execution** | Backend submits to Relay.link API | Backend executes directly on Arbitrum |
| **Permit Format** | EIP-712 from Relay.link | EIP-2612 standard USDC permit |
| **Signature Submission** | Submit to `/bridge/execute/permits` | Submit to `/hyperliquid/deposit` |
| **Fee Payment** | User pays (or gasless via permit) | Backend fee payer covers gas |

---

## Support

For issues or questions:
- Verify your Turnkey client configuration
- Check Arbitrum network connectivity
- Review server logs for backend errors
- Ensure deposit contract address is correctly configured
