-- Migration: Add user roles for RBAC
-- Created: December 30, 2025
-- Purpose: Implement Role-based Access Control (player, organizer, owner)

-- Create ENUM type for user roles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('player', 'organizer', 'owner');
    END IF;
END $$;

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'player';

-- Migrate existing is_host users to organizer role
UPDATE users 
SET role = 'organizer' 
WHERE is_host = TRUE AND role = 'player';

-- Set yourself (admin) as owner - update this email to match yours
UPDATE users 
SET role = 'owner' 
WHERE email = 'admin@esports.com';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role 
ON users(role);

-- Create index for quick owner/organizer lookups
CREATE INDEX IF NOT EXISTS idx_users_role_elevated 
ON users(role) 
WHERE role IN ('organizer', 'owner');

-- Add trigger to keep is_host in sync with role
CREATE OR REPLACE FUNCTION sync_is_host_with_role()
RETURNS TRIGGER AS $$
BEGIN
    -- If role is organizer or owner, set is_host to true
    IF NEW.role IN ('organizer', 'owner') THEN
        NEW.is_host := TRUE;
    ELSE
        NEW.is_host := FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_sync_is_host ON users;

CREATE TRIGGER trigger_sync_is_host
BEFORE INSERT OR UPDATE OF role ON users
FOR EACH ROW
EXECUTE FUNCTION sync_is_host_with_role();

-- Verify the migration
DO $$
DECLARE
    owner_count INTEGER;
    organizer_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO owner_count FROM users WHERE role = 'owner';
    SELECT COUNT(*) INTO organizer_count FROM users WHERE role = 'organizer';
    
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Owners: %', owner_count;
    RAISE NOTICE '  - Organizers: %', organizer_count;
    
    IF owner_count = 0 THEN
        RAISE WARNING 'No owner found! Update the migration with your email address.';
    END IF;
END $$;
