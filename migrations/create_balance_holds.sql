-- Balance Holds System Migration
-- Created: 2026-01-01
-- Description: Creates table for holding user balance during pending operations
-- (e.g., waitlist registrations where entry fee is held until slot is confirmed)

-- ============================================
-- 1. Balance Holds Table
-- ============================================
-- Stores balance holds for various operations

CREATE TABLE IF NOT EXISTS balance_holds (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    hold_type VARCHAR(30) NOT NULL,
    -- Types:
    --   'waitlist_entry_fee' - Entry fee held for waitlist registration
    --   'pending_withdrawal' - Balance held for pending withdrawal
    --   'dispute' - Balance held due to dispute
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    -- Status: 
    --   'active' - Hold is active, amount is locked
    --   'released' - Hold released, amount returned to wallet
    --   'confirmed' - Hold confirmed, amount deducted
    --   'expired' - Hold expired, amount returned to wallet
    reference_type VARCHAR(30),
    -- Reference types: 'tournament_registration', 'withdrawal_request', etc.
    reference_id VARCHAR(100),
    -- Reference to the related entity (e.g., registration_id, tournament_id)
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    -- Optional expiry time for automatic release
    released_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    -- Link to the resulting transaction (when confirmed)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for balance_holds
CREATE INDEX IF NOT EXISTS idx_balance_holds_user_id ON balance_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_holds_status ON balance_holds(status);
CREATE INDEX IF NOT EXISTS idx_balance_holds_type ON balance_holds(hold_type);
CREATE INDEX IF NOT EXISTS idx_balance_holds_reference ON balance_holds(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_balance_holds_created_at ON balance_holds(created_at DESC);

-- Composite index for finding active holds for a user
CREATE INDEX IF NOT EXISTS idx_balance_holds_user_active 
ON balance_holds(user_id, status) WHERE status = 'active';

-- Index for expired holds cleanup
CREATE INDEX IF NOT EXISTS idx_balance_holds_expires_at 
ON balance_holds(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

-- ============================================
-- 2. Add hold_balance column to users table
-- ============================================
-- Tracks total held balance for quick access

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS hold_balance DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- ============================================
-- 3. Add trigger for updated_at
-- ============================================

-- Trigger for balance_holds updated_at
DROP TRIGGER IF EXISTS update_balance_holds_updated_at ON balance_holds;
CREATE TRIGGER update_balance_holds_updated_at
    BEFORE UPDATE ON balance_holds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Comments for documentation
-- ============================================

COMMENT ON TABLE balance_holds IS 'Stores balance holds for pending operations like waitlist registrations';
COMMENT ON COLUMN balance_holds.hold_type IS 'Type of hold: waitlist_entry_fee, pending_withdrawal, dispute';
COMMENT ON COLUMN balance_holds.status IS 'Hold status: active, released, confirmed, expired';
COMMENT ON COLUMN balance_holds.reference_type IS 'Type of entity this hold is related to';
COMMENT ON COLUMN balance_holds.reference_id IS 'ID of the related entity';
COMMENT ON COLUMN users.hold_balance IS 'Total balance currently on hold (not available for use)';

