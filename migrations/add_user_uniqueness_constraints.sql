-- ============================================
-- Migration: Add Uniqueness Constraints to Users Table
-- ============================================
-- Prerequisites: Run enforce-user-uniqueness.ts script first to clean duplicates
-- 
-- This migration adds:
-- 1. Case-insensitive unique constraint on phone_number (if not null)
-- 2. Unique index for game_ids validation (composite approach)
-- 3. Function and trigger to enforce game_id uniqueness across users
-- ============================================

-- ============================================
-- 1. Phone Number Unique Constraint
-- ============================================
-- Note: username and email already have UNIQUE constraints from initial schema

-- Add unique constraint on phone_number (partial - only non-null values)
-- First, drop if exists to make migration idempotent
DROP INDEX IF EXISTS idx_users_phone_unique;

-- Create partial unique index (allows multiple NULLs, enforces uniqueness on non-null values)
CREATE UNIQUE INDEX idx_users_phone_unique 
ON users (phone_number) 
WHERE phone_number IS NOT NULL AND phone_number != '';

-- ============================================
-- 2. Game ID Uniqueness Enforcement (Trigger-based)
-- ============================================
-- Since in_game_ids is JSONB, we need a trigger to enforce uniqueness
-- of each individual game_id value across all users

-- Create a table to track all game_ids for efficient uniqueness checking
CREATE TABLE IF NOT EXISTS user_game_ids (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    game_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_type, game_id)  -- Each game_id must be unique per game_type
);

CREATE INDEX IF NOT EXISTS idx_user_game_ids_user ON user_game_ids(user_id);
CREATE INDEX IF NOT EXISTS idx_user_game_ids_lookup ON user_game_ids(game_type, LOWER(game_id));

-- Populate the tracking table from existing data
INSERT INTO user_game_ids (user_id, game_type, game_id)
SELECT 
    id as user_id,
    key as game_type,
    value as game_id
FROM users,
LATERAL jsonb_each_text(COALESCE(in_game_ids, '{}'::jsonb))
WHERE in_game_ids IS NOT NULL 
  AND in_game_ids != '{}'::jsonb
  AND value IS NOT NULL 
  AND value != ''
ON CONFLICT (game_type, game_id) DO NOTHING;

-- ============================================
-- 3. Trigger Function to Sync game_ids
-- ============================================

CREATE OR REPLACE FUNCTION sync_user_game_ids()
RETURNS TRIGGER AS $$
DECLARE
    old_game_type TEXT;
    old_game_id TEXT;
    new_game_type TEXT;
    new_game_id TEXT;
    existing_user_id UUID;
BEGIN
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        DELETE FROM user_game_ids WHERE user_id = OLD.id;
        RETURN OLD;
    END IF;
    
    -- Handle INSERT or UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Check for duplicate game_ids before allowing the change
        IF NEW.in_game_ids IS NOT NULL AND NEW.in_game_ids != '{}'::jsonb THEN
            FOR new_game_type, new_game_id IN 
                SELECT key, value FROM jsonb_each_text(NEW.in_game_ids)
                WHERE value IS NOT NULL AND value != ''
            LOOP
                -- Check if this game_id already exists for another user
                SELECT user_id INTO existing_user_id
                FROM user_game_ids
                WHERE game_type = new_game_type 
                  AND LOWER(game_id) = LOWER(new_game_id)
                  AND user_id != NEW.id
                LIMIT 1;
                
                IF existing_user_id IS NOT NULL THEN
                    RAISE EXCEPTION 'Game ID "%" for game type "%" is already in use by another user', 
                        new_game_id, new_game_type
                        USING ERRCODE = 'unique_violation';
                END IF;
            END LOOP;
        END IF;
        
        -- Remove old game_ids for this user
        DELETE FROM user_game_ids WHERE user_id = NEW.id;
        
        -- Insert new game_ids
        IF NEW.in_game_ids IS NOT NULL AND NEW.in_game_ids != '{}'::jsonb THEN
            INSERT INTO user_game_ids (user_id, game_type, game_id)
            SELECT 
                NEW.id,
                key,
                value
            FROM jsonb_each_text(NEW.in_game_ids)
            WHERE value IS NOT NULL AND value != '';
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_user_game_ids ON users;

-- Create trigger
CREATE TRIGGER trigger_sync_user_game_ids
    AFTER INSERT OR UPDATE OF in_game_ids OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_game_ids();

-- ============================================
-- 4. Verification Queries (run manually)
-- ============================================
-- Check for any remaining duplicates after migration:
/*
-- Duplicate usernames (should be 0)
SELECT LOWER(username), COUNT(*) 
FROM users 
GROUP BY LOWER(username) 
HAVING COUNT(*) > 1;

-- Duplicate emails (should be 0)
SELECT LOWER(email), COUNT(*) 
FROM users 
GROUP BY LOWER(email) 
HAVING COUNT(*) > 1;

-- Duplicate phone numbers (should be 0)
SELECT phone_number, COUNT(*) 
FROM users 
WHERE phone_number IS NOT NULL AND phone_number != ''
GROUP BY phone_number 
HAVING COUNT(*) > 1;

-- Duplicate game_ids (should be 0)
SELECT game_type, game_id, COUNT(*) 
FROM user_game_ids 
GROUP BY game_type, LOWER(game_id) 
HAVING COUNT(*) > 1;
*/

-- ============================================
-- Success message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration successful: User uniqueness constraints added';
    RAISE NOTICE '- Phone number unique index created (partial, non-null values)';
    RAISE NOTICE '- Game ID tracking table created with unique constraint';
    RAISE NOTICE '- Trigger installed to enforce game_id uniqueness on INSERT/UPDATE';
END $$;
