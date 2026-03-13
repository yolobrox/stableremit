---
name: stableremit-ofi
description: Send cross-border payments via StableRemit. Create beneficiaries, request FX quotes, confirm payments, and check balances using the OFI API.
user-invocable: true
metadata: {"openclaw": {"requires": {"env": ["STABLEREMIT_OFI_API_KEY", "STABLEREMIT_OFI_BASE_URL"]}, "primaryEnv": "STABLEREMIT_OFI_API_KEY"}}
---

# StableRemit OFI — Cross-Border Payments

You are an agent that sends cross-border payments through StableRemit's OFI (Originating Financial Institution) API.

## Setup

The TypeScript SDK is bundled at `{baseDir}/stableremit-ofi-sdk.ts`. Copy it into the user's project:

```bash
cp {baseDir}/stableremit-ofi-sdk.ts ./stableremit-ofi-sdk.ts
```

Then instantiate the client:

```typescript
import { StableRemitOFI } from './stableremit-ofi-sdk';

const client = new StableRemitOFI(
  process.env.STABLEREMIT_OFI_API_KEY!,
  process.env.STABLEREMIT_OFI_BASE_URL!
);
```

## Available Operations

### 1. List Beneficiaries
Retrieve all registered beneficiaries (recipients).

```typescript
const { beneficiaries } = await client.listBeneficiaries({ limit: 50 });
```

### 2. Get Beneficiary
Fetch a single beneficiary by ID.

```typescript
const beneficiary = await client.getBeneficiary('uuid-here');
```

### 3. Create Beneficiary
Register a new payment recipient. Use an idempotency key for safety.

```typescript
const beneficiary = await client.createBeneficiary({
  name: 'Acme Mexico',
  merchant_type: 'business',
  external_id: 'your-internal-id',
  country: 'MX',
  contact_email: 'pay@acme.mx'
}, crypto.randomUUID());
```

### 4. Request a Quote
Get an FX quote for a cross-border payment. Quotes expire — confirm quickly.

```typescript
const quote = await client.requestQuote({
  beneficiary_id: 'beneficiary-uuid',
  destination_amount: 10000,
  destination_currency: 'MXN',
  payment_purpose: 'supplier_payment'
}, crypto.randomUUID());
// Returns: quote_reference, fx_rate, source_amount_usd, fees, total_debit_usd, expires_at
```

### 5. Get Quote
Retrieve a previously requested quote by reference.

```typescript
const quote = await client.getQuote('QR-20260101-XXXX');
```

### 6. Confirm Payment
Accept a quote and execute the cross-border payment. This debits the OFI's USD balance.

```typescript
const payment = await client.confirmPayment('QR-20260101-XXXX', {
  payment_purpose: 'supplier_payment'
}, crypto.randomUUID());
// Returns: payment_id, status, transaction_number
```

### 7. List Payments
View all cross-border payments with optional filters.

```typescript
const { payments } = await client.listPayments({ limit: 20, status: 'completed' });
```

### 8. Get Payment
Fetch details of a specific payment.

```typescript
const payment = await client.getPayment('payment-uuid');
```

### 9. Get Balance
Check the OFI's available USD balance.

```typescript
const balance = await client.getBalance();
// Returns: account_name, available_balance, pending_balance, currency
```

## Typical Workflow

1. **Create a beneficiary** (or list existing ones)
2. **Request a quote** with the beneficiary ID, amount, and currency
3. **Review the quote** — check `fx_rate`, `fees`, `total_debit_usd`, and `expires_at`
4. **Confirm the payment** using the `quote_reference`
5. **Monitor status** via `getPayment()` or `listPayments()`

## Error Handling

All methods throw `ApiError` with `.status` (HTTP code) and `.body` (JSON response).

```typescript
import { ApiError } from './stableremit-ofi-sdk';

try {
  await client.confirmPayment(ref);
} catch (e) {
  if (e instanceof ApiError) {
    if (e.status === 403) console.log('Missing scope:', e.body.error);
    if (e.status === 429) console.log('Rate limited, retry later');
  }
}
```

## Important Notes

- Always use **idempotency keys** on write operations (createBeneficiary, requestQuote, confirmPayment) to prevent duplicate actions.
- Quotes **expire** — check `expires_at` and confirm promptly.
- The API uses **scope-based access control**. The API key must have the required scopes (e.g., `quotes:write`, `payments:write`).
- All monetary amounts are in their respective currencies: source in USD, destination in the local currency.
