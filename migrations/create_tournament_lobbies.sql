-- Migration: Create Tournament Lobbies System
-- This creates the lobbies table for organizing teams within tournaments

-- Tournament Lobbies Table
CREATE TABLE IF NOT EXISTS tournament_lobbies (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL,
    lobby_name VARCHAR(100) NOT NULL,
    lobby_number INTEGER NOT NULL DEFAULT 1,
    room_id VARCHAR(100),
    room_password VARCHAR(100),
    max_teams INTEGER NOT NULL DEFAULT 12,
    current_teams INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, active, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id, lobby_number)
);

-- Add foreign key only if tournaments table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'tournament_lobbies_tournament_id_fkey'
        ) THEN
            ALTER TABLE tournament_lobbies 
            ADD CONSTRAINT tournament_lobbies_tournament_id_fkey 
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Add lobby_id to tournament_registrations if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournament_registrations' AND column_name = 'lobby_id'
    ) THEN
        ALTER TABLE tournament_registrations ADD COLUMN lobby_id INTEGER REFERENCES tournament_lobbies(id);
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_lobbies_tournament ON tournament_lobbies(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_lobbies_status ON tournament_lobbies(status);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_lobby ON tournament_registrations(lobby_id) WHERE lobby_id IS NOT NULL;

-- Comment
COMMENT ON TABLE tournament_lobbies IS 'Lobbies within tournaments for organizing teams into match groups';
