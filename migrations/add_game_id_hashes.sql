-- ============================================
-- Migration: Add Game ID Hash Table for Uniqueness
-- ============================================
-- This migration creates a table to store deterministic hashes of game IDs.
-- Since game IDs are encrypted with random IVs, we need hashes for duplicate detection.
-- 
-- Why a separate table instead of a column?
-- - in_game_ids is JSONB with multiple key-value pairs
-- - Each game_type:game_id combination needs its own hash
-- - Separate table allows efficient indexing and querying
-- ============================================

-- Drop the old trigger-based system (it doesn't work with encrypted values)
DROP TRIGGER IF EXISTS sync_user_game_ids_trigger ON users;
DROP FUNCTION IF EXISTS sync_user_game_ids() CASCADE;
DROP TABLE IF EXISTS user_game_ids CASCADE;

-- Create the new hash-based table
CREATE TABLE IF NOT EXISTS user_game_id_hashes (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    game_id_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Each hash must be unique per game type
    CONSTRAINT unique_game_id_hash UNIQUE (game_type, game_id_hash),
    -- Game ID hashes are derived from numeric-only game IDs
    -- Validation is enforced at the API level
    CONSTRAINT game_type_not_empty CHECK (game_type != '')
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_game_id_hashes_user ON user_game_id_hashes(user_id);
CREATE INDEX IF NOT EXISTS idx_game_id_hashes_lookup ON user_game_id_hashes(game_type, game_id_hash);

-- Note: After running this migration, execute:
-- npx tsx scripts/backfill-game-id-hashes.ts
-- to populate the hash table for existing users

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration successful: user_game_id_hashes table created';
    RAISE NOTICE 'Old trigger-based system removed';
    RAISE NOTICE 'Run: npx tsx scripts/backfill-game-id-hashes.ts to populate hashes';
END $$;
