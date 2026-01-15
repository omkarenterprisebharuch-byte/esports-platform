import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isOrganizer } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * Teams per lobby based on tournament type
 */
const TEAMS_PER_LOBBY: Record<string, number> = {
  solo: 48,
  duo: 24,
  squad: 12,
  clash_squad: 4,
  tdm: 4,
};

/**
 * Fisher-Yates shuffle algorithm for random array shuffling
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculate even distribution of teams across lobbies
 * Example: 50 teams with capacity 12 → 5 lobbies with [10, 10, 10, 10, 10]
 */
function calculateEvenDistribution(totalTeams: number, maxCapacity: number): number[] {
  if (totalTeams === 0) return [];
  if (totalTeams <= maxCapacity) return [totalTeams];
  
  const numLobbies = Math.ceil(totalTeams / maxCapacity);
  const baseTeams = Math.floor(totalTeams / numLobbies);
  const extraTeams = totalTeams % numLobbies;
  
  const distribution: number[] = [];
  for (let i = 0; i < numLobbies; i++) {
    // Distribute extra teams to first lobbies
    distribution.push(baseTeams + (i < extraTeams ? 1 : 0));
  }
  
  return distribution;
}

/**
 * POST /api/admin/tournament/[id]/lobbies/auto-assign
 * 
 * Automatically creates lobbies and assigns teams with:
 * - Dynamic lobby creation: ceil(T / C) lobbies
 * - Even distribution: Teams spread evenly across lobbies
 * - Random assignment: Teams shuffled before assignment
 * - Fresh start: Deletes existing lobbies and reassigns all teams
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id: tournamentId } = await params;

    // Verify ownership and get tournament details
    const tournamentResult = await client.query(
      `SELECT id, host_id, tournament_name, tournament_type FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];
    const canManage = tournament.host_id === user.id || isOrganizer(user.role);

    if (!canManage) {
      return unauthorizedResponse("You don't have permission to manage this tournament");
    }

    // Determine capacity per lobby based on tournament type
    const tournamentType = tournament.tournament_type?.toLowerCase() || 'squad';
    const maxCapacity = TEAMS_PER_LOBBY[tournamentType] || 12;

    // Get all registrations (excluding cancelled)
    const registrationsResult = await client.query(
      `SELECT tr.id, tr.team_id, tr.user_id, tr.slot_number,
              t.team_name, u.username
       FROM tournament_registrations tr
       LEFT JOIN teams t ON tr.team_id = t.id
       LEFT JOIN users u ON tr.user_id = u.id
       WHERE tr.tournament_id = $1 
         AND tr.status != 'cancelled'
         AND tr.is_waitlisted = FALSE
       ORDER BY tr.slot_number ASC`,
      [tournamentId]
    );

    const allTeams = registrationsResult.rows;
    const totalTeams = allTeams.length;

    // Edge case: No teams
    if (totalTeams === 0) {
      return successResponse({
        message: "No teams registered for this tournament",
        lobbies: [],
        distribution: [],
        summary: {
          totalTeams: 0,
          totalLobbies: 0,
          teamsPerLobby: maxCapacity,
        }
      });
    }

    // Calculate even distribution
    const distribution = calculateEvenDistribution(totalTeams, maxCapacity);
    const numLobbies = distribution.length;

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Clear all existing lobby assignments from registrations
    await client.query(
      `UPDATE tournament_registrations 
       SET lobby_id = NULL, updated_at = NOW()
       WHERE tournament_id = $1`,
      [tournamentId]
    );

    // Step 2: Delete all existing lobbies for this tournament
    await client.query(
      `DELETE FROM tournament_lobbies WHERE tournament_id = $1`,
      [tournamentId]
    );

    // Step 3: Create new lobbies with calculated distribution
    const createdLobbies: { id: number; name: string; maxTeams: number; assignedTeams: number }[] = [];
    
    for (let i = 0; i < numLobbies; i++) {
      const lobbyNumber = i + 1;
      const lobbyName = `Lobby ${lobbyNumber}`;
      const teamsForThisLobby = distribution[i];
      
      const lobbyResult = await client.query(
        `INSERT INTO tournament_lobbies 
         (tournament_id, lobby_name, lobby_number, max_teams, current_teams, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id, lobby_name, max_teams`,
        [tournamentId, lobbyName, lobbyNumber, maxCapacity, teamsForThisLobby]
      );
      
      createdLobbies.push({
        id: lobbyResult.rows[0].id,
        name: lobbyResult.rows[0].lobby_name,
        maxTeams: lobbyResult.rows[0].max_teams,
        assignedTeams: teamsForThisLobby
      });
    }

    // Step 4: Shuffle teams randomly
    const shuffledTeams = shuffleArray(allTeams);

    // Step 5: Assign shuffled teams to lobbies based on distribution
    const assignments: { 
      registrationId: string; 
      teamName: string;
      lobbyId: number; 
      lobbyName: string;
      lobbyNumber: number;
    }[] = [];
    
    let teamIndex = 0;
    for (let lobbyIdx = 0; lobbyIdx < numLobbies; lobbyIdx++) {
      const lobby = createdLobbies[lobbyIdx];
      const teamsForThisLobby = distribution[lobbyIdx];
      
      for (let j = 0; j < teamsForThisLobby; j++) {
        const team = shuffledTeams[teamIndex];
        
        await client.query(
          `UPDATE tournament_registrations 
           SET lobby_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [lobby.id, team.id]
        );
        
        assignments.push({
          registrationId: team.id,
          teamName: team.team_name || team.username || `Team ${team.slot_number}`,
          lobbyId: lobby.id,
          lobbyName: lobby.name,
          lobbyNumber: lobbyIdx + 1
        });
        
        teamIndex++;
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    // Build summary
    const lobbySummary = createdLobbies.map((lobby, idx) => ({
      lobbyNumber: idx + 1,
      lobbyName: lobby.name,
      teamsAssigned: distribution[idx],
      maxCapacity: lobby.maxTeams
    }));

    return successResponse({
      message: `Successfully created ${numLobbies} lobbies and assigned ${totalTeams} teams randomly with even distribution`,
      lobbies: createdLobbies,
      distribution: distribution,
      assignments: assignments,
      summary: {
        totalTeams,
        totalLobbies: numLobbies,
        teamsPerLobby: maxCapacity,
        distributionPattern: distribution.join(', '),
        lobbySummary
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Failed to auto-assign teams:", error);
    return serverErrorResponse("Failed to auto-assign teams");
  } finally {
    client.release();
  }
}
