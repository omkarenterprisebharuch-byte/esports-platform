-- Migration: Create login history table for IP-based fraud detection
-- Date: 2025-12-30
-- Purpose: Track all login attempts with IP addresses for fraud detection and security monitoring

-- Create enum for login attempt status
DO $$ BEGIN
    CREATE TYPE login_status AS ENUM ('success', 'failed', 'blocked', 'suspicious');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create login_history table
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL, -- Store email even for failed attempts where user_id might be null
    ip_address VARCHAR(45) NOT NULL, -- IPv6 can be up to 45 chars
    user_agent TEXT,
    status login_status NOT NULL DEFAULT 'success',
    failure_reason TEXT, -- Reason for failed/blocked attempts
    is_new_ip BOOLEAN DEFAULT FALSE, -- Flag for first time login from this IP
    is_new_location BOOLEAN DEFAULT FALSE, -- Flag for new geographic location (future use)
    country VARCHAR(100), -- For geo-location (future use)
    city VARCHAR(100), -- For geo-location (future use)
    flagged BOOLEAN DEFAULT FALSE, -- Flagged for admin review
    flag_reason TEXT, -- Why it was flagged
    reviewed BOOLEAN DEFAULT FALSE, -- Has admin reviewed this?
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create known_user_ips table to track trusted IPs per user
CREATE TABLE IF NOT EXISTS known_user_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_count INTEGER DEFAULT 1,
    is_trusted BOOLEAN DEFAULT FALSE, -- Manually marked as trusted by user/admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, ip_address)
);

-- Indexes for login_history
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status);
CREATE INDEX IF NOT EXISTS idx_login_history_flagged ON login_history(flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_login_history_needs_review ON login_history(reviewed) WHERE flagged = TRUE AND reviewed = FALSE;

-- Indexes for known_user_ips
CREATE INDEX IF NOT EXISTS idx_known_ips_user ON known_user_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_known_ips_lookup ON known_user_ips(user_id, ip_address);

-- Index for velocity checking (recent attempts by IP)
CREATE INDEX IF NOT EXISTS idx_login_history_velocity ON login_history(ip_address, created_at DESC);

-- Index for velocity checking (recent attempts by email)
CREATE INDEX IF NOT EXISTS idx_login_history_email_velocity ON login_history(email, created_at DESC);

-- Comments
COMMENT ON TABLE login_history IS 'Tracks all login attempts for security monitoring and fraud detection';
COMMENT ON TABLE known_user_ips IS 'Stores known/trusted IP addresses for each user';
COMMENT ON COLUMN login_history.is_new_ip IS 'TRUE if this is the first time this user logs in from this IP';
COMMENT ON COLUMN login_history.flagged IS 'TRUE if this login was flagged as suspicious for admin review';
COMMENT ON COLUMN known_user_ips.is_trusted IS 'TRUE if user or admin has marked this IP as trusted';
