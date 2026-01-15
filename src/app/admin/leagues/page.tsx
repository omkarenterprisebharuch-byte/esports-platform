"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Modal } from "@/components/app/Modal";
import { FormField, FormSelect, FormTextArea } from "@/components/app/FormComponents";
import { StatusBadge, GameBadge } from "@/components/app/Badges";
import {
  validateLeagueSlots,
  getSlotRuleSummary,
  getLeagueGames,
  getLeagueModeOptions,
  SLOT_RULES,
  type LeagueGame,
  type LeagueMode,
} from "@/lib/league-config";

interface Tournament {
  id: string;
  tournament_name: string;
  game_type: string;
  tournament_type: string;
  is_league_enabled: boolean;
  league_total_slots: number | null;
  league_mode: string | null;
  league_lobbies_created: boolean;
  status: string;
  registration_start_date: string;
  registration_end_date: string;
  tournament_start_date: string;
  current_teams: number;
  max_teams: number;
  lobby_count: number;
  registered_teams: number;
}

interface Lobby {
  id: number;
  lobby_number: number;
  room_id: string | null;
  room_password: string | null;
  max_teams: number;
  current_teams: number;
  status: string;
  credentials_published: boolean;
  started_at: string | null;
  completed_at: string | null;
}

interface RegisteredTeam {
  registration_id: string;
  team_id: number;
  team_name: string;
  team_code: string;
  captain_username: string;
  captain_email: string;
  member_count: number;
  registered_at: string;
  status: string;
  lobby_number?: number;
  lobby_id?: string;
}

interface Message {
  id: number;
  sender_username: string;
  recipient_type: string;
  recipient_lobby_number?: number;
  recipient_team_name?: string;
  content: string;
  canDelete: boolean;
  deleteTimeRemaining: number;
  created_at: string;
}

/**
 * Admin Leagues Management Page
 * 
 * Features:
 * - View all league-enabled tournaments
 * - Configure league mode (game, mode, slots)
 * - Create/view lobbies
 * - Send messages to teams/lobbies
 */
export default function LeaguesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // League config modal
  const [configModal, setConfigModal] = useState<{ show: boolean; tournamentId: string | null }>({
    show: false,
    tournamentId: null,
  });
  const [configForm, setConfigForm] = useState({
    game: "freefire" as LeagueGame,
    mode: "squad" as LeagueMode,
    totalSlots: "",
  });
  const [configValidation, setConfigValidation] = useState<{
    valid: boolean;
    error?: string;
    lobbyCount?: number;
    teamsPerLobby?: number;
  } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Lobbies modal
  const [lobbiesModal, setLobbiesModal] = useState<{
    show: boolean;
    tournament: Tournament | null;
    lobbies: Lobby[];
  }>({
    show: false,
    tournament: null,
    lobbies: [],
  });
  const [creatingLobbies, setCreatingLobbies] = useState(false);

  // Messages modal
  const [messagesModal, setMessagesModal] = useState<{
    show: boolean;
    tournament: Tournament | null;
    lobbies: Lobby[];
    messages: Message[];
  }>({
    show: false,
    tournament: null,
    lobbies: [],
    messages: [],
  });
  const [messageForm, setMessageForm] = useState({
    recipientType: "global" as "global" | "lobby" | "team",
    recipientLobbyId: "",
    content: "",
  });
  const [sendingMessage, setSendingMessage] = useState(false);

  // Teams modal
  const [teamsModal, setTeamsModal] = useState<{
    show: boolean;
    tournament: Tournament | null;
    teams: RegisteredTeam[];
    loading: boolean;
  }>({
    show: false,
    tournament: null,
    teams: [],
    loading: false,
  });
  const [teamsFilter, setTeamsFilter] = useState("");

  // Lobby credentials editing
  const [editingLobby, setEditingLobby] = useState<number | null>(null);
  const [lobbyCredentials, setLobbyCredentials] = useState<{ [key: number]: { roomId: string; roomPassword: string } }>({});
  const [savingCredentials, setSavingCredentials] = useState<number | null>(null);
  const [publishingCredentials, setPublishingCredentials] = useState<number | null>(null);

  // Auth check
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (!data.data.is_host && !data.data.is_admin) {
            router.push("/app");
          } else {
            fetchTournaments();
          }
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await secureFetch("/api/admin/leagues");
      const data = await res.json();
      if (data.success) {
        setTournaments(data.data.tournaments || []);
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate slots in real-time
  useEffect(() => {
    const slots = parseInt(configForm.totalSlots);
    if (isNaN(slots) || slots <= 0) {
      setConfigValidation(null);
      return;
    }
    const result = validateLeagueSlots(configForm.game, configForm.mode, slots);
    setConfigValidation(result);
  }, [configForm.game, configForm.mode, configForm.totalSlots]);

  // Get slot rule info
  const getSlotRuleInfo = () => {
    const rule = SLOT_RULES[configForm.game][configForm.mode];
    return {
      multiple: rule.multiple,
      min: rule.minSlots,
      max: rule.maxSlots,
    };
  };

  // Open config modal for a tournament
  const openConfigModal = (tournamentId: string) => {
    setConfigModal({ show: true, tournamentId });
    setConfigForm({ game: "freefire", mode: "squad", totalSlots: "" });
    setConfigValidation(null);
  };

  // Save league config
  const handleSaveConfig = async () => {
    if (!configModal.tournamentId || !configValidation?.valid) return;

    setSavingConfig(true);
    try {
      const res = await secureFetch("/api/admin/leagues", {
        method: "POST",
        body: JSON.stringify({
          tournamentId: configModal.tournamentId,
          game: configForm.game,
          mode: configForm.mode,
          totalSlots: parseInt(configForm.totalSlots),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "League mode enabled!" });
        setConfigModal({ show: false, tournamentId: null });
        fetchTournaments();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to enable league" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save configuration" });
    } finally {
      setSavingConfig(false);
    }
  };

  // Open lobbies modal
  const openLobbiesModal = async (tournament: Tournament) => {
    setLobbiesModal({ show: true, tournament, lobbies: [] });

    try {
      const res = await secureFetch(`/api/admin/leagues/${tournament.id}/lobbies`);
      const data = await res.json();
      if (data.success) {
        setLobbiesModal((prev) => ({ ...prev, lobbies: data.data.lobbies }));
      }
    } catch (error) {
      console.error("Failed to fetch lobbies:", error);
    }
  };

  // Create lobbies
  const handleCreateLobbies = async () => {
    if (!lobbiesModal.tournament) return;

    setCreatingLobbies(true);
    try {
      const res = await secureFetch(`/api/admin/leagues/${lobbiesModal.tournament.id}/lobbies`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Created ${data.data.lobbies.length} lobbies!` });
        setLobbiesModal((prev) => ({ ...prev, lobbies: data.data.lobbies }));
        fetchTournaments();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to create lobbies" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to create lobbies" });
    } finally {
      setCreatingLobbies(false);
    }
  };

  // Start editing lobby credentials
  const startEditingLobby = (lobby: Lobby) => {
    setEditingLobby(lobby.id);
    setLobbyCredentials(prev => ({
      ...prev,
      [lobby.id]: {
        roomId: lobby.room_id || "",
        roomPassword: lobby.room_password || ""
      }
    }));
  };

  // Save lobby credentials
  const handleSaveCredentials = async (lobbyId: number) => {
    if (!lobbiesModal.tournament) return;
    
    const creds = lobbyCredentials[lobbyId];
    if (!creds?.roomId?.trim() || !creds?.roomPassword?.trim()) {
      setMessage({ type: "error", text: "Room ID and Password are required" });
      return;
    }

    setSavingCredentials(lobbyId);
    try {
      const res = await secureFetch(`/api/admin/leagues/${lobbiesModal.tournament.id}/lobbies`, {
        method: "PUT",
        body: JSON.stringify({
          lobbyId,
          action: "update_credentials",
          roomId: creds.roomId.trim(),
          roomPassword: creds.roomPassword.trim()
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Credentials saved!" });
        setEditingLobby(null);
        // Update local state
        setLobbiesModal(prev => ({
          ...prev,
          lobbies: prev.lobbies.map(l => 
            l.id === lobbyId 
              ? { ...l, room_id: data.data.roomId, room_password: data.data.roomPassword }
              : l
          )
        }));
      } else {
        setMessage({ type: "error", text: data.message || "Failed to save credentials" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save credentials" });
    } finally {
      setSavingCredentials(null);
    }
  };

  // Publish credentials to teams (send push notifications)
  const handlePublishCredentials = async (lobbyId: number) => {
    if (!lobbiesModal.tournament) return;

    const lobby = lobbiesModal.lobbies.find(l => l.id === lobbyId);
    if (!lobby?.room_id || !lobby?.room_password) {
      setMessage({ type: "error", text: "Please set Room ID and Password before publishing" });
      return;
    }

    setPublishingCredentials(lobbyId);
    try {
      const res = await secureFetch(`/api/admin/leagues/${lobbiesModal.tournament.id}/lobbies`, {
        method: "PUT",
        body: JSON.stringify({
          lobbyId,
          action: "publish_credentials"
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ 
          type: "success", 
          text: `✅ Credentials sent to ${data.data.teamMemberCount} team members! (${data.data.notificationsSent} notifications sent)` 
        });
        // Update local state to show published status
        setLobbiesModal(prev => ({
          ...prev,
          lobbies: prev.lobbies.map(l => 
            l.id === lobbyId ? { ...l, credentials_published: true } : l
          )
        }));
      } else {
        setMessage({ type: "error", text: data.message || "Failed to publish credentials" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to publish credentials" });
    } finally {
      setPublishingCredentials(null);
    }
  };

  // Open messages modal
  const openMessagesModal = async (tournament: Tournament) => {
    setMessagesModal({ show: true, tournament, lobbies: [], messages: [] });
    setMessageForm({ recipientType: "global", recipientLobbyId: "", content: "" });

    try {
      // Fetch lobbies and messages
      const [lobbiesRes, messagesRes] = await Promise.all([
        secureFetch(`/api/admin/leagues/${tournament.id}/lobbies`),
        secureFetch(`/api/admin/leagues/messages?tournamentId=${tournament.id}`),
      ]);

      const lobbiesData = await lobbiesRes.json();
      const messagesData = await messagesRes.json();

      setMessagesModal((prev) => ({
        ...prev,
        lobbies: lobbiesData.success ? lobbiesData.data.lobbies : [],
        messages: messagesData.success ? messagesData.data.messages : [],
      }));
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!messagesModal.tournament || !messageForm.content.trim()) return;

    setSendingMessage(true);
    try {
      const res = await secureFetch("/api/admin/leagues/messages", {
        method: "POST",
        body: JSON.stringify({
          tournamentId: messagesModal.tournament.id,
          recipientType: messageForm.recipientType,
          recipientLobbyId: messageForm.recipientType === "lobby" ? parseInt(messageForm.recipientLobbyId) : undefined,
          content: messageForm.content.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Message sent!" });
        setMessageForm((prev) => ({ ...prev, content: "" }));
        // Refresh messages
        const messagesRes = await secureFetch(
          `/api/admin/leagues/messages?tournamentId=${messagesModal.tournament!.id}`
        );
        const messagesData = await messagesRes.json();
        if (messagesData.success) {
          setMessagesModal((prev) => ({ ...prev, messages: messagesData.data.messages }));
        }
      } else {
        setMessage({ type: "error", text: data.message || "Failed to send message" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to send message" });
    } finally {
      setSendingMessage(false);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: number) => {
    try {
      const res = await secureFetch(`/api/admin/leagues/messages/${messageId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Message deleted" });
        setMessagesModal((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== messageId),
        }));
      } else {
        setMessage({ type: "error", text: data.message || "Failed to delete message" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete message" });
    }
  };

  // Open teams modal
  const openTeamsModal = async (tournament: Tournament) => {
    setTeamsModal({ show: true, tournament, teams: [], loading: true });
    setTeamsFilter("");

    try {
      const res = await secureFetch(`/api/admin/leagues/${tournament.id}/teams`);
      const data = await res.json();
      if (data.success) {
        setTeamsModal((prev) => ({ ...prev, teams: data.data.teams, loading: false }));
      } else {
        setMessage({ type: "error", text: data.message || "Failed to fetch teams" });
        setTeamsModal((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      setTeamsModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Filter teams by search term
  const filteredTeams = teamsModal.teams.filter((team) => {
    const search = teamsFilter.toLowerCase();
    return (
      team.team_name.toLowerCase().includes(search) ||
      team.captain_username.toLowerCase().includes(search) ||
      team.team_code.toLowerCase().includes(search) ||
      (team.lobby_number && `lobby ${team.lobby_number}`.includes(search))
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDeleteTime = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="League Management"
          subtitle="Configure league mode, manage lobbies, and send announcements"
          actions={
            <Link
              href="/admin"
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
            >
              ← Back to Admin
            </Link>
          }
        />

        {/* Message */}
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {message.text}
            <button
              onClick={() => setMessage(null)}
              className="float-right text-current opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Slot Rules Reference */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📋 Slot Rules Reference
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Fire */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>🔥</span> Free Fire
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Solo: multiples of 50 (50-500)</li>
                <li>• Duo: multiples of 24 (24-240)</li>
                <li>• Squad: multiples of 12 (12-120)</li>
              </ul>
            </div>
            {/* BGMI */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>🎯</span> BGMI
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Solo: multiples of 100 (100-1000)</li>
                <li>• Duo: multiples of 50 (50-500)</li>
                <li>• Squad: multiples of 25 (25-250)</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
            Teams per lobby: Solo (48), Duo (24), Squad (12)
          </p>
        </div>

        {/* League Tournaments List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              League Tournaments
            </h2>
          </div>

          {tournaments.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="No League Tournaments"
              description="Enable league mode on any tournament to get started"
              action={{
                label: "Create Tournament",
                href: "/admin/create-tournament"
              }}
            />
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {tournaments.map((t) => (
                <div key={t.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {t.tournament_name}
                        </h3>
                        <GameBadge game={t.game_type} />
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 space-x-4">
                        <span>Mode: {t.league_mode || "N/A"}</span>
                        <span>Slots: {t.league_total_slots || "N/A"}</span>
                        <span>Lobbies: {t.lobby_count || 0}</span>
                        <span>Registered: {t.registered_teams || 0}</span>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Starts: {formatDate(t.tournament_start_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* View Teams button always visible */}
                      <button
                        onClick={() => openTeamsModal(t)}
                        className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition"
                      >
                        👥 Teams ({t.registered_teams || 0})
                      </button>
                      {t.league_lobbies_created ? (
                        <>
                          <button
                            onClick={() => openLobbiesModal(t)}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
                          >
                            View Lobbies
                          </button>
                          <button
                            onClick={() => openMessagesModal(t)}
                            className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition"
                          >
                            Messages
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openLobbiesModal(t)}
                          className="px-3 py-1.5 text-sm bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition"
                        >
                          Create Lobbies
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Config Modal */}
        <Modal
          isOpen={configModal.show}
          onClose={() => setConfigModal({ show: false, tournamentId: null })}
          title="Configure League Mode"
        >
          <div className="space-y-4">
            <FormSelect
              label="Game"
              value={configForm.game}
              onChange={(e) => setConfigForm({ ...configForm, game: e.target.value as LeagueGame, totalSlots: "" })}
              options={getLeagueGames().map((g) => ({ value: g.value, label: `${g.icon} ${g.label}` }))}
            />

            <FormSelect
              label="Mode"
              value={configForm.mode}
              onChange={(e) => setConfigForm({ ...configForm, mode: e.target.value as LeagueMode, totalSlots: "" })}
              options={getLeagueModeOptions().map((m) => ({
                value: m.value,
                label: `${m.label} - ${m.description}`,
              }))}
            />

            <FormField
              label={`Total Slots (multiples of ${getSlotRuleInfo().multiple})`}
              type="number"
              value={configForm.totalSlots}
              onChange={(e) => setConfigForm({ ...configForm, totalSlots: e.target.value })}
              placeholder={`${getSlotRuleInfo().min} - ${getSlotRuleInfo().max}`}
              hint={`Min: ${getSlotRuleInfo().min}, Max: ${getSlotRuleInfo().max}`}
            />

            {/* Validation feedback */}
            {configValidation && (
              <div
                className={`p-3 rounded-lg ${
                  configValidation.valid
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {configValidation.valid ? (
                  <div className="space-y-1">
                    <p className="font-medium">✓ Valid Configuration</p>
                    <p className="text-sm">
                      Will create {configValidation.lobbyCount} lobbies with {configValidation.teamsPerLobby} teams each
                    </p>
                  </div>
                ) : (
                  <p>✕ {configValidation.error}</p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setConfigModal({ show: false, tournamentId: null })}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={!configValidation?.valid || savingConfig}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {savingConfig ? "Saving..." : "Enable League"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Lobbies Modal */}
        <Modal
          isOpen={lobbiesModal.show}
          onClose={() => setLobbiesModal({ show: false, tournament: null, lobbies: [] })}
          title={`Lobbies - ${lobbiesModal.tournament?.tournament_name || ""}`}
          size="lg"
        >
          <div className="space-y-4">
            {lobbiesModal.lobbies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No lobbies created yet. Create them to enable team assignments.
                </p>
                <button
                  onClick={handleCreateLobbies}
                  disabled={creatingLobbies}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition"
                >
                  {creatingLobbies ? "Creating..." : "Create Lobbies Now"}
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {lobbiesModal.lobbies.map((lobby) => (
                  <div
                    key={lobby.id}
                    className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Lobby #{lobby.lobby_number}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({lobby.current_teams}/{lobby.max_teams} teams)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {lobby.credentials_published && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                            ✓ Published
                          </span>
                        )}
                        <StatusBadge status={lobby.status} />
                      </div>
                    </div>

                    {/* Credentials Section */}
                    {editingLobby === lobby.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Room ID
                            </label>
                            <input
                              type="text"
                              value={lobbyCredentials[lobby.id]?.roomId || ""}
                              onChange={(e) => setLobbyCredentials(prev => ({
                                ...prev,
                                [lobby.id]: { ...prev[lobby.id], roomId: e.target.value }
                              }))}
                              placeholder="Enter Room ID"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Password
                            </label>
                            <input
                              type="text"
                              value={lobbyCredentials[lobby.id]?.roomPassword || ""}
                              onChange={(e) => setLobbyCredentials(prev => ({
                                ...prev,
                                [lobby.id]: { ...prev[lobby.id], roomPassword: e.target.value }
                              }))}
                              placeholder="Enter Password"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingLobby(null)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveCredentials(lobby.id)}
                            disabled={savingCredentials === lobby.id}
                            className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                          >
                            {savingCredentials === lobby.id ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div>
                        {lobby.room_id && lobby.room_password ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Room ID: </span>
                                <code className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 font-mono">
                                  {lobby.room_id}
                                </code>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Password: </span>
                                <code className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 font-mono">
                                  {lobby.room_password}
                                </code>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => startEditingLobby(lobby)}
                                className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                              >
                                ✏️ Edit
                              </button>
                              {!lobby.credentials_published ? (
                                <button
                                  onClick={() => handlePublishCredentials(lobby.id)}
                                  disabled={publishingCredentials === lobby.id}
                                  className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition"
                                >
                                  {publishingCredentials === lobby.id ? "📤 Sending..." : "📤 Publish to Teams"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePublishCredentials(lobby.id)}
                                  disabled={publishingCredentials === lobby.id}
                                  className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition"
                                >
                                  {publishingCredentials === lobby.id ? "📤 Sending..." : "🔄 Resend to Teams"}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* No credentials yet */
                          <div className="text-center py-3">
                            <p className="text-amber-600 dark:text-amber-400 text-sm mb-2">
                              ⏳ Room ID & Password will be available soon
                            </p>
                            <button
                              onClick={() => startEditingLobby(lobby)}
                              className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                            >
                              ➕ Add Room Credentials
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>

        {/* Messages Modal */}
        <Modal
          isOpen={messagesModal.show}
          onClose={() => setMessagesModal({ show: false, tournament: null, lobbies: [], messages: [] })}
          title={`Messages - ${messagesModal.tournament?.tournament_name || ""}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Compose */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Send Message</h4>

              <FormSelect
                label="Send To"
                value={messageForm.recipientType}
                onChange={(e) =>
                  setMessageForm({
                    ...messageForm,
                    recipientType: e.target.value as "global" | "lobby",
                    recipientLobbyId: "",
                  })
                }
                options={[
                  { value: "global", label: "📢 All Teams (Global)" },
                  { value: "lobby", label: "🏟️ Specific Lobby" },
                ]}
              />

              {messageForm.recipientType === "lobby" && (
                <FormSelect
                  label="Select Lobby"
                  value={messageForm.recipientLobbyId}
                  onChange={(e) => setMessageForm({ ...messageForm, recipientLobbyId: e.target.value })}
                  options={[
                    { value: "", label: "-- Select Lobby --" },
                    ...messagesModal.lobbies.map((l) => ({
                      value: l.id.toString(),
                      label: `Lobby #${l.lobby_number} (${l.current_teams}/${l.max_teams})`,
                    })),
                  ]}
                />
              )}

              <FormTextArea
                label="Message"
                value={messageForm.content}
                onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                placeholder="Enter your announcement..."
                rows={3}
                maxLength={1000}
              />

              <button
                onClick={handleSendMessage}
                disabled={
                  sendingMessage ||
                  !messageForm.content.trim() ||
                  (messageForm.recipientType === "lobby" && !messageForm.recipientLobbyId)
                }
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {sendingMessage ? "Sending..." : "Send Message"}
              </button>
            </div>

            {/* Message List */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Messages</h4>
              {messagesModal.messages.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No messages sent yet
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {messagesModal.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              {msg.recipient_type === "global"
                                ? "📢 All Teams"
                                : msg.recipient_type === "lobby"
                                ? `🏟️ Lobby #${msg.recipient_lobby_number}`
                                : `👥 ${msg.recipient_team_name}`}
                            </span>
                            <span>•</span>
                            <span>{formatDate(msg.created_at)}</span>
                          </div>
                          <p className="text-gray-800 dark:text-gray-200 mt-1">{msg.content}</p>
                        </div>
                        {msg.canDelete && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap"
                          >
                            Delete ({formatDeleteTime(msg.deleteTimeRemaining)})
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>

        {/* Teams Modal */}
        <Modal
          isOpen={teamsModal.show}
          onClose={() => setTeamsModal({ show: false, tournament: null, teams: [], loading: false })}
          title={`Registered Teams - ${teamsModal.tournament?.tournament_name || ""}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Summary Stats */}
            {teamsModal.tournament && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {teamsModal.teams.length}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Registered</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {teamsModal.tournament.league_total_slots || teamsModal.tournament.max_teams}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Slots</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {(teamsModal.tournament.league_total_slots || teamsModal.tournament.max_teams) - teamsModal.teams.length}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Available</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {teamsModal.tournament.lobby_count || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Lobbies</p>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={teamsFilter}
                onChange={(e) => setTeamsFilter(e.target.value)}
                placeholder="Search by team name, captain, or code..."
                className="w-full px-4 py-2 pl-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Teams List */}
            {teamsModal.loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Loading teams...</p>
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  {teamsFilter ? "No teams match your search" : "No teams registered yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {/* Table Header */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Team</div>
                  <div className="col-span-2">Code</div>
                  <div className="col-span-3">Captain</div>
                  <div className="col-span-1">Members</div>
                  <div className="col-span-2">Lobby</div>
                </div>

                {/* Team Rows */}
                {filteredTeams.map((team, index) => (
                  <div
                    key={team.registration_id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4"
                  >
                    {/* Mobile View */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          #{index + 1} {team.team_name}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                          {team.team_code}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Captain: {team.captain_username}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {team.member_count} members
                        </span>
                        {team.lobby_number ? (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                            Lobby #{team.lobby_number}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No lobby</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        Registered: {formatDate(team.registered_at)}
                      </div>
                    </div>

                    {/* Desktop View */}
                    <div className="hidden sm:grid sm:grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-1 text-gray-500 dark:text-gray-400">
                        {index + 1}
                      </div>
                      <div className="col-span-3">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {team.team_name}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <code className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                          {team.team_code}
                        </code>
                      </div>
                      <div className="col-span-3 text-gray-600 dark:text-gray-400">
                        {team.captain_username}
                      </div>
                      <div className="col-span-1 text-gray-600 dark:text-gray-400">
                        {team.member_count}
                      </div>
                      <div className="col-span-2">
                        {team.lobby_number ? (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                            Lobby #{team.lobby_number}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                Showing {filteredTeams.length} of {teamsModal.teams.length} teams
              </span>
              <button
                onClick={() => setTeamsModal({ show: false, tournament: null, teams: [], loading: false })}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
