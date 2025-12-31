"use client";

import { useState, useEffect, useCallback } from "react";
import { secureFetch } from "@/lib/api-client";

interface CheckinWindowData {
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  minutesUntilOpen: number;
  minutesUntilClose: number;
  windowMinutes: number;
}

interface UserCheckinStatus {
  canCheckIn: boolean;
  reason?: string;
  registration?: {
    registrationId: number;
    teamId: number | null;
    teamName: string | null;
    username: string;
    isWaitlisted: boolean;
    waitlistPosition: number | null;
    checkedIn: boolean;
    checkedInAt: string | null;
    slotNumber: number;
  };
}

interface CheckinSummary {
  totalRegistered: number;
  totalWaitlisted: number;
  registeredCheckedIn: number;
  waitlistedCheckedIn: number;
  availableSlots: number;
  maxTeams: number;
  isFinalized: boolean;
}

interface TournamentCheckinProps {
  tournamentId: number | string;
  isHost?: boolean;
  onCheckinComplete?: () => void;
}

export default function TournamentCheckin({
  tournamentId,
  isHost = false,
  onCheckinComplete,
}: TournamentCheckinProps) {
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkinWindow, setCheckinWindow] = useState<CheckinWindowData | null>(null);
  const [userStatus, setUserStatus] = useState<UserCheckinStatus | null>(null);
  const [summary, setSummary] = useState<CheckinSummary | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  const fetchCheckinStatus = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/tournaments/${tournamentId}/checkin`);
      const data = await res.json();

      if (data.success) {
        setCheckinWindow(data.data.checkinWindow);
        setUserStatus(data.data.userStatus);
        setSummary(data.data.summary);
        setIsFinalized(data.data.isFinalized);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to load check-in status");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchCheckinStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCheckinStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchCheckinStatus]);

  // Countdown timer
  useEffect(() => {
    if (!checkinWindow) return;

    const updateCountdown = () => {
      const now = new Date();
      let targetDate: Date | null = null;
      let prefix = "";

      if (!checkinWindow.isOpen && checkinWindow.opensAt) {
        targetDate = new Date(checkinWindow.opensAt);
        prefix = "Opens in ";
      } else if (checkinWindow.isOpen && checkinWindow.closesAt) {
        targetDate = new Date(checkinWindow.closesAt);
        prefix = "Closes in ";
      }

      if (!targetDate) {
        setCountdown("");
        return;
      }

      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown("");
        fetchCheckinStatus(); // Refresh when timer expires
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setCountdown(`${prefix}${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${prefix}${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${prefix}${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [checkinWindow, fetchCheckinStatus]);

  const handleCheckin = async () => {
    setChecking(true);
    setError(null);

    try {
      const res = await secureFetch(`/api/tournaments/${tournamentId}/checkin`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        await fetchCheckinStatus();
        onCheckinComplete?.();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to check in");
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">Loading check-in status...</span>
        </div>
      </div>
    );
  }

  if (isFinalized) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Check-in Completed</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Check-ins have been finalized and the tournament has started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isUserCheckedIn = userStatus?.registration?.checkedIn;
  const isWaitlisted = userStatus?.registration?.isWaitlisted;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className={`p-4 ${
          checkinWindow?.isOpen
            ? "bg-gradient-to-r from-green-500 to-emerald-600"
            : "bg-gradient-to-r from-gray-600 to-gray-700"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              {checkinWindow?.isOpen ? (
                <span className="text-xl">✅</span>
              ) : (
                <span className="text-xl">⏰</span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white">
                {checkinWindow?.isOpen ? "Check-in Open" : "Check-in"}
              </h3>
              <p className="text-sm text-white/80">
                {countdown || (checkinWindow?.isOpen ? "Check in now!" : "Coming soon")}
              </p>
            </div>
          </div>

          {checkinWindow?.isOpen && (
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm text-white">
              {checkinWindow.windowMinutes} min window
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* User Status */}
        {userStatus && (
          <div className="space-y-3">
            {isUserCheckedIn ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">
                    You&apos;re checked in!
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {isWaitlisted
                      ? `Waitlist position #${userStatus.registration?.waitlistPosition} - You may be promoted if registered teams don't check in.`
                      : `Slot #${userStatus.registration?.slotNumber} confirmed`}
                  </p>
                </div>
              </div>
            ) : checkinWindow?.isOpen && userStatus.canCheckIn ? (
              <div className="space-y-3">
                {isWaitlisted && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      ⏳ You&apos;re on the <strong>waitlist (#{userStatus.registration?.waitlistPosition})</strong>. 
                      Check in now! If registered teams don&apos;t check in, you&apos;ll be promoted based on your check-in time.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCheckin}
                  disabled={checking}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white 
                           rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 
                           transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {checking ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Checking in...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Check In Now
                    </>
                  )}
                </button>
              </div>
            ) : !checkinWindow?.isOpen ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-2">
                {checkinWindow?.minutesUntilOpen && checkinWindow.minutesUntilOpen > 0 ? (
                  <p>Check-in window opens {checkinWindow.minutesUntilOpen} minutes before tournament start</p>
                ) : (
                  <p>Check-in window has closed</p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {userStatus.reason || "You cannot check in at this time"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats (visible to all) */}
        {summary && checkinWindow?.isOpen && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {summary.registeredCheckedIn}/{summary.totalRegistered}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Registered Checked In</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.waitlistedCheckedIn}/{summary.totalWaitlisted}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Waitlist Checked In</p>
              </div>
            </div>

            {summary.totalWaitlisted > 0 && summary.availableSlots > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-3">
                {summary.availableSlots} slot{summary.availableSlots !== 1 ? 's' : ''} may open for waitlist teams
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
