-- =====================================================
-- Materialized Views for Performance Optimization
-- Run this migration to create cached aggregation views
-- Date: January 15, 2026
-- =====================================================

-- =====================================================
-- 1. HALL OF FAME - Top Players View
-- Caches expensive aggregation of player rankings
-- Refresh: After tournament completion or daily
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_players AS
SELECT 
  u.id as user_id,
  u.username,
  u.profile_picture_url,
  COUNT(DISTINCT CASE WHEN tl.placement = 1 THEN tl.tournament_id END) as first_place_wins,
  COUNT(DISTINCT CASE WHEN tl.placement = 2 THEN tl.tournament_id END) as second_place_wins,
  COUNT(DISTINCT CASE WHEN tl.placement = 3 THEN tl.tournament_id END) as third_place_wins,
  COUNT(DISTINCT CASE WHEN tl.placement <= 3 THEN tl.tournament_id END) as total_podium_finishes,
  COALESCE(SUM(tl.prize_amount), 0) as total_earnings,
  COALESCE(SUM(tl.kills), 0) as total_kills,
  COALESCE(SUM(tl.points), 0) as total_points,
  t.game_type
FROM users u
INNER JOIN tournament_leaderboard tl ON u.id = tl.user_id
INNER JOIN tournaments t ON tl.tournament_id = t.id
WHERE t.status = 'completed'
GROUP BY u.id, u.username, u.profile_picture_url, t.game_type
HAVING COUNT(DISTINCT tl.tournament_id) > 0;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_players_user_game 
ON mv_top_players(user_id, game_type);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mv_top_players_first_place 
ON mv_top_players(first_place_wins DESC);

CREATE INDEX IF NOT EXISTS idx_mv_top_players_game_type 
ON mv_top_players(game_type);

-- =====================================================
-- 2. HALL OF FAME - Top Teams View
-- Caches expensive aggregation of team rankings
-- Refresh: After tournament completion or daily
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_teams AS
SELECT 
  tm.id as team_id,
  tm.team_name,
  COUNT(DISTINCT CASE WHEN tl.placement = 1 THEN tl.tournament_id END) as first_place_wins,
  COUNT(DISTINCT CASE WHEN tl.placement = 2 THEN tl.tournament_id END) as second_place_wins,
  COUNT(DISTINCT CASE WHEN tl.placement = 3 THEN tl.tournament_id END) as third_place_wins,
  COUNT(DISTINCT CASE WHEN tl.placement <= 3 THEN tl.tournament_id END) as total_podium_finishes,
  COALESCE(SUM(tl.prize_amount), 0) as total_earnings,
  COALESCE(SUM(tl.kills), 0) as total_kills,
  t.game_type
FROM teams tm
INNER JOIN tournament_leaderboard tl ON tm.id = tl.team_id
INNER JOIN tournaments t ON tl.tournament_id = t.id
WHERE t.status = 'completed'
GROUP BY tm.id, tm.team_name, t.game_type
HAVING COUNT(DISTINCT tl.tournament_id) > 0;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_teams_team_game 
ON mv_top_teams(team_id, game_type);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mv_top_teams_first_place 
ON mv_top_teams(first_place_wins DESC);

CREATE INDEX IF NOT EXISTS idx_mv_top_teams_game_type 
ON mv_top_teams(game_type);

-- =====================================================
-- 3. PLATFORM STATISTICS View
-- Caches expensive count aggregations
-- Refresh: Hourly or on-demand
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_stats AS
SELECT 
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_users,
  (SELECT COUNT(*) FROM tournaments WHERE is_template = FALSE OR is_template IS NULL) as total_tournaments,
  (SELECT COUNT(*) FROM tournaments WHERE status = 'completed') as completed_tournaments,
  (SELECT COUNT(*) FROM tournaments WHERE status IN ('upcoming', 'registration_open', 'ongoing')) as active_tournaments,
  (SELECT COUNT(*) FROM teams WHERE is_active = TRUE) as total_teams,
  (SELECT COUNT(*) FROM tournament_registrations WHERE status != 'cancelled') as total_registrations,
  (SELECT COALESCE(SUM(prize_amount), 0) FROM tournament_leaderboard) as total_prize_distributed,
  NOW() as last_updated;

-- No unique index needed since this is a single row

-- =====================================================
-- 4. TOURNAMENT REGISTRATION COUNTS View
-- Caches registration counts per tournament
-- Refresh: Every 5 minutes or on registration change
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tournament_reg_counts AS
SELECT 
  t.id as tournament_id,
  t.tournament_name,
  t.max_teams,
  t.status,
  COUNT(CASE WHEN tr.status != 'cancelled' THEN 1 END) as registration_count,
  COUNT(CASE WHEN tr.status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN tr.status = 'waitlisted' THEN 1 END) as waitlisted_count,
  t.max_teams - COALESCE(COUNT(CASE WHEN tr.status = 'confirmed' THEN 1 END), 0) as slots_available
FROM tournaments t
LEFT JOIN tournament_registrations tr ON t.id = tr.tournament_id
WHERE t.status IN ('upcoming', 'registration_open', 'ongoing')
  AND (t.is_template = FALSE OR t.is_template IS NULL)
GROUP BY t.id, t.tournament_name, t.max_teams, t.status;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tournament_reg_counts_id 
ON mv_tournament_reg_counts(tournament_id);

-- =====================================================
-- 5. USER ACTIVITY SUMMARY View
-- Caches user participation metrics
-- Refresh: Daily
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity AS
SELECT 
  u.id as user_id,
  u.username,
  COUNT(DISTINCT tr.tournament_id) as tournaments_participated,
  COUNT(DISTINCT CASE WHEN tl.placement IS NOT NULL THEN tl.tournament_id END) as tournaments_with_results,
  COUNT(DISTINCT t.id) as tournaments_won,
  COALESCE(SUM(tl.prize_amount), 0) as total_earnings,
  MAX(tr.registered_at) as last_registration,
  u.created_at as member_since
FROM users u
LEFT JOIN tournament_registrations tr ON u.id = tr.user_id AND tr.status != 'cancelled'
LEFT JOIN tournament_leaderboard tl ON u.id = tl.user_id
LEFT JOIN tournaments t ON tl.tournament_id = t.id AND tl.placement = 1
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username, u.created_at;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_user_id 
ON mv_user_activity(user_id);

-- =====================================================
-- REFRESH FUNCTIONS
-- =====================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_players;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_teams;
  REFRESH MATERIALIZED VIEW mv_platform_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tournament_reg_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh just the leaderboard views (after tournament completion)
CREATE OR REPLACE FUNCTION refresh_leaderboard_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_players;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_teams;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh registration counts (after registration changes)
CREATE OR REPLACE FUNCTION refresh_registration_counts()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tournament_reg_counts;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FOR AUTO-REFRESH (Optional)
-- Uncomment if you want automatic refresh on data changes
-- Note: May impact write performance, use with caution
-- =====================================================

-- CREATE OR REPLACE FUNCTION trigger_refresh_reg_counts()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   -- Debounce by only refreshing every 60 seconds max
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_stat_activity 
--     WHERE query LIKE '%mv_tournament_reg_counts%'
--   ) THEN
--     PERFORM pg_notify('refresh_mv', 'tournament_reg_counts');
--   END IF;
--   RETURN NULL;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER tr_refresh_reg_counts
-- AFTER INSERT OR UPDATE OR DELETE ON tournament_registrations
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION trigger_refresh_reg_counts();

-- =====================================================
-- INITIAL DATA LOAD
-- Run this after creating the views
-- =====================================================

-- Refresh all views initially
SELECT refresh_all_materialized_views();

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Get top 10 players across all games:
-- SELECT * FROM mv_top_players ORDER BY first_place_wins DESC LIMIT 10;

-- Get top players for a specific game:
-- SELECT * FROM mv_top_players WHERE game_type = 'freefire' ORDER BY first_place_wins DESC LIMIT 10;

-- Get tournament slots availability:
-- SELECT tournament_name, registration_count, slots_available FROM mv_tournament_reg_counts WHERE slots_available > 0;

-- Get platform statistics:
-- SELECT * FROM mv_platform_stats;

-- =====================================================
-- MAINTENANCE NOTES
-- =====================================================

-- To manually refresh a view:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_players;

-- To check when a view was last refreshed:
-- SELECT relname, last_refresh FROM pg_matviews WHERE schemaname = 'public';

-- To check view sizes:
-- SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) 
-- FROM pg_class WHERE relkind = 'm';
