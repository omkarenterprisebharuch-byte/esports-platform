-- ============================================
-- League Mode System Migration
-- Adds league mode support for tournaments with
-- auto-generated lobbies and messaging system
-- ============================================

-- ============================================
-- 1. Add league columns to tournaments table
-- ============================================

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS is_league_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS league_total_slots INTEGER,
ADD COLUMN IF NOT EXISTS league_mode VARCHAR(20), -- solo, duo, squad
ADD COLUMN IF NOT EXISTS league_lobbies_created BOOLEAN DEFAULT FALSE;

-- Index for league tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_league ON tournaments(is_league_enabled) WHERE is_league_enabled = TRUE;

-- ============================================
-- 2. LEAGUE LOBBIES Table
-- ============================================

CREATE TABLE IF NOT EXISTS league_lobbies (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    lobby_number INTEGER NOT NULL,
    lobby_id VARCHAR(50) NOT NULL, -- Unique game room ID
    lobby_password VARCHAR(50) NOT NULL,
    max_teams INTEGER NOT NULL, -- Based on mode: Solo=48, Duo=24, Squad=12
    current_teams INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, open, in_progress, completed
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tournament_id, lobby_number),
    UNIQUE(tournament_id, lobby_id)
);

CREATE INDEX IF NOT EXISTS idx_league_lobbies_tournament ON league_lobbies(tournament_id);
CREATE INDEX IF NOT EXISTS idx_league_lobbies_status ON league_lobbies(status);

-- ============================================
-- 3. LEAGUE LOBBY ASSIGNMENTS Table
-- Links teams/players to their assigned lobby
-- ============================================

CREATE TABLE IF NOT EXISTS league_lobby_assignments (
    id SERIAL PRIMARY KEY,
    lobby_id INTEGER NOT NULL REFERENCES league_lobbies(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES tournament_registrations(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot_in_lobby INTEGER NOT NULL, -- Position within the lobby
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(lobby_id, registration_id),
    UNIQUE(lobby_id, slot_in_lobby)
);

CREATE INDEX IF NOT EXISTS idx_lobby_assignments_lobby ON league_lobby_assignments(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_assignments_registration ON league_lobby_assignments(registration_id);
CREATE INDEX IF NOT EXISTS idx_lobby_assignments_user ON league_lobby_assignments(user_id);

-- ============================================
-- 4. LEAGUE MESSAGES Table
-- For admin to send messages to lobbies/teams
-- ============================================

CREATE TABLE IF NOT EXISTS league_messages (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL, -- 'global', 'lobby', 'team'
    recipient_lobby_id INTEGER REFERENCES league_lobbies(id) ON DELETE CASCADE,
    recipient_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deletable_until TIMESTAMP WITH TIME ZONE NOT NULL, -- createdAt + 5 minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_recipient CHECK (
        (recipient_type = 'global' AND recipient_lobby_id IS NULL AND recipient_team_id IS NULL) OR
        (recipient_type = 'lobby' AND recipient_lobby_id IS NOT NULL AND recipient_team_id IS NULL) OR
        (recipient_type = 'team' AND recipient_team_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_league_messages_tournament ON league_messages(tournament_id);
CREATE INDEX IF NOT EXISTS idx_league_messages_recipient ON league_messages(recipient_type, recipient_lobby_id, recipient_team_id);
CREATE INDEX IF NOT EXISTS idx_league_messages_sender ON league_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_league_messages_deletable ON league_messages(deletable_until) WHERE is_deleted = FALSE;

-- ============================================
-- 5. Function to auto-assign teams to lobbies
-- Called when a team registers for a league tournament
-- ============================================

CREATE OR REPLACE FUNCTION assign_to_league_lobby()
RETURNS TRIGGER AS $$
DECLARE
    v_tournament RECORD;
    v_lobby RECORD;
    v_slot INTEGER;
BEGIN
    -- Check if tournament has league mode enabled
    SELECT is_league_enabled, league_lobbies_created 
    INTO v_tournament 
    FROM tournaments 
    WHERE id = NEW.tournament_id;
    
    IF NOT v_tournament.is_league_enabled OR NOT v_tournament.league_lobbies_created THEN
        RETURN NEW;
    END IF;
    
    -- Find a lobby with available slots
    SELECT * INTO v_lobby
    FROM league_lobbies
    WHERE tournament_id = NEW.tournament_id
      AND current_teams < max_teams
      AND status IN ('pending', 'open')
    ORDER BY lobby_number
    LIMIT 1
    FOR UPDATE;
    
    IF v_lobby IS NULL THEN
        -- No available lobby - this shouldn't happen if slots are validated
        RAISE WARNING 'No available lobby for registration %', NEW.id;
        RETURN NEW;
    END IF;
    
    -- Get next slot number in lobby
    SELECT COALESCE(MAX(slot_in_lobby), 0) + 1 INTO v_slot
    FROM league_lobby_assignments
    WHERE lobby_id = v_lobby.id;
    
    -- Create assignment
    INSERT INTO league_lobby_assignments (lobby_id, registration_id, team_id, user_id, slot_in_lobby)
    VALUES (v_lobby.id, NEW.id, NEW.team_id, NEW.user_id, v_slot);
    
    -- Update lobby count
    UPDATE league_lobbies
    SET current_teams = current_teams + 1,
        updated_at = NOW()
    WHERE id = v_lobby.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign on registration (only for confirmed registrations)
DROP TRIGGER IF EXISTS trg_assign_league_lobby ON tournament_registrations;
CREATE TRIGGER trg_assign_league_lobby
    AFTER INSERT ON tournament_registrations
    FOR EACH ROW
    WHEN (NEW.status = 'registered' AND NEW.is_waitlisted = FALSE)
    EXECUTE FUNCTION assign_to_league_lobby();

-- ============================================
-- 6. Function to create lobbies for a tournament
-- ============================================

CREATE OR REPLACE FUNCTION create_league_lobbies(
    p_tournament_id UUID,
    p_total_slots INTEGER,
    p_mode VARCHAR(20),
    p_game VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
    v_teams_per_lobby INTEGER;
    v_lobby_count INTEGER;
    v_lobby_num INTEGER;
    v_lobby_id VARCHAR(50);
    v_lobby_password VARCHAR(50);
BEGIN
    -- Determine teams per lobby based on mode
    CASE p_mode
        WHEN 'solo' THEN v_teams_per_lobby := 48;
        WHEN 'duo' THEN v_teams_per_lobby := 24;
        WHEN 'squad' THEN v_teams_per_lobby := 12;
        ELSE RAISE EXCEPTION 'Invalid mode: %', p_mode;
    END CASE;
    
    -- Calculate number of lobbies needed
    v_lobby_count := p_total_slots / v_teams_per_lobby;
    
    -- Create lobbies
    FOR v_lobby_num IN 1..v_lobby_count LOOP
        -- Generate unique lobby credentials
        v_lobby_id := 'L' || p_tournament_id::VARCHAR(8) || '-' || LPAD(v_lobby_num::VARCHAR, 3, '0');
        v_lobby_password := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        
        INSERT INTO league_lobbies (
            tournament_id, lobby_number, lobby_id, lobby_password, max_teams, status
        ) VALUES (
            p_tournament_id, v_lobby_num, v_lobby_id, v_lobby_password, v_teams_per_lobby, 'pending'
        );
    END LOOP;
    
    -- Mark tournament lobbies as created
    UPDATE tournaments 
    SET league_lobbies_created = TRUE, updated_at = NOW()
    WHERE id = p_tournament_id;
    
    RETURN v_lobby_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Helpful views
-- ============================================

-- View: League tournament summary
CREATE OR REPLACE VIEW v_league_tournament_summary AS
SELECT 
    t.id as tournament_id,
    t.tournament_name,
    t.game_type,
    t.tournament_type,
    t.is_league_enabled,
    t.league_total_slots,
    t.league_mode,
    t.league_lobbies_created,
    t.status,
    COUNT(DISTINCT ll.id) as total_lobbies,
    COALESCE(SUM(ll.current_teams), 0) as total_registered,
    t.registration_start_date,
    t.registration_end_date,
    t.tournament_start_date
FROM tournaments t
LEFT JOIN league_lobbies ll ON t.id = ll.tournament_id
WHERE t.is_league_enabled = TRUE
GROUP BY t.id;

-- View: Lobby details with assignments
CREATE OR REPLACE VIEW v_lobby_details AS
SELECT 
    ll.id as lobby_id,
    ll.tournament_id,
    ll.lobby_number,
    ll.lobby_id as room_id,
    ll.lobby_password as room_password,
    ll.max_teams,
    ll.current_teams,
    ll.status,
    t.tournament_name,
    t.game_type,
    t.league_mode
FROM league_lobbies ll
JOIN tournaments t ON ll.tournament_id = t.id;

COMMENT ON TABLE league_lobbies IS 'Stores auto-generated lobbies for league mode tournaments';
COMMENT ON TABLE league_lobby_assignments IS 'Links registered teams/players to their assigned lobby';
COMMENT ON TABLE league_messages IS 'Admin messages to lobbies or teams with 5-minute delete window';
