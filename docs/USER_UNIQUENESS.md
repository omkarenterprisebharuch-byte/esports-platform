# User Profile Uniqueness Enforcement

> Last Updated: January 11, 2026

## Overview

This document describes the implementation of strict uniqueness enforcement for user profile fields in the esports platform database.

## Uniqueness Constraints

The following fields are enforced to be unique across all users:

| Field | Storage | Constraint Type |
|-------|---------|-----------------|
| `username` | VARCHAR(50) | UNIQUE (case-insensitive via existing constraint) |
| `email` | VARCHAR(255) | UNIQUE (case-insensitive via existing constraint) |
| `phone_number` | VARCHAR(20), encrypted | Partial unique index (non-null values only) |
| `in_game_ids` | JSONB `{"game_type": "game_id"}` | Trigger-based uniqueness per game_type+game_id pair |

## Data Model

### Users Table (existing)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(20),  -- Encrypted, partial unique index
    in_game_ids JSONB DEFAULT '{}',  -- {"pubg": "player123", "freefire": "ff456"}
    -- ... other fields
);
```

### Game IDs Tracking Table (new)

```sql
CREATE TABLE user_game_ids (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    game_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_type, game_id)  -- Each game_id unique per game_type
);
```

## Cleanup Process

### Running the Cleanup Script

Before adding uniqueness constraints, run the cleanup script to remove duplicates:

```bash
# Preview changes (dry run)
npx tsx scripts/enforce-user-uniqueness.ts

# Apply changes
npx tsx scripts/enforce-user-uniqueness.ts --live
```

### Retention Rule

**Keep the most recent record** (by `created_at`), delete older duplicates.

### What Gets Cleaned

1. **Duplicate usernames**: Older accounts with same username (case-insensitive) are deleted
2. **Duplicate emails**: Older accounts with same email (case-insensitive) are deleted
3. **Duplicate phone numbers**: Older accounts with same phone number are deleted
4. **Duplicate game_ids**: Game ID is removed from older users' `in_game_ids` JSONB (users not deleted)

### Safety Features

- **Transaction-based**: All changes are wrapped in a transaction with rollback on error
- **Foreign key check**: Users with tournament registrations, teams, or wallet transactions are skipped
- **Detailed reporting**: Script outputs exactly what will be/was changed
- **Dry run mode**: Preview all changes before applying

### Foreign Key Dependencies

The script checks for dependencies before deleting any user:

- `tournament_registrations` - tournament sign-ups
- `teams` (captain) - team ownership
- `team_members` - team membership
- `tournaments` (host) - tournament hosting
- `wallet_transactions` - financial history

If a duplicate user has any of these dependencies, they are **not deleted** and flagged for manual review.

## Adding Constraints

After cleanup, run the migration to add database-level constraints:

```bash
npx tsx scripts/run-migration.ts add_user_uniqueness_constraints.sql
```

### What the Migration Creates

1. **Partial unique index on phone_number**
   - Only enforces uniqueness for non-null, non-empty values
   - Allows multiple users to have NULL phone numbers

2. **Game IDs tracking table**
   - Mirrors `in_game_ids` JSONB for efficient uniqueness checking
   - Has `UNIQUE(game_type, game_id)` constraint

3. **Trigger function**
   - Automatically syncs `user_game_ids` table when `in_game_ids` is modified
   - Raises error if game_id is already in use by another user

## API Error Handling

The following error codes are returned when uniqueness constraints are violated:

| Error Code | HTTP Status | Message |
|------------|-------------|---------|
| `USER_2002` | 409 | "This email is already registered" |
| `USER_2003` | 409 | "This username is already taken" |
| `USER_2007` | 409 | "This phone number is already registered to another account" |
| `USER_2008` | 409 | "This game ID is already in use by another player" |

## Files Modified/Created

### New Files

- `scripts/enforce-user-uniqueness.ts` - Cleanup script
- `migrations/add_user_uniqueness_constraints.sql` - Database migration
- `docs/USER_UNIQUENESS.md` - This documentation

### Modified Files

- `src/app/api/users/profile/route.ts` - Enhanced error handling for constraint violations
- `src/app/api/auth/verify-otp/route.ts` - Enhanced error handling for registration
- `src/lib/error-codes.ts` - Added USER_2007 and USER_2008 error codes
- `docs/ERROR_CODES.txt` - Updated error codes documentation

## Verification Queries

After running cleanup and migration, verify with these queries:

```sql
-- Should return 0 rows (no duplicate usernames)
SELECT LOWER(username), COUNT(*) 
FROM users 
GROUP BY LOWER(username) 
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicate emails)
SELECT LOWER(email), COUNT(*) 
FROM users 
GROUP BY LOWER(email) 
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicate phone numbers)
SELECT phone_number, COUNT(*) 
FROM users 
WHERE phone_number IS NOT NULL AND phone_number != ''
GROUP BY phone_number 
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicate game_ids)
SELECT game_type, LOWER(game_id), COUNT(*) 
FROM user_game_ids 
GROUP BY game_type, LOWER(game_id) 
HAVING COUNT(*) > 1;
```

## Rollback Plan

If issues arise after adding constraints:

```sql
-- Remove phone number unique index
DROP INDEX IF EXISTS idx_users_phone_unique;

-- Remove game_id tracking
DROP TRIGGER IF EXISTS trigger_sync_user_game_ids ON users;
DROP FUNCTION IF EXISTS sync_user_game_ids();
DROP TABLE IF EXISTS user_game_ids;
```

## Notes

- Phone numbers are encrypted before storage, so the unique index operates on encrypted values
- Game IDs in `in_game_ids` JSONB support multiple games per user (e.g., PUBG, Free Fire, CODM)
- The trigger approach for game_id uniqueness is chosen because JSONB values can't have direct unique constraints
- Cleanup script is idempotent - safe to run multiple times
