-- Add credentials_published column to league_lobbies table
-- This tracks whether room credentials have been sent to team members

ALTER TABLE league_lobbies 
ADD COLUMN IF NOT EXISTS credentials_published BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_league_lobbies_credentials_published 
ON league_lobbies(credentials_published) WHERE credentials_published = TRUE;

-- Update existing lobbies that have credentials to mark them as published
UPDATE league_lobbies 
SET credentials_published = TRUE 
WHERE lobby_id IS NOT NULL AND lobby_password IS NOT NULL;
