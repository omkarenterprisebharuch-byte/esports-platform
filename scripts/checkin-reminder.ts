/**
 * Check-in Reminder Script
 * 
 * This script sends push notifications to all registered participants
 * when the check-in window opens for their tournaments.
 * 
 * Run with: npx ts-node scripts/checkin-reminder.ts
 * Or schedule as a cron job every minute
 */

import pool from "../src/lib/db";
import { sendNotification } from "../src/lib/notifications";

interface TournamentForReminder {
  id: number;
  name: string;
  game: string;
  tournament_start_date: Date;
  checkin_window_minutes: number;
}

interface RegistrationWithSubscription {
  registration_id: number;
  user_id: number;
  username: string;
  email: string;
  is_waitlisted: boolean;
}

async function sendCheckinReminders(): Promise<void> {
  console.log("🔔 Starting check-in reminder job...", new Date().toISOString());

  const client = await pool.connect();

  try {
    // Find tournaments where check-in window just opened (within last 2 minutes)
    // This ensures we don't send duplicate notifications
    const tournamentsResult = await client.query<TournamentForReminder>(`
      SELECT 
        t.id,
        t.name,
        t.game,
        t.tournament_start_date,
        COALESCE(tcs.checkin_window_minutes, 30) as checkin_window_minutes
      FROM tournaments t
      LEFT JOIN tournament_checkin_settings tcs ON t.id = tcs.tournament_id
      WHERE t.status = 'published'
        AND t.tournament_start_date > NOW()
        AND (
          t.tournament_start_date - INTERVAL '1 minute' * COALESCE(tcs.checkin_window_minutes, 30)
        ) BETWEEN NOW() - INTERVAL '2 minutes' AND NOW()
    `);

    if (tournamentsResult.rows.length === 0) {
      console.log("  No tournaments with newly opened check-in windows");
      return;
    }

    console.log(`  Found ${tournamentsResult.rows.length} tournament(s) with check-in opening`);

    for (const tournament of tournamentsResult.rows) {
      console.log(`\n  📣 Processing: ${tournament.name}`);

      // Get all registrations that haven't received a reminder yet
      const registrationsResult = await client.query<RegistrationWithSubscription>(`
        SELECT 
          tr.id as registration_id,
          tr.user_id,
          u.username,
          u.email,
          tr.is_waitlisted
        FROM tournament_registrations tr
        JOIN users u ON tr.user_id = u.id
        WHERE tr.tournament_id = $1
          AND tr.status IN ('registered', 'confirmed')
          AND tr.check_in_reminder_sent = false
      `, [tournament.id]);

      console.log(`     ${registrationsResult.rows.length} registrations to notify`);

      let sentCount = 0;

      for (const reg of registrationsResult.rows) {
        try {
          const title = reg.is_waitlisted
            ? "⏰ Waitlist Check-in Open!"
            : "✅ Check-in Now Open!";

          const body = reg.is_waitlisted
            ? `Check-in for ${tournament.name} is open! Check in now - if registered teams don't check in, you may get promoted!`
            : `Check-in for ${tournament.name} is now open! You have ${tournament.checkin_window_minutes} minutes to check in.`;

          await sendNotification({
            userId: String(reg.user_id),
            title,
            message: body,
            type: "reminder",
            category: "info",
            tournamentId: String(tournament.id),
            tournamentName: tournament.name,
            actionUrl: `/tournament/${tournament.id}`,
          });

          // Mark reminder as sent
          await client.query(`
            UPDATE tournament_registrations 
            SET check_in_reminder_sent = true 
            WHERE id = $1
          `, [reg.registration_id]);

          sentCount++;
        } catch (err) {
          console.error(`     Failed to notify user ${reg.username}:`, err);
        }
      }

      console.log(`     ✓ Sent ${sentCount} notifications`);
    }

    console.log("\n✅ Check-in reminder job completed");
  } catch (error) {
    console.error("❌ Error in check-in reminder job:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Run auto-finalization for tournaments that have started
async function autoFinalizeCheckins(): Promise<void> {
  console.log("\n🏁 Checking for tournaments to auto-finalize...");

  const client = await pool.connect();

  try {
    // Find tournaments that:
    // 1. Have started (tournament_start_date <= NOW)
    // 2. Have auto_finalize enabled
    // 3. Haven't been finalized yet
    const result = await client.query<{ id: number; name: string }>(`
      SELECT t.id, t.name
      FROM tournaments t
      JOIN tournament_checkin_settings tcs ON t.id = tcs.tournament_id
      WHERE t.tournament_start_date <= NOW()
        AND tcs.auto_finalize = true
        AND tcs.finalized_at IS NULL
        AND t.status = 'published'
    `);

    if (result.rows.length === 0) {
      console.log("  No tournaments to auto-finalize");
      return;
    }

    console.log(`  Found ${result.rows.length} tournament(s) to finalize`);

    for (const tournament of result.rows) {
      console.log(`\n  🏁 Auto-finalizing: ${tournament.name}`);

      try {
        // Call the finalize API internally
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/tournaments/${tournament.id}/checkin/finalize`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Use internal system auth
              "X-System-Auth": process.env.SYSTEM_AUTH_SECRET || "internal-cron",
            },
            body: JSON.stringify({ isSystemCall: true }),
          }
        );

        const data = await response.json();

        if (data.success) {
          console.log(`     ✓ Finalized: ${data.data.promotedCount} promoted, ${data.data.disqualifiedCount} disqualified`);
        } else {
          console.log(`     ⚠ ${data.message}`);
        }
      } catch (err) {
        console.error(`     ❌ Failed to finalize:`, err);
      }
    }
  } finally {
    client.release();
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    await sendCheckinReminders();
    await autoFinalizeCheckins();
  } catch (error) {
    console.error("Job failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
