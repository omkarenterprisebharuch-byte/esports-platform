-- Migration: Create Player Reports and Ban System
-- Created: December 31, 2025
-- Purpose: Anti-cheating player reporting mechanism with game ID bans

-- ============================================
-- Report Categories (predefined categories and subcategories)
-- ============================================
CREATE TABLE IF NOT EXISTS report_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES report_categories(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert main categories
INSERT INTO report_categories (name, description, display_order) VALUES
('Cheating', 'Using unauthorized tools or exploits', 1),
('Toxicity', 'Abusive behavior or harassment', 2),
('Unsportsmanlike Conduct', 'Poor sportsmanship or rule violations', 3),
('Fraud', 'Fake accounts, smurfing, or identity issues', 4),
('Technical Issues', 'Match manipulation or technical exploits', 5);

-- Insert subcategories for Cheating (parent_id = 1)
INSERT INTO report_categories (name, description, parent_id, display_order) VALUES
('Aimbot/Auto-aim', 'Using software to automatically aim at enemies', 1, 1),
('Wallhack', 'Seeing through walls or objects', 1, 2),
('Speed Hack', 'Moving faster than normal game allows', 1, 3),
('ESP/Radar Hack', 'Seeing enemy positions on minimap illegally', 1, 4),
('Macro/Script', 'Using automated key presses or scripts', 1, 5),
('Other Cheat', 'Other cheating methods not listed', 1, 6);

-- Insert subcategories for Toxicity (parent_id = 2)
INSERT INTO report_categories (name, description, parent_id, display_order) VALUES
('Hate Speech', 'Racist, sexist, or discriminatory language', 2, 1),
('Harassment', 'Targeted harassment of players', 2, 2),
('Threats', 'Threatening violence or harm', 2, 3),
('Offensive Username/Avatar', 'Inappropriate profile content', 2, 4),
('Spam', 'Excessive spamming in chat', 2, 5);

-- Insert subcategories for Unsportsmanlike Conduct (parent_id = 3)
INSERT INTO report_categories (name, description, parent_id, display_order) VALUES
('Intentional Throwing', 'Deliberately losing the match', 3, 1),
('Team Killing', 'Intentionally killing teammates', 3, 2),
('AFK/Leaving Match', 'Abandoning the match', 3, 3),
('Griefing', 'Intentionally disrupting teammates', 3, 4),
('Match Fixing', 'Pre-arranged match outcomes', 3, 5);

-- Insert subcategories for Fraud (parent_id = 4)
INSERT INTO report_categories (name, description, parent_id, display_order) VALUES
('Fake Account', 'Using a fake or stolen identity', 4, 1),
('Smurfing', 'High-skill player using low-rank account', 4, 2),
('Account Sharing', 'Multiple people using one account', 4, 3),
('Boosting', 'Paid or assisted rank boosting', 4, 4),
('Impersonation', 'Pretending to be someone else', 4, 5);

-- Insert subcategories for Technical Issues (parent_id = 5)
INSERT INTO report_categories (name, description, parent_id, display_order) VALUES
('DDoS/Network Attack', 'Attacking servers or players', 5, 1),
('Exploit Abuse', 'Using game bugs for advantage', 5, 2),
('Stream Sniping', 'Using stream to gain advantage', 5, 3),
('Lag Switching', 'Intentionally causing lag', 5, 4);

-- ============================================
-- Player Reports Table
-- ============================================
CREATE TABLE IF NOT EXISTS player_reports (
    id SERIAL PRIMARY KEY,
    
    -- Reporter info
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Reported player info
    reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_game_id VARCHAR(100), -- The in-game ID that was reported
    reported_game_type VARCHAR(50), -- freefire, pubg, valorant, codm, etc.
    
    -- Tournament/Match context
    tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
    match_id INTEGER, -- For future match system
    
    -- Report details
    category_id INTEGER NOT NULL REFERENCES report_categories(id),
    subcategory_id INTEGER REFERENCES report_categories(id),
    description TEXT NOT NULL,
    evidence_urls TEXT[], -- Array of Cloudinary URLs for screenshots/videos
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed', 'escalated')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    
    -- Resolution
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    action_taken VARCHAR(50), -- warning, temp_ban, permanent_ban, game_id_ban, none
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Banned Game IDs Table
-- ============================================
CREATE TABLE IF NOT EXISTS banned_game_ids (
    id SERIAL PRIMARY KEY,
    
    -- The banned game ID
    game_id VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL, -- freefire, pubg, valorant, codm
    
    -- Ban details
    reason TEXT NOT NULL,
    banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    report_id INTEGER REFERENCES player_reports(id) ON DELETE SET NULL,
    
    -- Original owner (if known)
    original_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Ban duration
    is_permanent BOOLEAN DEFAULT TRUE,
    ban_expires_at TIMESTAMP, -- NULL for permanent bans
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate bans for same game ID + type
    UNIQUE(game_id, game_type)
);

-- ============================================
-- Ban Appeal Table (for future use)
-- ============================================
CREATE TABLE IF NOT EXISTS ban_appeals (
    id SERIAL PRIMARY KEY,
    
    -- The ban being appealed
    ban_id INTEGER NOT NULL REFERENCES banned_game_ids(id) ON DELETE CASCADE,
    
    -- Appellant
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Appeal details
    appeal_reason TEXT NOT NULL,
    evidence_urls TEXT[],
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied')),
    
    -- Resolution
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON player_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON player_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_tournament ON player_reports(tournament_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON player_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON player_reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON player_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_game_id ON player_reports(reported_game_id, reported_game_type);

CREATE INDEX IF NOT EXISTS idx_banned_game_ids_lookup ON banned_game_ids(game_id, game_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_banned_game_ids_user ON banned_game_ids(original_user_id);

CREATE INDEX IF NOT EXISTS idx_report_categories_parent ON report_categories(parent_id);

-- ============================================
-- Update Trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reports_updated_at
    BEFORE UPDATE ON player_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

CREATE TRIGGER trigger_banned_game_ids_updated_at
    BEFORE UPDATE ON banned_game_ids
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

CREATE TRIGGER trigger_ban_appeals_updated_at
    BEFORE UPDATE ON ban_appeals
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE player_reports IS 'Stores player reports for cheating, toxicity, and other violations';
COMMENT ON TABLE banned_game_ids IS 'Stores banned game IDs - players cannot register with these IDs';
COMMENT ON TABLE report_categories IS 'Hierarchical categories for report classification';
COMMENT ON TABLE ban_appeals IS 'Appeals submitted by players against their bans';

COMMENT ON COLUMN player_reports.status IS 'pending: new report, under_review: being investigated, resolved: action taken, dismissed: no action, escalated: needs higher review';
COMMENT ON COLUMN player_reports.action_taken IS 'warning: verbal warning, temp_ban: temporary suspension, permanent_ban: account ban, game_id_ban: specific game ID banned, none: no action';
COMMENT ON COLUMN banned_game_ids.is_active IS 'FALSE when ban is lifted or expired';
