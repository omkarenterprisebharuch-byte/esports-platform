"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { secureFetch, getCachedUser } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { GameBadge, StatusBadge, RoleBadge } from "@/components/app/Badges";
import { StatCard } from "@/components/app/StatCard";

interface Tournament {
  id: string;
  tournament_name: string;
  game_type: string;
  tournament_type: string;
  entry_fee: string | number;
  status: string;
  current_teams: number;
  max_teams: number;
  prize_pool: string | number;
  registration_start_date: string;
  registration_end_date: string;
  tournament_start_date: string;
}

interface Team {
  id: number;
  team_name: string;
  team_code: string;
  invite_code: string;
  game_type: string | null;
  total_members: number;
  max_members: number;
  role: string;
  game_uid: string;
  game_name: string;
  captain_name: string;
  captain_id: number;
  is_captain: boolean;
}

interface TeamMember {
  id: number;
  user_id: string;
  role: string;
  game_uid: string;
  game_name: string;
  username: string;
  avatar_url: string | null;
}

/**
 * Team Registration Page
 * 
 * For Duo/Squad tournaments, allows users to:
 * 1. Select a team to register with
 * 2. Select players for the tournament
 * 3. Complete registration
 */
export default function TeamRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;

  // Data states
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [eligibleTeams, setEligibleTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  
  // Message state
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Helper function to check if two game types match
  const gameTypesMatch = (tournamentGame: string | undefined, teamGame: string | null | undefined): boolean => {
    if (!tournamentGame || !teamGame) return false;
    
    const normalizedTournament = tournamentGame.toLowerCase().trim();
    const normalizedTeam = teamGame.toLowerCase().trim();
    
    // Direct match
    if (normalizedTournament === normalizedTeam) return true;
    
    // BGMI and PUBG are considered equivalent
    const bgmiPubgVariants = ["bgmi", "pubg", "pubg mobile", "battlegrounds mobile india"];
    if (bgmiPubgVariants.includes(normalizedTournament) && bgmiPubgVariants.includes(normalizedTeam)) {
      return true;
    }
    
    // Free Fire variants
    const freeFireVariants = ["freefire", "free fire", "ff"];
    if (freeFireVariants.includes(normalizedTournament) && freeFireVariants.includes(normalizedTeam)) {
      return true;
    }
    
    return false;
  };

  // Fetch tournament and teams
  const fetchData = useCallback(async () => {
    try {
      const [tournamentRes, teamsRes] = await Promise.all([
        secureFetch(`/api/tournaments/${tournamentId}`),
        secureFetch("/api/teams/my-teams"),
      ]);

      const tournamentData = await tournamentRes.json();
      const teamsData = await teamsRes.json();

      if (tournamentData.success) {
        const t = tournamentData.data.tournament;
        setTournament(t);

        // Store all teams
        if (teamsData.success && teamsData.data.teams) {
          const allTeams: Team[] = teamsData.data.teams;
          setTeams(allTeams);
          
          // Filter teams by game type
          const tournamentGameType = t.game_type;
          console.log('[GAME FILTER] Tournament game_type:', tournamentGameType);
          console.log('[GAME FILTER] All teams:', allTeams.map(team => ({ name: team.team_name, game_type: team.game_type })));
          
          const filtered = allTeams.filter((team) => {
            const match = gameTypesMatch(tournamentGameType, team.game_type);
            console.log(`[GAME FILTER] Team ${team.team_name} (${team.game_type}): ${match ? 'MATCH' : 'NO MATCH'}`);
            return match;
          });
          
          console.log('[GAME FILTER] Filtered teams:', filtered.map(team => team.team_name));
          setEligibleTeams(filtered);
        }
      } else {
        setMessage({ type: "error", text: "Tournament not found" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
    // Get current user ID from cached user
    const cachedUser = getCachedUser();
    if (cachedUser?.id) {
      setCurrentUserId(null); // Will be set properly when team is selected
    }
  }, [fetchData]);

  // Fetch team members when a team is selected
  const handleTeamSelect = async (team: Team) => {
    setSelectedTeam(team);
    setSelectedPlayers([]);
    setMembersLoading(true);

    try {
      // First fetch current user profile to get user_id
      const userRes = await secureFetch("/api/users/profile");
      const userData = await userRes.json();
      let loggedInUserId: string | null = null;
      
      if (userData.success && userData.data?.user?.id) {
        loggedInUserId = userData.data.user.id;
        setCurrentUserId(loggedInUserId);
      }

      const res = await secureFetch(`/api/teams/${team.id}`);
      const data = await res.json();

      if (data.success && data.data.team?.members) {
        const members = data.data.team.members;
        setTeamMembers(members);
        
        // Auto-select ONLY the logged-in user (mandatory captain rule)
        // The logged-in user MUST be selected and cannot be unselected
        if (loggedInUserId) {
          const loggedInMember = members.find((m: TeamMember) => m.user_id === loggedInUserId);
          if (loggedInMember) {
            setSelectedPlayers([loggedInMember.user_id]);
          }
        }
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load team members" });
    } finally {
      setMembersLoading(false);
    }
  };

  // Toggle player selection
  // Rules:
  // 1. Logged-in user (captain) cannot be unselected - they are mandatory
  // 2. Cannot select more than required players (2 for Duo, 4 for Squad)
  const togglePlayer = (userId: string) => {
    const required = getRequiredPlayers();
    
    setSelectedPlayers(prev => {
      // If trying to unselect the logged-in user (captain), prevent it
      if (prev.includes(userId) && userId === currentUserId) {
        setMessage({ type: "error", text: "You cannot unselect yourself. The registering player is mandatory." });
        return prev;
      }
      
      if (prev.includes(userId)) {
        // Unselecting a player (not the captain)
        return prev.filter(id => id !== userId);
      } else {
        // Selecting a new player - check if we've reached the limit
        if (prev.length >= required.max) {
          setMessage({ type: "error", text: `You can only select ${required.max} players for this ${tournament?.tournament_type} tournament.` });
          return prev;
        }
        return [...prev, userId];
      }
    });
  };

  // Check if a player is the mandatory captain (logged-in user)
  const isMandatoryCaptain = (userId: string) => {
    return userId === currentUserId;
  };

  // Get required player count based on tournament type
  const getRequiredPlayers = () => {
    if (!tournament) return { min: 1, max: 4 };
    switch (tournament.tournament_type.toLowerCase()) {
      case "duo":
        return { min: 2, max: 2 };
      case "squad":
        return { min: 4, max: 4 };
      default:
        return { min: 1, max: 4 };
    }
  };

  // Handle registration
  const handleRegister = async () => {
    if (!selectedTeam) {
      setMessage({ type: "error", text: "Please select a team" });
      return;
    }

    const required = getRequiredPlayers();
    if (selectedPlayers.length < required.min || selectedPlayers.length > required.max) {
      setMessage({ 
        type: "error", 
        text: `Please select exactly ${required.min === required.max ? required.min : `${required.min}-${required.max}`} players` 
      });
      return;
    }

    setRegistering(true);
    setMessage(null);

    try {
      // Prepare payload: team_id is a number, selected_players are UUID strings
      const payload = {
        tournament_id: tournamentId,
        team_id: selectedTeam.id, // Keep as number - teams use integer IDs
        selected_players: selectedPlayers.map(id => String(id)), // User IDs are UUIDs
      };
      
      const res = await secureFetch("/api/registrations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Successfully registered!" });
        // Redirect to tournament page after success
        setTimeout(() => {
          router.push(`/app/tournament/${tournamentId}`);
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.message || "Registration failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to register. Please try again." });
    } finally {
      setRegistering(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tournament Not Found" />
        <EmptyState
          icon="🎮"
          title="Tournament not found"
          description="The tournament you're looking for doesn't exist or has been removed."
          action={{ label: "Browse Tournaments", onClick: () => router.push("/app/tournaments") }}
          variant="card"
        />
      </div>
    );
  }

  const required = getRequiredPlayers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Team Registration"
        subtitle={`Register for ${tournament.tournament_name}`}
        backLink={{ href: `/app/tournament/${tournamentId}`, label: "Back to Tournament" }}
      />

      {/* Message */}
      {message && (
        <div className={`
          px-4 py-3 rounded-xl
          ${message.type === "success" 
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" 
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }
        `}>
          {message.text}
        </div>
      )}

      {/* Tournament Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              {tournament.tournament_name}
            </h2>
            <div className="flex items-center gap-2">
              <GameBadge game={tournament.game_type} />
              <StatusBadge status={tournament.status} />
              <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {tournament.tournament_type}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ₹{Number(tournament.entry_fee || 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Entry Fee</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {tournament.current_teams}/{tournament.max_teams}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Slots Filled</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              ₹{Number(tournament.prize_pool || 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Prize Pool</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {required.min === required.max ? required.min : `${required.min}-${required.max}`}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Players Needed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(tournament.tournament_start_date)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Start Time</div>
          </div>
        </div>
      </div>

      {/* Step 1: Team Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm flex items-center justify-center">1</span>
          Select Team
        </h3>

        {/* Teams filtered by game type - only show teams that match tournament game */}
        {eligibleTeams.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No teams available for this game"
            description="You don't have any teams for this game type. Create a team or join one to register."
            action={{ label: "Create Team", onClick: () => router.push("/app/teams") }}
            secondaryAction={{ label: "My Teams", onClick: () => router.push("/app/teams") }}
            variant="minimal"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eligibleTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleTeamSelect(team)}
                className={`
                  p-4 rounded-xl border-2 text-left transition-all
                  ${selectedTeam?.id === team.id
                    ? "border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-700"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{team.team_name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Captain: {team.captain_name}
                    </div>
                  </div>
                  <RoleBadge role={team.is_captain ? "captain" : "member"} />
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span>👥 {team.total_members}/{team.max_members}</span>
                  <span>🆔 {team.team_code}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Player Selection */}
      {selectedTeam && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm flex items-center justify-center">2</span>
            Select Players
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({selectedPlayers.length}/{required.min === required.max ? required.min : `${required.min}-${required.max}`} selected)
            </span>
          </h3>

          {/* Selection instructions */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">
            <p>
              <strong>Selection Rules:</strong> Select exactly {required.min === required.max ? required.min : `${required.min}-${required.max}`} players for this {tournament?.tournament_type?.toLowerCase()} match. 
              You (the registering player) are automatically selected and required to participate.
            </p>
          </div>

          {membersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No members found in this team</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {teamMembers.map((member) => {
                const isCurrentUser = isMandatoryCaptain(member.user_id);
                const isSelected = selectedPlayers.includes(member.user_id);
                
                return (
                  <button
                    key={member.user_id}
                    onClick={() => togglePlayer(member.user_id)}
                    className={`
                      p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3
                      ${isSelected
                        ? isCurrentUser
                          ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/30" // Locked mandatory captain
                          : "border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-700"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }
                    `}
                  >
                    <div className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${isSelected
                        ? isCurrentUser
                          ? "border-green-500 dark:border-green-400 bg-green-500 dark:bg-green-400" // Locked mandatory captain
                          : "border-gray-900 dark:border-white bg-gray-900 dark:bg-white"
                        : "border-gray-300 dark:border-gray-600"
                      }
                    `}>
                      {isSelected && (
                        isCurrentUser ? (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-white dark:text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {member.username}
                        <RoleBadge role={member.role} />
                        {isCurrentUser && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full">
                            You (Required)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {member.game_name} • {member.game_uid}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm Registration */}
      {selectedTeam && selectedPlayers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm flex items-center justify-center">3</span>
            Confirm Registration
          </h3>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Team</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedTeam.team_name}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Players</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedPlayers.length} selected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Entry Fee</span>
              <span className="font-bold text-lg text-gray-900 dark:text-white">₹{Number(tournament.entry_fee || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/app/tournament/${tournamentId}`}
              className="flex-1 py-3 text-center border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </Link>
            <button
              onClick={handleRegister}
              disabled={registering || selectedPlayers.length < required.min}
              className="flex-1 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registering ? "Registering..." : "Confirm Registration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
