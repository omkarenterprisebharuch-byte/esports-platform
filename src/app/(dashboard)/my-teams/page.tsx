"use client";

import { useEffect, useState, useCallback } from "react";

interface Team {
  id: number;
  team_name: string;
  team_code: string;
  invite_code: string;
  total_members: number;
  max_members: number;
  role: string;
  game_uid: string;
  game_name: string;
  captain_name: string;
  captain_id: number;
  is_captain: boolean;
  created_at: string;
}

interface TeamMember {
  id: number;
  user_id: number;
  role: string;
  game_uid: string;
  game_name: string;
  username: string;
  avatar_url: string | null;
  joined_at: string;
}

interface ExpandedTeamData {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
}

export default function MyTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<number, ExpandedTeamData>>({});
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchTeams();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = () => {
    const token = localStorage.getItem("token");
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurrentUserId(data.data.id);
        }
      });
  };

  const fetchTeams = () => {
    const token = localStorage.getItem("token");
    fetch("/api/teams/my-teams", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTeams(data.data.teams || []);
        }
      })
      .finally(() => setLoading(false));
  };

  const toggleTeamExpansion = useCallback(async (teamId: number) => {
    // If already expanded, collapse it
    if (expandedTeams[teamId]?.members?.length > 0) {
      setExpandedTeams(prev => {
        const newState = { ...prev };
        delete newState[teamId];
        return newState;
      });
      return;
    }

    // Start loading
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: { members: [], loading: true, error: null }
    }));

    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setExpandedTeams(prev => ({
          ...prev,
          [teamId]: { 
            members: data.data.team?.members || [], 
            loading: false, 
            error: null 
          }
        }));
      } else {
        setExpandedTeams(prev => ({
          ...prev,
          [teamId]: { members: [], loading: false, error: data.message || "Failed to load" }
        }));
      }
    } catch {
      setExpandedTeams(prev => ({
        ...prev,
        [teamId]: { members: [], loading: false, error: "Failed to load members" }
      }));
    }
  }, [expandedTeams]);

  const handleLeaveTeam = async (teamId: number) => {
    if (!confirm("Are you sure you want to leave this team?")) return;

    setActionLoading(teamId);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/teams/${teamId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Refresh teams list
        fetchTeams();
        // Remove from expanded state
        setExpandedTeams(prev => {
          const newState = { ...prev };
          delete newState[teamId];
          return newState;
        });
      }
    } catch (error) {
      console.error("Failed to leave team:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTeam = async (teamId: number) => {
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) return;

    setActionLoading(teamId);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Refresh teams list
        fetchTeams();
        // Remove from expanded state
        setExpandedTeams(prev => {
          const newState = { ...prev };
          delete newState[teamId];
          return newState;
        });
      }
    } catch (error) {
      console.error("Failed to delete team:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Teams</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Join Team
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition"
          >
            Create Team
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-5xl mb-4">👥</p>
          <p className="text-gray-500 mb-2">You don&apos;t have any teams yet</p>
          <p className="text-sm text-gray-400">
            Create a new team or join an existing one
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const isExpanded = !!expandedTeams[team.id]?.members?.length;
            const expandedData = expandedTeams[team.id];
            const isOwner = team.captain_id === currentUserId;

            return (
              <div 
                key={team.id} 
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Team Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {team.team_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Captain: {team.captain_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {team.is_captain && (
                        <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded">
                          Captain
                        </span>
                      )}
                      <span className="font-mono text-gray-900 bg-gray-100 px-3 py-1 rounded text-sm">
                        #{team.team_code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {team.total_members}/{team.max_members} Members
                    </span>
                    
                    <button
                      onClick={() => toggleTeamExpansion(team.id)}
                      className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium transition"
                    >
                      {expandedData?.loading ? (
                        <>
                          <span className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                          Loading...
                        </>
                      ) : isExpanded ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Hide Members
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          View Player List
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Members Section */}
                {isExpanded && expandedData && (
                  <div className="border-t border-gray-100 bg-gray-50 p-6">
                    {expandedData.error ? (
                      <p className="text-red-500 text-sm">{expandedData.error}</p>
                    ) : (
                      <>
                        {/* Invite Code */}
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                          <span className="text-sm text-gray-600">Invite Code:</span>
                          <span className="font-mono text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded border">
                            {team.invite_code || team.team_code}
                          </span>
                        </div>

                        {/* Members List */}
                        <h4 className="font-semibold text-gray-900 mb-3">
                          Team Members ({expandedData.members.length})
                        </h4>
                        <div className="space-y-2 mb-4">
                          {expandedData.members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                                  {member.username?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{member.username}</p>
                                  <p className="text-xs text-gray-500">
                                    {member.game_name} • UID: {member.game_uid}
                                  </p>
                                </div>
                              </div>

                              {member.role === "captain" && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                                  Captain
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 border-t border-gray-200">
                          {isOwner ? (
                            <button
                              onClick={() => handleDeleteTeam(team.id)}
                              disabled={actionLoading === team.id}
                              className="w-full py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                            >
                              {actionLoading === team.id ? "Deleting..." : "Delete Team"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLeaveTeam(team.id)}
                              disabled={actionLoading === team.id}
                              className="w-full py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                            >
                              {actionLoading === team.id ? "Leaving..." : "Leave Team"}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTeams();
          }}
        />
      )}

      {/* Join Team Modal */}
      {showJoinModal && (
        <JoinTeamModal
          onClose={() => setShowJoinModal(false)}
          onSuccess={() => {
            setShowJoinModal(false);
            fetchTeams();
          }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    team_name: "",
    game_uid: "",
    game_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.message || "Failed to create team");
      }
    } catch {
      setError("Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create Team</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Name
            </label>
            <input
              type="text"
              value={form.team_name}
              onChange={(e) => setForm({ ...form, team_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game UID
            </label>
            <input
              type="text"
              value={form.game_uid}
              onChange={(e) => setForm({ ...form, game_uid: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game Name
            </label>
            <input
              type="text"
              value={form.game_name}
              onChange={(e) => setForm({ ...form, game_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinTeamModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    invite_code: "",
    game_uid: "",
    game_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.message || "Failed to join team");
      }
    } catch {
      setError("Failed to join team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Join Team</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Invite Code
            </label>
            <input
              type="text"
              value={form.invite_code}
              onChange={(e) =>
                setForm({ ...form, invite_code: e.target.value })
              }
              placeholder="12345"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-center text-xl font-mono tracking-widest"
              maxLength={5}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game UID
            </label>
            <input
              type="text"
              value={form.game_uid}
              onChange={(e) => setForm({ ...form, game_uid: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game Name
            </label>
            <input
              type="text"
              value={form.game_name}
              onChange={(e) => setForm({ ...form, game_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
