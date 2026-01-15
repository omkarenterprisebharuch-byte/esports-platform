"use client";

import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api-client";
import { TournamentWithHost } from "@/types";
import { GameBadge, StatusBadge, Modal, FormField } from "@/components/app";

// Teams per lobby based on mode (from league-config)
const TEAMS_PER_LOBBY: Record<string, number> = {
  solo: 48,
  duo: 24,
  squad: 12,
};

interface Lobby {
  id: number;
  lobby_name: string;
  lobby_number: number;
  room_id?: string;
  room_password?: string;
  max_teams: number;
  current_teams: number;
  status: string;
  created_at: string;
}

interface Player {
  id: string;
  username: string;
  in_game_name?: string;
  in_game_id?: string;
}

interface Team {
  id: number;
  team_name: string;
  leader_name: string;
  leader_id: string;
  slot_number: number;
  lobby_id?: number;
  players?: Player[];
  registration_type: string;
}

export default function ManageTournamentPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<TournamentWithHost | null>(null);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Expanded states for 3-layer UI
  const [expandedLobbies, setExpandedLobbies] = useState<Set<number | string>>(new Set(["unassigned"]));
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

  // Create Lobby Modal
  const [createLobbyModal, setCreateLobbyModal] = useState(false);
  const [lobbyForm, setLobbyForm] = useState({
    lobby_name: "",
    max_teams: 12,
  });
  const [creatingLobby, setCreatingLobby] = useState(false);

  // Room Credentials Modal
  const [roomModal, setRoomModal] = useState<{ show: boolean; lobby: Lobby | null }>({
    show: false,
    lobby: null,
  });
  const [roomCredentials, setRoomCredentials] = useState({ room_id: "", room_password: "" });
  const [savingRoom, setSavingRoom] = useState(false);

  // Notification Modal
  const [notificationModal, setNotificationModal] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    message: "",
    target: "all" as "all" | "lobby",
    selectedLobbyId: null as number | null,
  });
  const [sendingNotification, setSendingNotification] = useState(false);

  // Setup lobbies state (combines lobby creation + team assignment)
  const [settingUpLobbies, setSettingUpLobbies] = useState(false);

  const fetchTournament = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/tournaments/${tournamentId}`);
      const data = await res.json();
      if (data.success) {
        setTournament(data.data.tournament);
      } else {
        setMessage({ type: "error", text: "Tournament not found" });
      }
    } catch (error) {
      console.error("Failed to fetch tournament:", error);
      setMessage({ type: "error", text: "Failed to load tournament" });
    }
  }, [tournamentId]);

  const fetchLobbies = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/admin/tournament/${tournamentId}/lobbies`);
      const data = await res.json();
      if (data.success) {
        setLobbies(data.data.lobbies || []);
      }
    } catch (error) {
      console.error("Failed to fetch lobbies:", error);
    }
  }, [tournamentId]);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/tournaments/${tournamentId}/registrations?include_players=true`);
      const data = await res.json();
      if (data.success) {
        setTeams(data.data.registrations || []);
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    }
  }, [tournamentId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTournament(), fetchLobbies(), fetchTeams()]);
      setLoading(false);
    };
    loadData();
  }, [fetchTournament, fetchLobbies, fetchTeams]);

  // Toggle lobby expansion
  const toggleLobby = (lobbyId: number | string) => {
    setExpandedLobbies(prev => {
      const next = new Set(prev);
      if (next.has(lobbyId)) {
        next.delete(lobbyId);
      } else {
        next.add(lobbyId);
      }
      return next;
    });
  };

  // Toggle team expansion
  const toggleTeam = (teamId: number) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  // Group teams by lobby
  const getTeamsByLobby = (lobbyId: number | null) => {
    return teams.filter(team => 
      lobbyId === null ? !team.lobby_id : team.lobby_id === lobbyId
    );
  };

  // Create Lobby
  const handleCreateLobby = async () => {
    if (!lobbyForm.lobby_name.trim()) {
      setMessage({ type: "error", text: "Lobby name is required" });
      return;
    }

    setCreatingLobby(true);
    try {
      const res = await secureFetch(`/api/admin/tournament/${tournamentId}/lobbies`, {
        method: "POST",
        body: JSON.stringify(lobbyForm),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: "Lobby created successfully!" });
        setCreateLobbyModal(false);
        setLobbyForm({ lobby_name: "", max_teams: 12 });
        fetchLobbies();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to create lobby" });
      }
    } catch (error) {
      console.error("Failed to create lobby:", error);
      setMessage({ type: "error", text: "Failed to create lobby" });
    } finally {
      setCreatingLobby(false);
    }
  };

  // Save Room Credentials
  const handleSaveRoomCredentials = async () => {
    if (!roomModal.lobby) return;

    if (!roomCredentials.room_id.trim() || !roomCredentials.room_password.trim()) {
      setMessage({ type: "error", text: "Both Room ID and Password are required" });
      return;
    }

    setSavingRoom(true);
    try {
      const res = await secureFetch(`/api/admin/tournament/${tournamentId}/lobbies/${roomModal.lobby.id}/room`, {
        method: "PUT",
        body: JSON.stringify(roomCredentials),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: "Room credentials saved!" });
        setRoomModal({ show: false, lobby: null });
        fetchLobbies();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to save credentials" });
      }
    } catch (error) {
      console.error("Failed to save room credentials:", error);
      setMessage({ type: "error", text: "Failed to save room credentials" });
    } finally {
      setSavingRoom(false);
    }
  };

  // Send Room Credentials to Teams
  const handleSendRoomToTeams = async (lobby: Lobby) => {
    if (!lobby.room_id || !lobby.room_password) {
      setMessage({ type: "error", text: "Set room credentials first!" });
      return;
    }

    try {
      const res = await secureFetch(`/api/admin/tournament/${tournamentId}/lobbies/${lobby.id}/send-room`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: "Room credentials sent to all teams!" });
      } else {
        setMessage({ type: "error", text: data.message || "Failed to send credentials" });
      }
    } catch (error) {
      console.error("Failed to send room credentials:", error);
      setMessage({ type: "error", text: "Failed to send room credentials" });
    }
  };

  // Send Notification
  const handleSendNotification = async () => {
    if (!notificationForm.message.trim()) {
      setMessage({ type: "error", text: "Message is required" });
      return;
    }

    if (notificationForm.target === "lobby" && !notificationForm.selectedLobbyId) {
      setMessage({ type: "error", text: "Please select a lobby" });
      return;
    }

    setSendingNotification(true);
    try {
      const res = await secureFetch(`/api/admin/tournament/${tournamentId}/notifications`, {
        method: "POST",
        body: JSON.stringify({
          message: notificationForm.message,
          target: notificationForm.target,
          lobby_id: notificationForm.selectedLobbyId,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: "Notification sent successfully!" });
        setNotificationModal(false);
        setNotificationForm({ message: "", target: "all", selectedLobbyId: null });
      } else {
        setMessage({ type: "error", text: data.message || "Failed to send notification" });
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
      setMessage({ type: "error", text: "Failed to send notification" });
    } finally {
      setSendingNotification(false);
    }
  };

  // Setup lobbies: Creates lobbies dynamically and assigns all teams randomly with even distribution
  // Behavior:
  // - Deletes existing lobbies and reassigns all teams fresh
  // - Creates ceil(T / C) lobbies dynamically
  // - Distributes teams evenly (e.g., 50 teams / 5 lobbies = 10 each)
  // - Assigns teams randomly (not by registration order)
  const handleSetupLobbies = async () => {
    if (!tournament) return;
    
    const totalTeams = teams.length;
    if (totalTeams === 0) {
      setMessage({ type: "error", text: "No teams registered yet" });
      return;
    }

    // Confirm if lobbies already exist (will be reset)
    if (lobbies.length > 0) {
      const confirmed = window.confirm(
        `This will delete ${lobbies.length} existing lobbies and reassign all ${totalTeams} teams randomly. Continue?`
      );
      if (!confirmed) return;
    }

    setSettingUpLobbies(true);
    
    try {
      // Single API call handles everything:
      // 1. Delete existing lobbies
      // 2. Create new lobbies based on team count
      // 3. Shuffle teams randomly
      // 4. Distribute evenly across lobbies
      const res = await secureFetch(`/api/admin/tournament/${tournamentId}/lobbies/auto-assign`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const { summary } = data.data;
        setMessage({ 
          type: "success", 
          text: `Created ${summary.totalLobbies} lobbies and assigned ${summary.totalTeams} teams randomly (${summary.distributionPattern} teams per lobby)` 
        });
        // Refresh both teams and lobbies
        await Promise.all([fetchTeams(), fetchLobbies()]);
      } else {
        setMessage({ type: "error", text: data.message || data.data?.message || "Failed to setup lobbies" });
      }
    } catch (error) {
      console.error("Failed to setup lobbies:", error);
      setMessage({ type: "error", text: "Failed to setup lobbies" });
    } finally {
      setSettingUpLobbies(false);
    }
  };

  // Calculate lobby info for display
  const getLobbyInfo = () => {
    if (!tournament) return null;
    const mode = tournament.tournament_type as keyof typeof TEAMS_PER_LOBBY;
    const teamsPerLobby = TEAMS_PER_LOBBY[mode] || 12;
    const totalTeams = teams.length;
    const neededLobbies = Math.ceil(totalTeams / teamsPerLobby);
    return { teamsPerLobby, totalTeams, neededLobbies, currentLobbies: lobbies.length };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tournament not found</h2>
        <Link href="/admin" className="text-indigo-600 hover:underline mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message Toast */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg ${
            message.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-2 hover:opacity-80">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <GameBadge game={tournament.game_type} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {tournament.tournament_name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {tournament.tournament_type.toUpperCase()} • {tournament.map_name || "TBD"}
                </span>
                <StatusBadge status={tournament.status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/app/tournament/${tournament.id}`}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm font-medium"
            >
              View Public Page
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Teams</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{tournament.current_teams}/{tournament.max_teams}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Lobbies Created</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{lobbies.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Entry Fee</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{tournament.entry_fee}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Prize Pool</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">₹{tournament.prize_pool.toLocaleString()}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSetupLobbies}
              disabled={settingUpLobbies}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 transition flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {settingUpLobbies ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              )}
              {settingUpLobbies ? "Setting Up..." : "Setup Lobbies & Assign Teams"}
            </button>
            <button
              onClick={() => setNotificationModal(true)}
              className="px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-500/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Send Notification
            </button>
          </div>
          {/* Lobby calculation info */}
          {(() => {
            const info = getLobbyInfo();
            if (!info) return null;
            return (
              <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-4 py-2 rounded-lg">
                <span className="font-medium text-gray-700 dark:text-gray-300">{info.totalTeams}</span> teams ÷{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">{info.teamsPerLobby}</span> per lobby ={" "}
                <span className={`font-bold ${info.currentLobbies >= info.neededLobbies ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {info.neededLobbies} lobbies needed
                </span>
                {info.currentLobbies > 0 && (
                  <span className="ml-2 text-gray-400">({info.currentLobbies} created)</span>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 3-Layer Teams & Lobbies Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Teams & Lobbies</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {teams.length} teams • {lobbies.length} lobbies
          </span>
        </div>

        <div className="space-y-4">
          {/* Lobbies with their teams - Layer 1 */}
          {lobbies.map(lobby => {
            const lobbyTeams = getTeamsByLobby(lobby.id);
            const isLobbyExpanded = expandedLobbies.has(lobby.id);

            return (
              <div key={lobby.id} className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                {/* Lobby Header - Clickable to expand */}
                <button
                  onClick={() => toggleLobby(lobby.id)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-750 dark:hover:to-gray-700 transition text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{lobby.lobby_number}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">{lobby.lobby_name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {lobbyTeams.length} teams / {lobby.max_teams} max
                        </span>
                        {lobby.room_id && (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Room Set
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setRoomModal({ show: true, lobby });
                          setRoomCredentials({
                            room_id: lobby.room_id || "",
                            room_password: lobby.room_password || "",
                          });
                        }}
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition text-sm font-medium"
                      >
                        Set Room
                      </button>
                      {lobby.room_id && lobby.room_password && (
                        <button
                          onClick={() => handleSendRoomToTeams(lobby)}
                          className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition text-sm font-medium"
                        >
                          Send to Teams
                        </button>
                      )}
                    </div>
                    <svg 
                      className={`w-6 h-6 text-gray-400 transition-transform ${isLobbyExpanded ? "rotate-180" : ""}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Teams List - Layer 2 */}
                {isLobbyExpanded && (
                  <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    {lobbyTeams.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No teams assigned to this lobby</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lobbyTeams.map(team => {
                          const isTeamExpanded = expandedTeams.has(team.id);
                          const players = team.players || [];

                          return (
                            <div key={team.id} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                              {/* Team Header - Clickable to expand */}
                              <button
                                onClick={() => toggleTeam(team.id)}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                                    team.registration_type === "solo" ? "bg-blue-500" : 
                                    team.registration_type === "duo" ? "bg-purple-500" : "bg-indigo-500"
                                  }`}>
                                    {team.slot_number}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">{team.team_name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {team.registration_type?.toUpperCase() || "SQUAD"} • Leader: {team.leader_name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {players.length} player{players.length !== 1 ? "s" : ""}
                                  </span>
                                  <svg 
                                    className={`w-5 h-5 text-gray-400 transition-transform ${isTeamExpanded ? "rotate-180" : ""}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </button>

                              {/* Players List - Layer 3 */}
                              {isTeamExpanded && (
                                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
                                  {players.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                      No player details available
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                      {players.map((player, index) => (
                                        <div key={player.id || index} className="p-3 flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                              {player.username?.charAt(0).toUpperCase() || "P"}
                                            </div>
                                            <div>
                                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                {player.username || `Player ${index + 1}`}
                                              </p>
                                              {player.in_game_name && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                  Game Name: {player.in_game_name}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            {player.in_game_id ? (
                                              <div className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">UID</p>
                                                <p className="text-sm font-mono font-medium text-indigo-700 dark:text-indigo-400">
                                                  {player.in_game_id}
                                                </p>
                                              </div>
                                            ) : (
                                              <span className="text-xs text-gray-400 dark:text-gray-500">No UID</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned Teams Section */}
          {(() => {
            const unassignedTeams = getTeamsByLobby(null);
            if (lobbies.length === 0 || unassignedTeams.length > 0) {
              const isUnassignedExpanded = expandedLobbies.has("unassigned");
              const sectionTitle = lobbies.length === 0 ? "Registered Teams" : "Unassigned Teams";

              return (
                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                  {/* Section Header */}
                  <button
                    onClick={() => toggleLobby("unassigned")}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-750 dark:hover:to-gray-700 transition text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-400 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{sectionTitle}</h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {unassignedTeams.length} team{unassignedTeams.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <svg 
                      className={`w-6 h-6 text-gray-400 transition-transform ${isUnassignedExpanded ? "rotate-180" : ""}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Teams List */}
                  {isUnassignedExpanded && (
                    <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      {unassignedTeams.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <p>No teams registered</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {unassignedTeams.map(team => {
                            const isTeamExpanded = expandedTeams.has(team.id);
                            const players = team.players || [];

                            return (
                              <div key={team.id} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                                {/* Team Header */}
                                <button
                                  onClick={() => toggleTeam(team.id)}
                                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                                      team.registration_type === "solo" ? "bg-blue-500" : 
                                      team.registration_type === "duo" ? "bg-purple-500" : "bg-indigo-500"
                                    }`}>
                                      {team.slot_number}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-900 dark:text-white">{team.team_name}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {team.registration_type?.toUpperCase() || "SQUAD"} • Leader: {team.leader_name}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {players.length} player{players.length !== 1 ? "s" : ""}
                                    </span>
                                    <svg 
                                      className={`w-5 h-5 text-gray-400 transition-transform ${isTeamExpanded ? "rotate-180" : ""}`} 
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </button>

                                {/* Players List */}
                                {isTeamExpanded && (
                                  <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
                                    {players.length === 0 ? (
                                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        No player details available
                                      </div>
                                    ) : (
                                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {players.map((player, index) => (
                                          <div key={player.id || index} className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                                {player.username?.charAt(0).toUpperCase() || "P"}
                                              </div>
                                              <div>
                                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                  {player.username || `Player ${index + 1}`}
                                                </p>
                                                {player.in_game_name && (
                                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Game Name: {player.in_game_name}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              {player.in_game_id ? (
                                                <div className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                                  <p className="text-xs text-gray-500 dark:text-gray-400">UID</p>
                                                  <p className="text-sm font-mono font-medium text-indigo-700 dark:text-indigo-400">
                                                    {player.in_game_id}
                                                  </p>
                                                </div>
                                              ) : (
                                                <span className="text-xs text-gray-400 dark:text-gray-500">No UID</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* Create Lobby Modal */}
      <Modal
        isOpen={createLobbyModal}
        onClose={() => setCreateLobbyModal(false)}
        title="Create New Lobby"
      >
        <div className="space-y-4">
          <FormField
            label="Lobby Name"
            type="text"
            value={lobbyForm.lobby_name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLobbyForm({ ...lobbyForm, lobby_name: e.target.value })}
            placeholder="e.g., Lobby 1 - Group A"
          />
          <FormField
            label="Max Teams"
            type="number"
            value={lobbyForm.max_teams}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLobbyForm({ ...lobbyForm, max_teams: parseInt(e.target.value) || 12 })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setCreateLobbyModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateLobby}
              disabled={creatingLobby}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {creatingLobby ? "Creating..." : "Create Lobby"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Room Credentials Modal */}
      <Modal
        isOpen={roomModal.show}
        onClose={() => setRoomModal({ show: false, lobby: null })}
        title={`Set Room Credentials - ${roomModal.lobby?.lobby_name}`}
      >
        <div className="space-y-4">
          <FormField
            label="Room ID"
            type="text"
            value={roomCredentials.room_id}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setRoomCredentials({ ...roomCredentials, room_id: e.target.value })}
            placeholder="Enter Room ID"
          />
          <FormField
            label="Room Password"
            type="text"
            value={roomCredentials.room_password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setRoomCredentials({ ...roomCredentials, room_password: e.target.value })}
            placeholder="Enter Room Password"
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setRoomModal({ show: false, lobby: null })}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRoomCredentials}
              disabled={savingRoom}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {savingRoom ? "Saving..." : "Save Credentials"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Send Notification Modal */}
      <Modal
        isOpen={notificationModal}
        onClose={() => setNotificationModal(false)}
        title="Send Notification"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Send To
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setNotificationForm({ ...notificationForm, target: "all", selectedLobbyId: null })}
                className={`flex-1 px-4 py-2.5 rounded-xl border-2 transition font-medium ${
                  notificationForm.target === "all"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                    : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
                }`}
              >
                All Lobbies
              </button>
              <button
                onClick={() => setNotificationForm({ ...notificationForm, target: "lobby" })}
                className={`flex-1 px-4 py-2.5 rounded-xl border-2 transition font-medium ${
                  notificationForm.target === "lobby"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                    : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
                }`}
              >
                Single Lobby
              </button>
            </div>
          </div>

          {notificationForm.target === "lobby" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Lobby
              </label>
              <select
                value={notificationForm.selectedLobbyId || ""}
                onChange={(e) => setNotificationForm({ ...notificationForm, selectedLobbyId: parseInt(e.target.value) || null })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select a lobby...</option>
                {lobbies.map((lobby) => (
                  <option key={lobby.id} value={lobby.id}>
                    {lobby.lobby_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message
            </label>
            <textarea
              value={notificationForm.message}
              onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
              placeholder="Type your notification message..."
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setNotificationModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSendNotification}
              disabled={sendingNotification}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {sendingNotification ? "Sending..." : "Send Notification"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
