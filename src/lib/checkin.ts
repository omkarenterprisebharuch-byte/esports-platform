import pool from "@/lib/db";
import { PoolClient } from "pg";

// Default check-in window is 30 minutes before tournament start
const DEFAULT_CHECKIN_WINDOW_MINUTES = 30;

export interface CheckinStatus {
  isOpen: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  minutesUntilOpen: number;
  minutesUntilClose: number;
  tournamentStartsAt: Date;
}

export interface TeamCheckinStatus {
  registrationId: number;
  teamId: number | null;
  userId: number;
  teamName: string | null;
  username: string;
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  checkedIn: boolean;
  checkedInAt: Date | null;
  slotNumber: number;
}

export interface CheckinSummary {
  totalRegistered: number;
  totalWaitlisted: number;
  registeredCheckedIn: number;
  waitlistedCheckedIn: number;
  availableSlots: number;
  maxTeams: number;
  isFinalized: boolean;
  finalizedAt: Date | null;
}

/**
 * Get check-in window settings for a tournament
 */
export async function getCheckinSettings(tournamentId: string | number): Promise<{
  windowMinutes: number;
  autoFinalize: boolean;
  finalizedAt: Date | null;
}> {
  const result = await pool.query(
    `SELECT checkin_window_minutes, auto_finalize, finalized_at 
     FROM tournament_checkin_settings 
     WHERE tournament_id = $1`,
    [tournamentId]
  );

  if (result.rows.length > 0) {
    return {
      windowMinutes: result.rows[0].checkin_window_minutes || DEFAULT_CHECKIN_WINDOW_MINUTES,
      autoFinalize: result.rows[0].auto_finalize ?? true,
      finalizedAt: result.rows[0].finalized_at,
    };
  }

  return {
    windowMinutes: DEFAULT_CHECKIN_WINDOW_MINUTES,
    autoFinalize: true,
    finalizedAt: null,
  };
}

/**
 * Calculate if check-in window is open for a tournament
 */
export function calculateCheckinStatus(
  tournamentStartDate: Date,
  checkinWindowMinutes: number = DEFAULT_CHECKIN_WINDOW_MINUTES
): CheckinStatus {
  const now = new Date();
  const startDate = new Date(tournamentStartDate);
  
  // Check-in opens X minutes before tournament start
  const opensAt = new Date(startDate.getTime() - checkinWindowMinutes * 60 * 1000);
  // Check-in closes at tournament start
  const closesAt = startDate;
  
  const isOpen = now >= opensAt && now < closesAt;
  const minutesUntilOpen = Math.max(0, Math.floor((opensAt.getTime() - now.getTime()) / 60000));
  const minutesUntilClose = Math.max(0, Math.floor((closesAt.getTime() - now.getTime()) / 60000));

  return {
    isOpen,
    opensAt,
    closesAt,
    minutesUntilOpen,
    minutesUntilClose,
    tournamentStartsAt: startDate,
  };
}

/**
 * Check if a user/team can check in for a tournament
 */
export async function canCheckIn(
  tournamentId: string | number,
  userId: string | number
): Promise<{
  canCheckIn: boolean;
  reason?: string;
  registration?: TeamCheckinStatus;
  checkinStatus?: CheckinStatus;
}> {
  // Get tournament and check-in settings
  const tournamentResult = await pool.query(
    `SELECT t.*, tcs.checkin_window_minutes, tcs.finalized_at
     FROM tournaments t
     LEFT JOIN tournament_checkin_settings tcs ON t.id = tcs.tournament_id
     WHERE t.id = $1`,
    [tournamentId]
  );

  if (tournamentResult.rows.length === 0) {
    return { canCheckIn: false, reason: "Tournament not found" };
  }

  const tournament = tournamentResult.rows[0];
  const windowMinutes = tournament.checkin_window_minutes || DEFAULT_CHECKIN_WINDOW_MINUTES;

  // Check if already finalized
  if (tournament.finalized_at) {
    return { canCheckIn: false, reason: "Check-in has been finalized" };
  }

  // Calculate check-in status
  const checkinStatus = calculateCheckinStatus(tournament.tournament_start_date, windowMinutes);

  if (!checkinStatus.isOpen) {
    if (checkinStatus.minutesUntilOpen > 0) {
      return {
        canCheckIn: false,
        reason: `Check-in opens in ${checkinStatus.minutesUntilOpen} minutes`,
        checkinStatus,
      };
    } else {
      return {
        canCheckIn: false,
        reason: "Check-in window has closed",
        checkinStatus,
      };
    }
  }

  // Get user's registration
  const registrationResult = await pool.query(
    `SELECT 
      tr.id as registration_id,
      tr.team_id,
      tr.user_id,
      tr.is_waitlisted,
      tr.waitlist_position,
      tr.checked_in,
      tr.checked_in_at,
      tr.slot_number,
      tr.status,
      t.team_name,
      u.username
     FROM tournament_registrations tr
     LEFT JOIN teams t ON tr.team_id = t.id
     JOIN users u ON tr.user_id = u.id
     WHERE tr.tournament_id = $1 
       AND tr.user_id = $2
       AND tr.status IN ('registered', 'confirmed')`,
    [tournamentId, userId]
  );

  if (registrationResult.rows.length === 0) {
    return { canCheckIn: false, reason: "You are not registered for this tournament" };
  }

  const registration = registrationResult.rows[0];

  // Check if already checked in
  if (registration.checked_in) {
    return {
      canCheckIn: false,
      reason: "You have already checked in",
      registration: {
        registrationId: registration.registration_id,
        teamId: registration.team_id,
        userId: registration.user_id,
        teamName: registration.team_name,
        username: registration.username,
        isWaitlisted: registration.is_waitlisted,
        waitlistPosition: registration.waitlist_position,
        checkedIn: registration.checked_in,
        checkedInAt: registration.checked_in_at,
        slotNumber: registration.slot_number,
      },
      checkinStatus,
    };
  }

  return {
    canCheckIn: true,
    registration: {
      registrationId: registration.registration_id,
      teamId: registration.team_id,
      userId: registration.user_id,
      teamName: registration.team_name,
      username: registration.username,
      isWaitlisted: registration.is_waitlisted,
      waitlistPosition: registration.waitlist_position,
      checkedIn: false,
      checkedInAt: null,
      slotNumber: registration.slot_number,
    },
    checkinStatus,
  };
}

/**
 * Perform check-in for a user/team
 */
export async function performCheckin(
  tournamentId: string | number,
  userId: string | number
): Promise<{
  success: boolean;
  message: string;
  registration?: TeamCheckinStatus;
}> {
  const canCheckin = await canCheckIn(tournamentId, userId);

  if (!canCheckin.canCheckIn) {
    return {
      success: false,
      message: canCheckin.reason || "Cannot check in",
    };
  }

  // Update registration with check-in
  const result = await pool.query(
    `UPDATE tournament_registrations
     SET checked_in = TRUE, checked_in_at = NOW()
     WHERE tournament_id = $1 AND user_id = $2 AND status IN ('registered', 'confirmed')
     RETURNING id, team_id, user_id, is_waitlisted, waitlist_position, checked_in, checked_in_at, slot_number`,
    [tournamentId, userId]
  );

  if (result.rows.length === 0) {
    return { success: false, message: "Failed to check in" };
  }

  const updated = result.rows[0];

  return {
    success: true,
    message: updated.is_waitlisted
      ? "Checked in successfully! You are on the waitlist and may be promoted if registered teams don't check in."
      : "Checked in successfully!",
    registration: {
      registrationId: updated.id,
      teamId: updated.team_id,
      userId: updated.user_id,
      teamName: null,
      username: "",
      isWaitlisted: updated.is_waitlisted,
      waitlistPosition: updated.waitlist_position,
      checkedIn: updated.checked_in,
      checkedInAt: updated.checked_in_at,
      slotNumber: updated.slot_number,
    },
  };
}

/**
 * Get check-in summary for a tournament
 */
export async function getCheckinSummary(
  tournamentId: string | number
): Promise<CheckinSummary | null> {
  const result = await pool.query(
    `SELECT 
      t.max_teams,
      tcs.finalized_at,
      COUNT(CASE WHEN tr.is_waitlisted = FALSE AND tr.status IN ('registered', 'confirmed') THEN 1 END) as total_registered,
      COUNT(CASE WHEN tr.is_waitlisted = TRUE AND tr.status IN ('registered', 'confirmed') THEN 1 END) as total_waitlisted,
      COUNT(CASE WHEN tr.is_waitlisted = FALSE AND tr.checked_in = TRUE THEN 1 END) as registered_checked_in,
      COUNT(CASE WHEN tr.is_waitlisted = TRUE AND tr.checked_in = TRUE THEN 1 END) as waitlisted_checked_in
     FROM tournaments t
     LEFT JOIN tournament_checkin_settings tcs ON t.id = tcs.tournament_id
     LEFT JOIN tournament_registrations tr ON t.id = tr.tournament_id
     WHERE t.id = $1
     GROUP BY t.id, t.max_teams, tcs.finalized_at`,
    [tournamentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const registeredNotCheckedIn = parseInt(row.total_registered) - parseInt(row.registered_checked_in);

  return {
    totalRegistered: parseInt(row.total_registered),
    totalWaitlisted: parseInt(row.total_waitlisted),
    registeredCheckedIn: parseInt(row.registered_checked_in),
    waitlistedCheckedIn: parseInt(row.waitlisted_checked_in),
    availableSlots: registeredNotCheckedIn, // Slots that may go to waitlist
    maxTeams: parseInt(row.max_teams),
    isFinalized: !!row.finalized_at,
    finalizedAt: row.finalized_at,
  };
}

/**
 * Get all check-in statuses for a tournament
 */
export async function getAllCheckinStatuses(
  tournamentId: string | number
): Promise<TeamCheckinStatus[]> {
  const result = await pool.query(
    `SELECT 
      tr.id as registration_id,
      tr.team_id,
      tr.user_id,
      tr.is_waitlisted,
      tr.waitlist_position,
      tr.checked_in,
      tr.checked_in_at,
      tr.slot_number,
      t.team_name,
      u.username
     FROM tournament_registrations tr
     LEFT JOIN teams t ON tr.team_id = t.id
     JOIN users u ON tr.user_id = u.id
     WHERE tr.tournament_id = $1 AND tr.status IN ('registered', 'confirmed')
     ORDER BY tr.is_waitlisted ASC, tr.slot_number ASC, tr.waitlist_position ASC`,
    [tournamentId]
  );

  return result.rows.map((row) => ({
    registrationId: row.registration_id,
    teamId: row.team_id,
    userId: row.user_id,
    teamName: row.team_name,
    username: row.username,
    isWaitlisted: row.is_waitlisted,
    waitlistPosition: row.waitlist_position,
    checkedIn: row.checked_in || false,
    checkedInAt: row.checked_in_at,
    slotNumber: row.slot_number,
  }));
}

/**
 * Finalize check-ins and promote waitlist teams to fill empty slots
 * This should be called when the check-in window closes (at tournament start)
 */
export async function finalizeCheckins(
  tournamentId: string | number,
  client?: PoolClient
): Promise<{
  success: boolean;
  promotedCount: number;
  disqualifiedCount: number;
  promotedTeams: Array<{ userId: number; teamName: string | null; slotNumber: number }>;
  disqualifiedTeams: Array<{ userId: number; teamName: string | null }>;
}> {
  const db = client || pool;

  // Start transaction if no client provided
  const shouldCommit = !client;
  const conn = client || (await pool.connect());

  try {
    if (shouldCommit) {
      await conn.query("BEGIN");
    }

    // Check if already finalized
    const settingsResult = await conn.query(
      `SELECT finalized_at FROM tournament_checkin_settings WHERE tournament_id = $1`,
      [tournamentId]
    );

    if (settingsResult.rows.length > 0 && settingsResult.rows[0].finalized_at) {
      return {
        success: false,
        promotedCount: 0,
        disqualifiedCount: 0,
        promotedTeams: [],
        disqualifiedTeams: [],
      };
    }

    // Get registered teams that didn't check in
    const noShowsResult = await conn.query(
      `SELECT tr.id, tr.user_id, tr.slot_number, t.team_name, u.username
       FROM tournament_registrations tr
       LEFT JOIN teams t ON tr.team_id = t.id
       JOIN users u ON tr.user_id = u.id
       WHERE tr.tournament_id = $1 
         AND tr.is_waitlisted = FALSE 
         AND tr.checked_in = FALSE
         AND tr.status IN ('registered', 'confirmed')
       ORDER BY tr.slot_number ASC`,
      [tournamentId]
    );

    const noShows = noShowsResult.rows;
    const disqualifiedTeams = noShows.map((row) => ({
      userId: row.user_id,
      teamName: row.team_name || row.username,
    }));

    // Get waitlisted teams that checked in, ordered by check-in time
    const waitlistCheckedInResult = await conn.query(
      `SELECT tr.id, tr.user_id, tr.team_id, t.team_name, u.username, tr.checked_in_at
       FROM tournament_registrations tr
       LEFT JOIN teams t ON tr.team_id = t.id
       JOIN users u ON tr.user_id = u.id
       WHERE tr.tournament_id = $1 
         AND tr.is_waitlisted = TRUE 
         AND tr.checked_in = TRUE
         AND tr.status IN ('registered', 'confirmed')
       ORDER BY tr.checked_in_at ASC`,
      [tournamentId]
    );

    const waitlistCheckedIn = waitlistCheckedInResult.rows;
    const promotedTeams: Array<{ userId: number; teamName: string | null; slotNumber: number }> = [];

    // Promote waitlist teams to fill no-show slots
    const promotionCount = Math.min(noShows.length, waitlistCheckedIn.length);

    for (let i = 0; i < promotionCount; i++) {
      const noShow = noShows[i];
      const waitlistTeam = waitlistCheckedIn[i];

      // Mark no-show as disqualified/cancelled
      await conn.query(
        `UPDATE tournament_registrations 
         SET status = 'cancelled'
         WHERE id = $1`,
        [noShow.id]
      );

      // Promote waitlist team: give them the slot
      await conn.query(
        `UPDATE tournament_registrations 
         SET is_waitlisted = FALSE,
             waitlist_position = NULL,
             slot_number = $1,
             promoted_via_checkin = TRUE,
             original_slot_holder_id = $2,
             promoted_at = NOW()
         WHERE id = $3`,
        [noShow.slot_number, noShow.user_id, waitlistTeam.id]
      );

      promotedTeams.push({
        userId: waitlistTeam.user_id,
        teamName: waitlistTeam.team_name || waitlistTeam.username,
        slotNumber: noShow.slot_number,
      });
    }

    // Update tournament current_teams count
    const confirmedCountResult = await conn.query(
      `SELECT COUNT(*) as count 
       FROM tournament_registrations 
       WHERE tournament_id = $1 
         AND is_waitlisted = FALSE 
         AND status IN ('registered', 'confirmed')`,
      [tournamentId]
    );

    await conn.query(
      `UPDATE tournaments SET current_teams = $1 WHERE id = $2`,
      [confirmedCountResult.rows[0].count, tournamentId]
    );

    // Mark as finalized
    await conn.query(
      `INSERT INTO tournament_checkin_settings (tournament_id, finalized_at)
       VALUES ($1, NOW())
       ON CONFLICT (tournament_id) 
       DO UPDATE SET finalized_at = NOW(), updated_at = NOW()`,
      [tournamentId]
    );

    if (shouldCommit) {
      await conn.query("COMMIT");
    }

    return {
      success: true,
      promotedCount: promotedTeams.length,
      disqualifiedCount: noShows.length,
      promotedTeams,
      disqualifiedTeams,
    };
  } catch (error) {
    if (shouldCommit) {
      await conn.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (shouldCommit) {
      (conn as PoolClient).release();
    }
  }
}

/**
 * Get tournaments that need check-in finalization
 * (Tournament has started and check-in hasn't been finalized)
 */
export async function getTournamentsNeedingFinalization(): Promise<
  Array<{ id: number; tournament_name: string; tournament_start_date: Date }>
> {
  const result = await pool.query(
    `SELECT t.id, t.tournament_name, t.tournament_start_date
     FROM tournaments t
     LEFT JOIN tournament_checkin_settings tcs ON t.id = tcs.tournament_id
     WHERE t.tournament_start_date <= NOW()
       AND t.tournament_start_date > NOW() - INTERVAL '2 hours'
       AND t.status NOT IN ('completed', 'cancelled')
       AND (tcs.finalized_at IS NULL OR tcs.id IS NULL)
       AND EXISTS (
         SELECT 1 FROM tournament_registrations tr 
         WHERE tr.tournament_id = t.id AND tr.status IN ('registered', 'confirmed')
       )`
  );

  return result.rows;
}

/**
 * Get tournaments where check-in window is about to open (for sending reminders)
 */
export async function getTournamentsForCheckinReminder(
  minutesBefore: number = 35
): Promise<Array<{ id: number; tournament_name: string; tournament_start_date: Date }>> {
  const result = await pool.query(
    `SELECT t.id, t.tournament_name, t.tournament_start_date
     FROM tournaments t
     WHERE t.tournament_start_date BETWEEN NOW() + INTERVAL '${minutesBefore - 5} minutes' 
                                        AND NOW() + INTERVAL '${minutesBefore} minutes'
       AND t.status NOT IN ('completed', 'cancelled')
       AND EXISTS (
         SELECT 1 FROM tournament_registrations tr 
         WHERE tr.tournament_id = t.id 
           AND tr.status IN ('registered', 'confirmed')
           AND tr.check_in_reminder_sent = FALSE
       )`
  );

  return result.rows;
}
