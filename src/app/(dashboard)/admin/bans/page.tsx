"use client";

import { useState, useEffect } from "react";
import { secureFetch } from "@/lib/api-client";

interface Ban {
  id: number;
  game_id: string;
  game_type: string;
  reason: string;
  banned_by: number;
  banned_by_username: string;
  original_user_id: number | null;
  original_user_username: string | null;
  report_id: number | null;
  is_permanent: boolean;
  ban_expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const GAME_LABELS: Record<string, string> = {
  freefire: "🔥 Free Fire",
  pubg: "🎯 PUBG",
  valorant: "⚔️ Valorant",
  codm: "🔫 COD Mobile",
  bgmi: "🎮 BGMI",
};

export default function BannedGameIdsPage() {
  const [bans, setBans] = useState<Ban[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameTypeFilter, setGameTypeFilter] = useState<string>("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmUnban, setShowConfirmUnban] = useState<Ban | null>(null);

  useEffect(() => {
    fetchBans();
  }, [gameTypeFilter, showActiveOnly, page]);

  const fetchBans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      params.set("active", showActiveOnly.toString());
      if (gameTypeFilter) params.set("game_type", gameTypeFilter);

      const res = await secureFetch(`/api/bans/game-id?${params}`);
      const data = await res.json();

      if (data.success) {
        setBans(data.data.bans);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch bans:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (ban: Ban) => {
    try {
      const res = await secureFetch(`/api/bans/game-id/${ban.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchBans();
        setShowConfirmUnban(null);
      }
    } catch (err) {
      console.error("Failed to unban:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🚫 Banned Game IDs
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Players with these game IDs cannot register for tournaments
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          + Ban Game ID
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Game
            </label>
            <select
              value={gameTypeFilter}
              onChange={(e) => {
                setGameTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="">All Games</option>
              <option value="freefire">Free Fire</option>
              <option value="pubg">PUBG</option>
              <option value="valorant">Valorant</option>
              <option value="codm">COD Mobile</option>
              <option value="bgmi">BGMI</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="activeOnly"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="activeOnly" className="text-sm text-gray-700 dark:text-gray-300">
              Show active bans only
            </label>
          </div>
        </div>
      </div>

      {/* Bans Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-gray-900 dark:border-white border-t-transparent rounded-full"></div>
          </div>
        ) : bans.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No banned game IDs found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Game ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Game
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Original User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Banned On
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {bans.map((ban) => (
                    <tr key={ban.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {ban.game_id}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {GAME_LABELS[ban.game_type] || ban.game_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {ban.reason}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {ban.original_user_username || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {ban.is_permanent ? (
                          <span className="text-red-600 font-medium">Permanent</span>
                        ) : (
                          <span className="text-orange-600">
                            Until {formatDate(ban.ban_expires_at!)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(ban.created_at)}
                        <div className="text-xs">by {ban.banned_by_username}</div>
                      </td>
                      <td className="px-4 py-3">
                        {ban.is_active ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs rounded">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs rounded">
                            Lifted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ban.is_active && (
                          <button
                            onClick={() => setShowConfirmUnban(ban)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Lift Ban
                          </button>
                        )}
                        {ban.report_id && (
                          <a
                            href={`/admin/reports?id=${ban.report_id}`}
                            className="ml-3 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Report
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {(page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Ban Modal */}
      {showAddModal && (
        <AddBanModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchBans();
          }}
        />
      )}

      {/* Confirm Unban Modal */}
      {showConfirmUnban && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Lift Ban?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to lift the ban on game ID{" "}
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {showConfirmUnban.game_id}
              </code>
              ? This player will be able to register for tournaments again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmUnban(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnban(showConfirmUnban)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Lift Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Ban Modal Component
function AddBanModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [gameId, setGameId] = useState("");
  const [gameType, setGameType] = useState("");
  const [reason, setReason] = useState("");
  const [isPermanent, setIsPermanent] = useState(true);
  const [banDays, setBanDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!gameId || !gameType || !reason) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const res = await secureFetch("/api/bans/game-id", {
        method: "POST",
        body: JSON.stringify({
          game_id: gameId,
          game_type: gameType,
          reason,
          is_permanent: isPermanent,
          ban_duration_days: isPermanent ? undefined : banDays,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.message || "Failed to ban game ID");
      }
    } catch (err) {
      setError("Failed to ban game ID");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Ban Game ID
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Game ID *
            </label>
            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter the player's game ID"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Game *
            </label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              required
            >
              <option value="">Select game...</option>
              <option value="freefire">Free Fire</option>
              <option value="pubg">PUBG</option>
              <option value="valorant">Valorant</option>
              <option value="codm">COD Mobile</option>
              <option value="bgmi">BGMI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this game ID being banned?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={isPermanent}
                onChange={() => setIsPermanent(true)}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Permanent</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!isPermanent}
                onChange={() => setIsPermanent(false)}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Temporary</span>
            </label>
          </div>

          {!isPermanent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ban Duration (days)
              </label>
              <input
                type="number"
                value={banDays}
                onChange={(e) => setBanDays(parseInt(e.target.value))}
                min={1}
                max={365}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Banning..." : "Ban Game ID"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
