-- Migration: Create refresh tokens table for JWT refresh token storage
-- Date: 2025-12-30
-- Purpose: Store refresh tokens to enable access token (15min) + refresh token (7 days) pattern

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the token (never store plain tokens)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Device/session info for security monitoring
    user_agent TEXT,
    ip_address VARCHAR(45) -- IPv6 can be up to 45 chars
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- Index for user's active tokens (for listing sessions, logout all)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id, revoked, expires_at);

-- Index for cleanup job (expired tokens)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked = FALSE;

-- Comment on table
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for JWT token refresh flow. Tokens are hashed for security.';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token - never store plain tokens';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Set to TRUE on logout or token rotation';
