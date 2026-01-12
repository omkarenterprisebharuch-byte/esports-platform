-- Migration: Add game_type column to teams table
-- This allows filtering teams by game during tournament registration

-- Add game_type column to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS game_type VARCHAR(50);

-- Create index for filtering by game_type
CREATE INDEX IF NOT EXISTS idx_teams_game_type ON teams(game_type);

-- Note: Existing teams will have NULL game_type
-- They can be updated manually or via a backfill script if needed
