-- ============================================
-- Complete Database Schema for Esports Platform
-- Run this on a fresh database to create all tables
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. ENUM Types
-- ============================================

-- User role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('player', 'organizer', 'owner');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Login status enum
DO $$ BEGIN
    CREATE TYPE login_status AS ENUM ('success', 'failed', 'blocked', 'suspicious');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. USERS Table (Core table - must be created first)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(100),
    phone_number VARCHAR(20),
    profile_picture_url TEXT,
    in_game_ids JSONB DEFAULT '{}',
    wallet_balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
    hold_balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
    is_host BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    auth_provider VARCHAR(20) DEFAULT 'local',
    auth_provider_id VARCHAR(255),
    role user_role DEFAULT 'player',
    last_login_at TIMESTAMP WITH TIME ZONE,
    notification_preferences JSONB DEFAULT '{
        "email": {
            "tournament_updates": true,
            "registration_confirmation": true,
            "room_credentials": true,
            "tournament_reminders": true,
            "waitlist_updates": true,
            "marketing": false
        },
        "push": {
            "tournament_updates": true,
            "registration_confirmation": true,
            "room_credentials": true,
            "tournament_reminders": true,
            "waitlist_updates": true,
            "marketing": false
        }
    }'::jsonb,
    deletion_requested_at TIMESTAMP WITH TIME ZONE,
    deletion_scheduled_for TIMESTAMP WITH TIME ZONE,
    data_export_requested_at TIMESTAMP WITH TIME ZONE,
    consent_marketing BOOLEAN DEFAULT FALSE,
    consent_analytics BOOLEAN DEFAULT TRUE,
    consent_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_host ON users(is_host);
CREATE INDEX IF NOT EXISTS idx_users_notification_preferences ON users USING GIN (notification_preferences);

-- ============================================
-- 3. TEAMS Table
-- ============================================

CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    team_name VARCHAR(50) NOT NULL,
    team_code VARCHAR(10) NOT NULL UNIQUE,
    invite_code VARCHAR(20),
    captain_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    total_members INTEGER DEFAULT 1,
    max_members INTEGER DEFAULT 6,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_captain ON teams(captain_id);
CREATE INDEX IF NOT EXISTS idx_teams_code ON teams(team_code);

-- ============================================
-- 4. TEAM MEMBERS Table
-- ============================================

CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    game_uid VARCHAR(100),
    game_name VARCHAR(100),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================
-- 5. TOURNAMENTS Table
-- ============================================

CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tournament_name VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    tournament_type VARCHAR(20) NOT NULL,
    description TEXT,
    tournament_banner_url TEXT,
    max_teams INTEGER NOT NULL DEFAULT 100,
    current_teams INTEGER DEFAULT 0,
    entry_fee DECIMAL(10,2) DEFAULT 0,
    prize_pool DECIMAL(10,2) DEFAULT 0,
    match_rules TEXT,
    map_name VARCHAR(100),
    total_matches INTEGER DEFAULT 1,
    status VARCHAR(30) DEFAULT 'upcoming',
    registration_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    tournament_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    tournament_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    room_id VARCHAR(100),
    room_password VARCHAR(100),
    room_credentials_updated_at TIMESTAMP WITH TIME ZONE,
    schedule_type VARCHAR(20) DEFAULT 'once',
    publish_time TIME,
    is_template BOOLEAN DEFAULT FALSE,
    template_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
    last_published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT tournaments_schedule_type_check CHECK (schedule_type IN ('once', 'everyday'))
);

CREATE INDEX IF NOT EXISTS idx_tournaments_host ON tournaments(host_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_game_type ON tournaments(game_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_date ON tournaments(tournament_start_date);
CREATE INDEX IF NOT EXISTS idx_tournaments_template ON tournaments(is_template) WHERE is_template = TRUE;

-- ============================================
-- 6. TOURNAMENT REGISTRATIONS Table
-- ============================================

CREATE TABLE IF NOT EXISTS tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registration_type VARCHAR(20) NOT NULL,
    slot_number INTEGER,
    selected_players JSONB DEFAULT '[]',
    backup_players JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'registered',
    is_waitlisted BOOLEAN DEFAULT FALSE,
    waitlist_position INTEGER,
    promoted_at TIMESTAMP WITH TIME ZONE,
    promoted_from_waitlist BOOLEAN DEFAULT FALSE,
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    check_in_reminder_sent BOOLEAN DEFAULT FALSE,
    promoted_via_checkin BOOLEAN DEFAULT FALSE,
    original_slot_holder_id INTEGER,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON tournament_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team ON tournament_registrations(team_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON tournament_registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist ON tournament_registrations(tournament_id, is_waitlisted, waitlist_position) WHERE is_waitlisted = TRUE;
CREATE INDEX IF NOT EXISTS idx_registrations_checkin ON tournament_registrations(tournament_id, checked_in) WHERE status IN ('registered', 'confirmed');

-- ============================================
-- 7. WALLET TRANSACTIONS Table
-- ============================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed' NOT NULL,
    description TEXT,
    reference_id VARCHAR(100),
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- ============================================
-- 8. BALANCE HOLDS Table
-- ============================================

CREATE TABLE IF NOT EXISTS balance_holds (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    hold_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    reference_type VARCHAR(30),
    reference_id VARCHAR(100),
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_holds_user_id ON balance_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_holds_status ON balance_holds(status);
CREATE INDEX IF NOT EXISTS idx_balance_holds_user_active ON balance_holds(user_id, status) WHERE status = 'active';

-- ============================================
-- 9. DEPOSIT REQUESTS Table
-- ============================================

CREATE TABLE IF NOT EXISTS deposit_requests (
    id SERIAL PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    request_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    requester_note TEXT,
    responder_note TEXT,
    payment_proof_url TEXT,
    payment_reference VARCHAR(100),
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_requester ON deposit_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_target ON deposit_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);

-- ============================================
-- 10. REFRESH TOKENS Table
-- ============================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id, revoked, expires_at);

-- ============================================
-- 11. NOTIFICATIONS Table
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
    category VARCHAR(50) NOT NULL DEFAULT 'info',
    tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
    channels_sent TEXT[] DEFAULT '{}',
    email_sent_at TIMESTAMP WITH TIME ZONE,
    push_sent_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ============================================
-- 12. CHAT MESSAGES Table
-- ============================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    message TEXT NOT NULL CHECK (char_length(message) <= 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_tournament_id ON chat_messages(tournament_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tournament_created ON chat_messages(tournament_id, created_at DESC);

-- ============================================
-- 13. LOGIN HISTORY Table
-- ============================================

CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    status login_status NOT NULL DEFAULT 'success',
    failure_reason TEXT,
    is_new_ip BOOLEAN DEFAULT FALSE,
    is_new_location BOOLEAN DEFAULT FALSE,
    country VARCHAR(100),
    city VARCHAR(100),
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address);

-- ============================================
-- 14. KNOWN USER IPs Table
-- ============================================

CREATE TABLE IF NOT EXISTS known_user_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_count INTEGER DEFAULT 1,
    is_trusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, ip_address)
);

-- ============================================
-- 15. REPORT CATEGORIES Table
-- ============================================

CREATE TABLE IF NOT EXISTS report_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES report_categories(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 16. PLAYER REPORTS Table
-- ============================================

CREATE TABLE IF NOT EXISTS player_reports (
    id SERIAL PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_game_id VARCHAR(100),
    reported_game_type VARCHAR(50),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
    match_id INTEGER,
    category_id INTEGER NOT NULL REFERENCES report_categories(id),
    subcategory_id INTEGER REFERENCES report_categories(id),
    description TEXT NOT NULL,
    evidence_urls TEXT[],
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed', 'escalated')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    action_taken VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON player_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON player_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON player_reports(status);

-- ============================================
-- 17. BANNED GAME IDs Table
-- ============================================

CREATE TABLE IF NOT EXISTS banned_game_ids (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    report_id INTEGER REFERENCES player_reports(id) ON DELETE SET NULL,
    original_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_permanent BOOLEAN DEFAULT TRUE,
    ban_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, game_type)
);

CREATE INDEX IF NOT EXISTS idx_banned_game_ids_lookup ON banned_game_ids(game_id, game_type) WHERE is_active = TRUE;

-- ============================================
-- 18. BAN APPEALS Table
-- ============================================

CREATE TABLE IF NOT EXISTS ban_appeals (
    id SERIAL PRIMARY KEY,
    ban_id INTEGER NOT NULL REFERENCES banned_game_ids(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appeal_reason TEXT NOT NULL,
    evidence_urls TEXT[],
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 19. TOURNAMENT CHECKIN SETTINGS Table
-- ============================================

CREATE TABLE IF NOT EXISTS tournament_checkin_settings (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    checkin_window_minutes INTEGER DEFAULT 30,
    auto_finalize BOOLEAN DEFAULT TRUE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id)
);

-- ============================================
-- 20. PUSH SUBSCRIPTIONS Table
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ============================================
-- 21. TOURNAMENT LEADERBOARD Table
-- ============================================

CREATE TABLE IF NOT EXISTS tournament_leaderboard (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    kills INTEGER DEFAULT 0,
    placement INTEGER,
    points INTEGER DEFAULT 0,
    prize_amount DECIMAL(10,2) DEFAULT 0,
    match_number INTEGER DEFAULT 1,
    submitted_by UUID REFERENCES users(id),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_tournament ON tournament_leaderboard(tournament_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON tournament_leaderboard(user_id);

-- ============================================
-- 22. ADVERTISEMENTS Table
-- ============================================

CREATE TABLE IF NOT EXISTS advertisements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    position VARCHAR(50) DEFAULT 'sidebar',
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 23. Update Trigger Function
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to main tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_registrations_updated_at ON tournament_registrations;
CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON tournament_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 24. Sync is_host with role Trigger
-- ============================================

CREATE OR REPLACE FUNCTION sync_is_host_with_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IN ('organizer', 'owner') THEN
        NEW.is_host := TRUE;
    ELSE
        NEW.is_host := FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_is_host ON users;
CREATE TRIGGER trigger_sync_is_host
BEFORE INSERT OR UPDATE OF role ON users
FOR EACH ROW
EXECUTE FUNCTION sync_is_host_with_role();

-- ============================================
-- 25. Insert Report Categories
-- ============================================

INSERT INTO report_categories (name, description, display_order) VALUES
('Cheating', 'Using unauthorized tools or exploits', 1),
('Toxicity', 'Abusive behavior or harassment', 2),
('Unsportsmanlike Conduct', 'Poor sportsmanship or rule violations', 3),
('Fraud', 'Fake accounts, smurfing, or identity issues', 4),
('Technical Issues', 'Match manipulation or technical exploits', 5)
ON CONFLICT DO NOTHING;

-- ============================================
-- Done!
-- ============================================
