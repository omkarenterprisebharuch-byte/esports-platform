# Balance On Hold System

## Overview

The Balance On Hold system allows the platform to temporarily lock funds in a user's wallet for pending operations like waitlist registrations. This ensures that users have sufficient funds when they join a waitlist, without immediately deducting the entry fee.

## How It Works

### Workflow

1. **User joins waitlist**: Entry fee is **held** (not deducted)
2. **User is promoted from waitlist**: Held amount is **confirmed** (deducted from wallet)
3. **User cancels waitlist registration**: Held amount is **released** (returned to available balance)

### Balance Types

| Balance Type | Description |
|-------------|-------------|
| `wallet_balance` | Total balance in the wallet |
| `hold_balance` | Amount currently on hold |
| `available_balance` | Wallet balance minus hold balance (usable amount) |

### Example

```
Initial State:
- wallet_balance: ₹500
- hold_balance: ₹0
- available_balance: ₹500

After joining waitlist (entry fee ₹100):
- wallet_balance: ₹500 (unchanged)
- hold_balance: ₹100
- available_balance: ₹400

Scenario A - Promoted to tournament:
- Entry fee is deducted
- wallet_balance: ₹400
- hold_balance: ₹0
- available_balance: ₹400

Scenario B - Cancelled waitlist registration:
- Hold is released
- wallet_balance: ₹500
- hold_balance: ₹0
- available_balance: ₹500
```

## Database Schema

### balance_holds Table

```sql
CREATE TABLE balance_holds (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    hold_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    reference_type VARCHAR(30),
    reference_id VARCHAR(100),
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    transaction_id INTEGER REFERENCES wallet_transactions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Hold Types

| Type | Description |
|------|-------------|
| `waitlist_entry_fee` | Entry fee held for waitlist registration |
| `pending_withdrawal` | Balance held for pending withdrawal request |
| `dispute` | Balance held due to a dispute |

### Hold Statuses

| Status | Description |
|--------|-------------|
| `active` | Hold is active, amount is locked |
| `released` | Hold was released, amount returned to available balance |
| `confirmed` | Hold was confirmed, amount deducted from wallet |
| `expired` | Hold expired automatically, amount returned |

## API Endpoints

### GET /api/wallet/balance

Returns balance summary including holds.

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 500,
    "hold_balance": 100,
    "available_balance": 400,
    "active_holds": 1,
    "holds": [
      {
        "id": 1,
        "amount": 100,
        "type": "waitlist_entry_fee",
        "description": "Entry fee hold for waitlist: Tournament Name",
        "created_at": "2026-01-01T10:00:00Z",
        "expires_at": null
      }
    ],
    "pendingRequests": { "incoming": 0, "outgoing": 0 }
  }
}
```

### GET /api/wallet/holds

Returns paginated list of all holds.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status (optional)

### GET /api/wallet/holds/[id]

Returns details of a specific hold.

### DELETE /api/wallet/holds/[id] (Admin only)

Manually release a hold. Requires admin/owner role.

**Request Body:**
```json
{
  "reason": "Tournament cancelled by host"
}
```

## Library Functions

### Core Functions

```typescript
// Create a balance hold
await holdBalance(
  userId,
  amount,
  holdType,
  referenceType,
  referenceId,
  description,
  expiresAt? // optional expiry
);

// Release a hold (return funds to available)
await releaseHold(holdId, reason);
await releaseHoldByReference(referenceType, referenceId, reason);

// Confirm a hold (deduct from wallet)
await confirmHold(holdId, transactionType, description);
await confirmHoldByReference(referenceType, referenceId, transactionType, description);

// Get balance info
await getBalanceSummary(userId);
await getAvailableBalance(userId);
await getHoldBalance(userId);

// Get holds
await getUserActiveHolds(userId);
await getUserHolds(userId, status, page, limit);
await getHoldByReference(referenceType, referenceId);

// Expire old holds (run via cron)
await expireHolds();
```

## Scripts

### Fix Wallet Balances
```bash
npx ts-node scripts/fix-wallet-balances.ts [userId]
```
Recalculates wallet and hold balances based on transaction and hold history.

### Expire Holds
```bash
npx ts-node scripts/expire-holds.ts
```
Expires holds that have passed their expiry time. Should be run periodically via cron.

## Error Codes

| Code | Message |
|------|---------|
| PAY_6101 | Insufficient available balance |
| PAY_6102 | Balance hold not found |
| PAY_6103 | Balance hold already processed |
| PAY_6104 | Failed to hold balance |
| PAY_6105 | Failed to release balance hold |
| PAY_6106 | Failed to confirm balance hold |
| PAY_6107 | Balance hold has expired |

## Migration

Run the migration to create the balance_holds table and add hold_balance column:

```bash
npx ts-node scripts/run-migration.ts create_balance_holds.sql
```
