import { NextRequest } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireEmailVerified } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  emailVerificationRequiredResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";
import {
  calculateWaitlistSlots,
  isWaitlistAvailable,
} from "@/lib/waitlist";
import { invalidateDbCache } from "@/lib/db-cache";

// Schema for tournament registration
const registerTournamentSchema = z.object({
  tournament_id: uuidSchema,
  team_id: uuidSchema.optional().nullable(),
  selected_players: z.array(uuidSchema).optional().nullable(),
  backup_players: z.array(uuidSchema).optional().nullable(),
  join_waitlist: z.boolean().optional().default(false),
});

// Custom error class for validation errors that should return specific responses
class ValidationError extends Error {
  constructor(message: string, public statusCode: number = 400, public data?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * POST /api/registrations/register
 * Register for a tournament
 * Requires email verification
 * Uses single connection for entire operation to avoid pool exhaustion
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and email verification
    const { user, verified } = requireEmailVerified(request);

    if (!user) {
      return unauthorizedResponse();
    }

    if (!verified) {
      return emailVerificationRequiredResponse(
        "Please verify your email address before registering for tournaments"
      );
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(registerTournamentSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { tournament_id, team_id, selected_players, backup_players, join_waitlist } = validation.data;

    // ============ SINGLE TRANSACTION FOR ALL OPERATIONS ============
    // Uses only ONE connection from the pool for the entire registration flow
    const result = await withTransaction(async (client) => {
      // Step 1: Fetch all required data in one query
      const dataResult = await client.query(
        `SELECT 
          t.*,
          t.current_teams,
          t.max_teams,
          u.id as user_db_id,
          u.username,
          u.in_game_ids,
          u.wallet_balance,
          u.hold_balance,
          (SELECT COUNT(*) FROM tournament_registrations 
           WHERE tournament_id = $1 AND is_waitlisted = TRUE AND status != 'cancelled') as waitlist_count,
          (SELECT id FROM tournament_registrations 
           WHERE tournament_id = $1 AND user_id = $2 AND status != 'cancelled' LIMIT 1) as existing_reg_id,
          (SELECT is_waitlisted FROM tournament_registrations 
           WHERE tournament_id = $1 AND user_id = $2 AND status != 'cancelled' LIMIT 1) as existing_is_waitlisted
         FROM tournaments t
         CROSS JOIN users u
         WHERE t.id = $1 AND u.id = $2`,
        [tournament_id, user.id]
      );

      if (dataResult.rows.length === 0) {
        throw new ValidationError("Tournament not found", 404);
      }

      const row = dataResult.rows[0];
      
      if (!row.user_db_id) {
        throw new ValidationError("User not found", 404);
      }

      // Check existing registration
      if (row.existing_reg_id) {
        if (row.existing_is_waitlisted) {
          throw new ValidationError("Already on waitlist");
        }
        throw new ValidationError("Already registered for this tournament");
      }

      const tournament = {
        id: row.id,
        tournament_name: row.tournament_name,
        game_type: row.game_type,
        tournament_type: row.tournament_type,
        entry_fee: parseFloat(row.entry_fee) || 0,
        status: row.status,
        current_teams: row.current_teams,
        max_teams: row.max_teams,
        tournament_start_date: row.tournament_start_date,
      };
      
      const dbUser = {
        id: row.user_db_id,
        username: row.username,
        in_game_ids: row.in_game_ids,
        wallet_balance: parseFloat(row.wallet_balance) || 0,
        hold_balance: parseFloat(row.hold_balance) || 0,
      };
      
      const waitlistCount = parseInt(row.waitlist_count) || 0;
      const gameType = tournament.game_type;
      const tournamentType = tournament.tournament_type;
      const entryFee = tournament.entry_fee;

      // Step 2: Validation checks
      if (tournament.status !== "registration_open" && tournament.status !== "upcoming") {
        throw new ValidationError("Registration is not open for this tournament");
      }

      // Validate game UID
      const userGameId = dbUser.in_game_ids?.[gameType];
      if (!userGameId) {
        throw new ValidationError(
          `Please add your ${gameType.toUpperCase()} game ID in your profile before registering`
        );
      }

      // Check available balance
      const availableBalance = Math.max(0, dbUser.wallet_balance - dbUser.hold_balance);
      if (entryFee > 0 && availableBalance < entryFee) {
        throw new ValidationError(
          `Insufficient available balance. Entry fee: ₹${entryFee}, Your available balance: ₹${availableBalance.toFixed(2)}. Please add funds to your wallet.`
        );
      }

      // Step 3: Lock tournament row and recheck capacity
      const lockResult = await client.query(
        `SELECT current_teams, max_teams FROM tournaments WHERE id = $1 FOR UPDATE`,
        [tournament_id]
      );
      const currentTeams = lockResult.rows[0].current_teams;
      const maxTeams = lockResult.rows[0].max_teams;
      const isFull = currentTeams >= maxTeams;

      // Handle full tournament
      if (isFull) {
        const waitlistCheck = isWaitlistAvailable(
          tournament.tournament_start_date,
          currentTeams,
          maxTeams
        );

        if (!waitlistCheck.available) {
          throw new ValidationError("Tournament is full");
        }

        if (!join_waitlist) {
          const maxWaitlistSlots = calculateWaitlistSlots(maxTeams);
          throw new ValidationError(
            `WAITLIST_AVAILABLE:${maxWaitlistSlots}:${waitlistCount}`,
            400,
            { waitlist_available: true, waitlist_slots_total: maxWaitlistSlots, waitlist_slots_taken: waitlistCount }
          );
        }

        const maxWaitlistSlots = calculateWaitlistSlots(maxTeams);
        if (waitlistCount >= maxWaitlistSlots) {
          throw new ValidationError("Tournament and waitlist are both full");
        }
      }

      // Step 4: Process registration based on tournament type
      let entryFeeDeducted = false;
      let entryFeeHeld = false;

      if (tournamentType === "solo") {
        // SOLO REGISTRATION
        if (isFull && join_waitlist) {
          // Waitlist registration
          const positionResult = await client.query(
            `SELECT COALESCE(MAX(waitlist_position), 0) + 1 as next_position 
             FROM tournament_registrations WHERE tournament_id = $1 AND is_waitlisted = TRUE`,
            [tournament_id]
          );
          const waitlistPosition = positionResult.rows[0].next_position;

          const regResult = await client.query(
            `INSERT INTO tournament_registrations 
             (tournament_id, user_id, registration_type, status, is_waitlisted, waitlist_position)
             VALUES ($1, $2, 'solo', 'registered', TRUE, $3)
             RETURNING *`,
            [tournament_id, user.id, waitlistPosition]
          );

          // Hold entry fee for waitlist
          if (entryFee > 0) {
            const newHoldBalance = dbUser.hold_balance + entryFee;
            await client.query(
              "UPDATE users SET hold_balance = $1, updated_at = NOW() WHERE id = $2",
              [newHoldBalance, user.id]
            );
            await client.query(
              `INSERT INTO balance_holds 
               (user_id, amount, hold_type, status, reference_type, reference_id, description)
               VALUES ($1, $2, 'waitlist_entry_fee', 'active', 'tournament_registration', $3, $4)`,
              [user.id, entryFee, regResult.rows[0].id.toString(), `Entry fee hold for waitlist: ${tournament.tournament_name}`]
            );
            entryFeeHeld = true;
          }

          return {
            registration: regResult.rows[0],
            waitlist_position: waitlistPosition,
            is_waitlisted: true,
            entry_fee_paid: 0,
            entry_fee_held: entryFeeHeld ? entryFee : 0,
          };
        }

        // Regular solo registration
        const slotResult = await client.query(
          `SELECT COALESCE(MAX(slot_number), 0) + 1 as next_slot 
           FROM tournament_registrations WHERE tournament_id = $1 AND is_waitlisted = FALSE`,
          [tournament_id]
        );
        const slotNumber = slotResult.rows[0].next_slot;

        const regResult = await client.query(
          `INSERT INTO tournament_registrations 
           (tournament_id, user_id, registration_type, slot_number, status, is_waitlisted)
           VALUES ($1, $2, 'solo', $3, 'registered', FALSE)
           RETURNING *`,
          [tournament_id, user.id, slotNumber]
        );

        await client.query(
          `UPDATE tournaments SET current_teams = current_teams + 1 WHERE id = $1`,
          [tournament_id]
        );

        // Deduct entry fee
        if (entryFee > 0) {
          const balanceAfter = dbUser.wallet_balance - entryFee;
          await client.query(
            "UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2",
            [balanceAfter, user.id]
          );
          await client.query(
            `INSERT INTO wallet_transactions 
             (user_id, amount, type, status, description, reference_id, balance_before, balance_after)
             VALUES ($1, $2, 'entry_fee', 'completed', $3, $4, $5, $6)`,
            [user.id, -entryFee, `Entry fee for tournament: ${tournament.tournament_name}`, tournament_id, dbUser.wallet_balance, balanceAfter]
          );
          entryFeeDeducted = true;
        }

        return {
          registration: regResult.rows[0],
          slot_number: slotNumber,
          is_waitlisted: false,
          entry_fee_paid: entryFeeDeducted ? entryFee : 0,
        };
      } else {
        // DUO/SQUAD REGISTRATION
        if (!team_id) {
          throw new ValidationError(`Team ID is required for ${tournamentType} tournaments`);
        }

        const memberCheck = await client.query(
          `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL`,
          [team_id, user.id]
        );
        if (memberCheck.rows.length === 0) {
          throw new ValidationError("You are not a member of this team");
        }

        // Check team already registered
        const existingTeamReg = await client.query(
          `SELECT id, is_waitlisted FROM tournament_registrations 
           WHERE tournament_id = $1 AND team_id = $2 AND status != 'cancelled'`,
          [tournament_id, team_id]
        );
        if (existingTeamReg.rows.length > 0) {
          if (existingTeamReg.rows[0].is_waitlisted) {
            throw new ValidationError("This team is already on the waitlist");
          }
          throw new ValidationError("This team is already registered for this tournament");
        }

        // Check selected players for bans - inline query using transaction client
        const playerIds = selected_players || [user.id];
        const playersResult = await client.query(
          `SELECT u.id, u.username, u.in_game_ids FROM users u WHERE u.id = ANY($1::int[])`,
          [playerIds]
        );

        const gameIdsToCheck = playersResult.rows
          .filter((p: { in_game_ids?: Record<string, string> }) => p.in_game_ids?.[gameType])
          .map((p: { in_game_ids: Record<string, string>; username: string }) => ({
            gameId: p.in_game_ids[gameType],
            gameType: gameType,
            username: p.username,
          }));

        // Inline ban check using transaction client to avoid separate pool connection
        if (gameIdsToCheck.length > 0) {
          const banConditions = gameIdsToCheck.map((_: unknown, i: number) => `(game_id = $${i * 2 + 1} AND game_type = $${i * 2 + 2})`);
          const banParams = gameIdsToCheck.flatMap((g: { gameId: string; gameType: string }) => [g.gameId, g.gameType]);
          
          const banResult = await client.query(
            `SELECT game_id, game_type, reason, is_permanent, ban_expires_at 
             FROM banned_game_ids
             WHERE (${banConditions.join(" OR ")})
             AND is_active = TRUE
             AND (is_permanent = TRUE OR ban_expires_at > NOW())`,
            banParams
          );
          
          // Check if any players are banned
          for (const banRow of banResult.rows) {
            const bannedPlayer = gameIdsToCheck.find((g: { gameId: string; gameType: string }) => 
              g.gameId === banRow.game_id && g.gameType === banRow.game_type
            );
            if (bannedPlayer) {
              const banMessage = banRow.is_permanent
                ? `permanently banned: ${banRow.reason || 'Violation of platform rules'}`
                : `temporarily banned until ${new Date(banRow.ban_expires_at).toLocaleDateString()}: ${banRow.reason || 'Violation of platform rules'}`;
              throw new ValidationError(`Player "${bannedPlayer.username}" cannot participate - ${banMessage}`);
            }
          }
        }

        if (isFull && join_waitlist) {
          // Waitlist team registration
          const positionResult = await client.query(
            `SELECT COALESCE(MAX(waitlist_position), 0) + 1 as next_position 
             FROM tournament_registrations WHERE tournament_id = $1 AND is_waitlisted = TRUE`,
            [tournament_id]
          );
          const waitlistPosition = positionResult.rows[0].next_position;

          const regResult = await client.query(
            `INSERT INTO tournament_registrations 
             (tournament_id, team_id, user_id, registration_type, status, is_waitlisted, waitlist_position, selected_players, backup_players)
             VALUES ($1, $2, $3, $4, 'registered', TRUE, $5, $6, $7)
             RETURNING *`,
            [tournament_id, team_id, user.id, tournamentType, waitlistPosition,
             JSON.stringify(selected_players || [user.id]), JSON.stringify(backup_players || [])]
          );

          if (entryFee > 0) {
            const newHoldBalance = dbUser.hold_balance + entryFee;
            await client.query(
              "UPDATE users SET hold_balance = $1, updated_at = NOW() WHERE id = $2",
              [newHoldBalance, user.id]
            );
            await client.query(
              `INSERT INTO balance_holds 
               (user_id, amount, hold_type, status, reference_type, reference_id, description)
               VALUES ($1, $2, 'waitlist_entry_fee', 'active', 'tournament_registration', $3, $4)`,
              [user.id, entryFee, regResult.rows[0].id.toString(), `Entry fee hold for waitlist: ${tournament.tournament_name}`]
            );
            entryFeeHeld = true;
          }

          return {
            registration: regResult.rows[0],
            waitlist_position: waitlistPosition,
            is_waitlisted: true,
            entry_fee_paid: 0,
            entry_fee_held: entryFeeHeld ? entryFee : 0,
          };
        }

        // Regular team registration
        const slotResult = await client.query(
          `SELECT COALESCE(MAX(slot_number), 0) + 1 as next_slot 
           FROM tournament_registrations WHERE tournament_id = $1 AND is_waitlisted = FALSE`,
          [tournament_id]
        );
        const slotNumber = slotResult.rows[0].next_slot;

        const regResult = await client.query(
          `INSERT INTO tournament_registrations 
           (tournament_id, team_id, user_id, registration_type, slot_number, selected_players, backup_players, status, is_waitlisted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered', FALSE)
           RETURNING *`,
          [tournament_id, team_id, user.id, tournamentType, slotNumber,
           JSON.stringify(selected_players || [user.id]), JSON.stringify(backup_players || [])]
        );

        await client.query(
          `UPDATE tournaments SET current_teams = current_teams + 1 WHERE id = $1`,
          [tournament_id]
        );

        if (entryFee > 0) {
          const balanceAfter = dbUser.wallet_balance - entryFee;
          await client.query(
            "UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2",
            [balanceAfter, user.id]
          );
          await client.query(
            `INSERT INTO wallet_transactions 
             (user_id, amount, type, status, description, reference_id, balance_before, balance_after)
             VALUES ($1, $2, 'entry_fee', 'completed', $3, $4, $5, $6)`,
            [user.id, -entryFee, `Entry fee for tournament: ${tournament.tournament_name}`, tournament_id, dbUser.wallet_balance, balanceAfter]
          );
          entryFeeDeducted = true;
        }

        return {
          registration: regResult.rows[0],
          slot_number: slotNumber,
          is_waitlisted: false,
          entry_fee_paid: entryFeeDeducted ? entryFee : 0,
        };
      }
    });

    // Build success message
    let message = result.is_waitlisted
      ? `Added to waitlist at position ${result.waitlist_position}`
      : "Successfully registered for the tournament";
    
    if (result.entry_fee_paid && result.entry_fee_paid > 0) {
      message += ` (₹${result.entry_fee_paid} deducted from wallet)`;
    } else if (result.entry_fee_held && result.entry_fee_held > 0) {
      message += ` (₹${result.entry_fee_held} held from wallet)`;
    }

    // Invalidate caches
    await invalidateDbCache.registration(user.id, tournament_id);

    return successResponse(result, message, 201);
  } catch (error) {
    console.error("Registration error:", error);
    
    if (error instanceof ValidationError) {
      // Handle waitlist available specially
      if (error.message.startsWith("WAITLIST_AVAILABLE:")) {
        const parts = error.message.split(":");
        const maxSlots = parseInt(parts[1]);
        const currentCount = parseInt(parts[2]);
        return new Response(
          JSON.stringify({
            success: false,
            message: "Tournament is full",
            error: "WAITLIST_AVAILABLE",
            data: {
              waitlist_available: true,
              waitlist_slots_total: maxSlots,
              waitlist_slots_taken: currentCount,
              waitlist_slots_remaining: maxSlots - currentCount,
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      return errorResponse(error.message, error.statusCode);
    }
    
    if (error instanceof Error) {
      return errorResponse(error.message);
    }
    return serverErrorResponse(error);
  }
}
