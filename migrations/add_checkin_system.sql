-- Tournament Check-in System Migration
-- Adds check-in functionality for tournament attendance tracking

-- Add check-in columns to tournament_registrations
ALTER TABLE tournament_registrations 
ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS check_in_reminder_sent BOOLEAN DEFAULT FALSE;

-- Create index for check-in queries
CREATE INDEX IF NOT EXISTS idx_registrations_checkin 
ON tournament_registrations(tournament_id, checked_in) 
WHERE status IN ('registered', 'confirmed');

-- Create index for checked-in waitlist teams (for promotion priority)
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist_checkin 
ON tournament_registrations(tournament_id, checked_in_at ASC) 
WHERE is_waitlisted = TRUE AND checked_in = TRUE;

-- Add column for tracking if team was promoted via check-in
ALTER TABLE tournament_registrations 
ADD COLUMN IF NOT EXISTS promoted_via_checkin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_slot_holder_id INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN tournament_registrations.checked_in IS 'Whether team/player has checked in before tournament start';
COMMENT ON COLUMN tournament_registrations.checked_in_at IS 'Timestamp when check-in occurred';
COMMENT ON COLUMN tournament_registrations.check_in_reminder_sent IS 'Whether check-in reminder notification was sent';
COMMENT ON COLUMN tournament_registrations.promoted_via_checkin IS 'Whether waitlist team got slot due to no-show at check-in';
COMMENT ON COLUMN tournament_registrations.original_slot_holder_id IS 'ID of the original team that forfeited the slot';

-- Create a table to track check-in window settings per tournament (optional override)
CREATE TABLE IF NOT EXISTS tournament_checkin_settings (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  checkin_window_minutes INTEGER DEFAULT 30,
  auto_finalize BOOLEAN DEFAULT TRUE,
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id)
);

-- Add index for tournament checkin settings lookup
CREATE INDEX IF NOT EXISTS idx_checkin_settings_tournament 
ON tournament_checkin_settings(tournament_id);

COMMENT ON TABLE tournament_checkin_settings IS 'Custom check-in settings per tournament';
COMMENT ON COLUMN tournament_checkin_settings.checkin_window_minutes IS 'Minutes before tournament start when check-in opens';
COMMENT ON COLUMN tournament_checkin_settings.auto_finalize IS 'Whether to auto-finalize check-ins and promote waitlist at tournament start';
COMMENT ON COLUMN tournament_checkin_settings.finalized_at IS 'When check-in was finalized (slots reassigned)';
