-- ============================================
-- Migration: Add Phone Number Hash Column for Uniqueness
-- ============================================
-- This migration adds a hash column for phone number uniqueness checking.
-- Since phone numbers are encrypted with random IVs, we need a deterministic
-- hash to check for duplicates.
-- ============================================

-- Add the hash column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number_hash VARCHAR(64);

-- Create unique index on the hash (partial - only non-null values)
DROP INDEX IF EXISTS idx_users_phone_hash_unique;
CREATE UNIQUE INDEX idx_users_phone_hash_unique 
ON users (phone_number_hash) 
WHERE phone_number_hash IS NOT NULL;

-- Drop the old partial unique index on encrypted phone_number if it exists
-- (it won't work with encrypted values anyway)
DROP INDEX IF EXISTS idx_users_phone_unique;

-- Note: After running this migration, you need to run the script:
-- npx tsx scripts/backfill-phone-hashes.ts
-- to populate the hash column for existing users

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration successful: phone_number_hash column added';
    RAISE NOTICE 'Run: npx tsx scripts/backfill-phone-hashes.ts to populate hashes';
END $$;
