"use client";

import { useState, useEffect, useCallback } from "react";
import { secureFetch } from "@/lib/api-client";

interface TeamStatus {
  registrationId: number;
  teamId: number | null;
  userId: number;
  teamName: string | null;
  username: string;
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  slotNumber: number;
}

interface CheckinStatusData {
  registered: {
    total: number;
    checkedIn: number;
    teams: TeamStatus[];
  };
  waitlisted: {
    total: number;
    checkedIn: number;
    teams: TeamStatus[];
  };
  summary: {
    isFinalized: boolean;
    finalizedAt: string | null;
  };
}

interface CheckinAdminPanelProps {
  tournamentId: number | string;
  tournamentName: string;
  tournamentStartDate: string;
}

export default function CheckinAdminPanel({
  tournamentId,
  tournamentName,
  tournamentStartDate,
}: CheckinAdminPanelProps) {
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [data, setData] = useState<CheckinStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/tournaments/${tournamentId}/checkin/status`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Failed to load check-in statuses");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 15000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const handleFinalize = async () => {
    if (!confirm("Are you sure you want to finalize check-ins? This will:\n\n• Disqualify teams that didn't check in\n• Promote waitlist teams to fill empty slots\n• This action cannot be undone.")) {
      return;
    }

    setFinalizing(true);
    setMessage(null);

    try {
      const res = await secureFetch(`/api/tournaments/${tournamentId}/checkin/finalize`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const result = await res.json();

      if (result.success) {
        setMessage({
          type: "success",
          text: result.message || "Check-ins finalized successfully!",
        });
        await fetchStatuses();
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to finalize check-ins" });
    } finally {
      setFinalizing(false);
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tournamentHasStarted = new Date(tournamentStartDate) <= new Date();

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading check-in data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const isFinalized = data.summary?.isFinalized;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Check-in Management
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {tournamentName}
            </p>
          </div>

          {!isFinalized && (
            <button
              onClick={handleFinalize}
              disabled={finalizing || !tournamentHasStarted}
              className={`px-6 py-2 rounded-lg font-medium transition flex items-center gap-2
                ${tournamentHasStarted
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                } disabled:opacity-50`}
              title={!tournamentHasStarted ? "Can only finalize after tournament starts" : ""}
            >
              {finalizing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Finalizing...
                </>
              ) : (
                <>
                  🏁 Finalize Check-ins
                </>
              )}
            </button>
          )}

          {isFinalized && (
            <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg">
              ✓ Finalized
            </span>
          )}
        </div>

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {data.registered.checkedIn}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Registered ✓</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">
              {data.registered.total - data.registered.checkedIn}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Not Checked In</p>
          </div>
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {data.waitlisted.checkedIn}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Waitlist ✓</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">
              {data.waitlisted.total}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Waitlist</p>
          </div>
        </div>
      </div>

      {/* Registered Teams */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Registered Teams ({data.registered.checkedIn}/{data.registered.total} checked in)
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {data.registered.teams.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No registered teams
            </div>
          ) : (
            data.registered.teams.map((team) => (
              <div
                key={team.registrationId}
                className={`p-4 flex items-center justify-between ${
                  team.checkedIn ? "bg-green-50/50 dark:bg-green-900/10" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium">
                    #{team.slotNumber}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {team.teamName || team.username}
                    </p>
                    {team.teamName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        by {team.username}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {team.checkedIn ? (
                    <>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(team.checkedInAt)}
                      </span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                        ✓ Checked In
                      </span>
                    </>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-full">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Waitlisted Teams */}
      {data.waitlisted.total > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">
              Waitlist ({data.waitlisted.checkedIn}/{data.waitlisted.total} checked in)
            </h3>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              Teams will be promoted in check-in order when slots become available
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.waitlisted.teams.map((team) => (
              <div
                key={team.registrationId}
                className={`p-4 flex items-center justify-between ${
                  team.checkedIn ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                    W{team.waitlistPosition}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {team.teamName || team.username}
                    </p>
                    {team.teamName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        by {team.username}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {team.checkedIn ? (
                    <>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(team.checkedInAt)}
                      </span>
                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                        ✓ Ready
                      </span>
                    </>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-full">
                      Not Checked In
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
