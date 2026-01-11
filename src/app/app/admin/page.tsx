"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TournamentWithHost } from "@/types";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Modal } from "@/components/app/Modal";
import { FormField, FormSelect } from "@/components/app/FormComponents";
import { GameBadge, StatusBadge } from "@/components/app/Badges";

interface Registration {
  registration_id: number;
  slot_number: number;
  registration_type: string;
  status: string;
  team_id: number | null;
  user_id: number;
  team_name: string | null;
  username: string;
}

interface DashboardStats {
  totalTournaments: number;
  activeTournaments: number;
  totalRegistrations: number;
  totalPrizeDistributed: number;
  upcomingToday: number;
}

/**
 * Admin Panel - Tournament Host Management Dashboard
 * 
 * Features:
 * - Dashboard overview with stats
 * - Quick actions for common tasks
 * - Recent tournaments
 * - Management shortcuts
 */
export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; is_host: boolean; is_admin: boolean } | null>(null);
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTournaments: 0,
    activeTournaments: 0,
    totalRegistrations: 0,
    totalPrizeDistributed: 0,
    upcomingToday: 0,
  });
  const [loading, setLoading] = useState(true);

  // Room credentials modal
  const [roomModal, setRoomModal] = useState<{ show: boolean; tournament: TournamentWithHost | null }>({
    show: false,
    tournament: null,
  });
  const [roomCredentials, setRoomCredentials] = useState({ room_id: "", room_password: "" });

  // Results modal
  const [resultsModal, setResultsModal] = useState<{ show: boolean; tournament: TournamentWithHost | null }>({
    show: false,
    tournament: null,
  });
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [winners, setWinners] = useState({ winner_1: "", winner_2: "", winner_3: "" });

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; tournament: TournamentWithHost | null }>({
    show: false,
    tournament: null,
  });
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auth check
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const userData = data.data;
          if (!userData.is_host && !userData.is_admin) {
            router.push("/app");
          } else {
            setUser(userData);
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
      const res = await secureFetch("/api/tournaments?hosted=true");
      const data = await res.json();
      if (data.success) {
        const tournamentList = data.data.tournaments || [];
        setTournaments(tournamentList);
        
        // Calculate stats
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const active = tournamentList.filter((t: TournamentWithHost) => 
          t.status === "registration_open" || t.status === "upcoming" || t.status === "ongoing"
        );
        const upcomingToday = tournamentList.filter((t: TournamentWithHost) => {
          const startDate = new Date(t.tournament_start_date);
          return startDate >= today && startDate < tomorrow;
        });
        const totalRegs = tournamentList.reduce((sum: number, t: TournamentWithHost) => sum + (t.current_teams || 0), 0);
        const totalPrize = tournamentList
          .filter((t: TournamentWithHost) => t.status === "completed")
          .reduce((sum: number, t: TournamentWithHost) => sum + (t.prize_pool || 0), 0);

        setStats({
          totalTournaments: tournamentList.length,
          activeTournaments: active.length,
          totalRegistrations: totalRegs,
          totalPrizeDistributed: totalPrize,
          upcomingToday: upcomingToday.length,
        });
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Room credentials
  const openRoomModal = (tournament: TournamentWithHost) => {
    setRoomModal({ show: true, tournament });
    setRoomCredentials({
      room_id: tournament.room_id || "",
      room_password: tournament.room_password || "",
    });
  };

  const handleSaveRoomCredentials = async () => {
    if (!roomModal.tournament) return;

    try {
      const res = await secureFetch(`/api/registrations/room-credentials/${roomModal.tournament.id}`, {
        method: "PUT",
        body: JSON.stringify(roomCredentials),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Room credentials shared!" });
        setRoomModal({ show: false, tournament: null });
        fetchTournaments();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save credentials" });
    }
  };

  // Results management
  const openResultsModal = async (tournament: TournamentWithHost) => {
    setResultsModal({ show: true, tournament });

    try {
      const regRes = await secureFetch(`/api/tournaments/${tournament.id}/registrations`);
      const regData = await regRes.json();
      if (regData.success) {
        setRegistrations(regData.data.registrations || []);
      }

      const winnersRes = await secureFetch(`/api/tournaments/${tournament.id}/winners`);
      const winnersData = await winnersRes.json();
      if (winnersData.success && winnersData.data.winners) {
        setWinners({
          winner_1: winnersData.data.winners.first || "",
          winner_2: winnersData.data.winners.second || "",
          winner_3: winnersData.data.winners.third || "",
        });
      } else {
        setWinners({ winner_1: "", winner_2: "", winner_3: "" });
      }
    } catch (error) {
      console.error("Failed to load tournament data:", error);
    }
  };

  const handleSaveResults = async () => {
    if (!resultsModal.tournament) return;

    if (!winners.winner_1) {
      setMessage({ type: "error", text: "At least 1st place must be selected" });
      return;
    }

    try {
      const res = await secureFetch(`/api/tournaments/${resultsModal.tournament.id}/winners`, {
        method: "POST",
        body: JSON.stringify(winners),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Winners saved!" });
        setResultsModal({ show: false, tournament: null });
        fetchTournaments();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save results" });
    }
  };

  // Delete tournament
  const handleDeleteTournament = async () => {
    if (!deleteModal.tournament) return;

    setDeleting(true);
    try {
      const res = await secureFetch(`/api/tournaments/${deleteModal.tournament.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Tournament deleted successfully!" });
        setDeleteModal({ show: false, tournament: null });
        fetchTournaments();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "Failed to delete tournament" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete tournament" });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: Date | string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canShareRoom = (t: TournamentWithHost) => new Date() >= new Date(t.tournament_start_date);
  const canUpdateResults = (t: TournamentWithHost) => new Date() >= new Date(t.tournament_start_date);
  const canEdit = (t: TournamentWithHost) => new Date() < new Date(t.tournament_start_date);

  // Get recent tournaments (last 5)
  const recentTournaments = tournaments
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Get tournaments needing action (ongoing or starting soon)
  const actionNeeded = tournaments.filter(t => 
    t.status === "ongoing" || 
    (t.status === "upcoming" && new Date(t.tournament_start_date) <= new Date())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Welcome back, ${user.username}`}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Total Tournaments</p>
              <p className="text-3xl font-bold mt-1">{stats.totalTournaments}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Active Now</p>
              <p className="text-3xl font-bold mt-1">{stats.activeTournaments}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Registrations</p>
              <p className="text-3xl font-bold mt-1">{stats.totalRegistrations}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Prize Distributed</p>
              <p className="text-3xl font-bold mt-1">₹{stats.totalPrizeDistributed.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/app/admin/create-tournament"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 
                       rounded-xl border border-indigo-200 dark:border-indigo-800 hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900 transition">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Create Tournament</span>
          </Link>

          <Link
            href="/app/tournaments"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 
                       rounded-xl border border-blue-200 dark:border-blue-800 hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900 transition">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">All Tournaments</span>
          </Link>

          <Link
            href="/app/admin/wallet"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 
                       rounded-xl border border-green-200 dark:border-green-800 hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900 transition">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Wallet</span>
          </Link>

          <Link
            href="/app/admin/reports"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 
                       rounded-xl border border-red-200 dark:border-red-800 hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-xl flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-900 transition">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Reports</span>
          </Link>

          <Link
            href="/app/admin/bans"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 
                       rounded-xl border border-orange-200 dark:border-orange-800 hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-xl flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900 transition">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Ban Manager</span>
          </Link>

          <Link
            href="/app/registrations"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 
                       rounded-xl border border-violet-200 dark:border-violet-800 hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/50 rounded-xl flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-900 transition">
              <svg className="w-6 h-6 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Registrations</span>
          </Link>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Needed */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Action Needed
            </h2>
            {actionNeeded.length > 0 && (
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-full">
                {actionNeeded.length} tournaments
              </span>
            )}
          </div>
          
          {actionNeeded.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">All caught up! No immediate actions needed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionNeeded.map((tournament) => (
                <div
                  key={tournament.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <GameBadge game={tournament.game_type} size="md" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {tournament.tournament_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {tournament.current_teams}/{tournament.max_teams} slots &bull; {formatDate(tournament.tournament_start_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canEdit(tournament) && (
                      <Link
                        href={`/app/admin/create-tournament?edit=${tournament.id}`}
                        className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </Link>
                    )}
                    {canShareRoom(tournament) && !tournament.room_id && (
                      <button
                        onClick={() => openRoomModal(tournament)}
                        className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Share Room
                      </button>
                    )}
                    {canUpdateResults(tournament) && (
                      <button
                        onClick={() => openResultsModal(tournament)}
                        className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        Results
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Tournaments */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Tournaments</h2>
            <Link
              href="/app/tournaments"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              View all
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          
          {recentTournaments.length === 0 ? (
            <EmptyState
              icon="trophy"
              title="No tournaments yet"
              description="Create your first tournament to get started"
              action={{ label: "Create Tournament", href: "/app/admin/create-tournament" }}
              variant="minimal"
            />
          ) : (
            <div className="space-y-3">
              {recentTournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/app/tournament/${tournament.id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
                >
                  <div className="flex items-center gap-3">
                    <GameBadge game={tournament.game_type} size="md" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {tournament.tournament_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {tournament.tournament_type.toUpperCase()}  ?{tournament.prize_pool.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={tournament.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's Schedule */}
      {stats.upcomingToday > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Today&apos;s Schedule</h2>
                <p className="text-blue-100">
                  You have {stats.upcomingToday} tournament{stats.upcomingToday > 1 ? "s" : ""} starting today
                </p>
              </div>
            </div>
            <Link
              href="/app/tournaments"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition"
            >
              View Schedule
            </Link>
          </div>
        </div>
      )}

      {/* All Tournaments Table View */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Tournaments</h2>
            <Link
              href="/app/admin/create-tournament"
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition text-sm"
            >
              + New Tournament
            </Link>
          </div>
        </div>

        {tournaments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon="trophy"
              title="No tournaments created"
              description="Start by creating your first tournament"
              action={{ label: "Create Tournament", href: "/app/admin/create-tournament" }}
              variant="minimal"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tournament
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Slots
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Prize
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tournaments.map((tournament) => (
                  <tr key={tournament.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <GameBadge game={tournament.game_type} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {tournament.tournament_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {tournament.tournament_type.toUpperCase()}  {tournament.map_name || "N/A"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${(tournament.current_teams / tournament.max_teams) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {tournament.current_teams}/{tournament.max_teams}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        ₹{tournament.prize_pool.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={tournament.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(tournament.tournament_start_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit(tournament) && (
                          <Link
                            href={`/app/admin/create-tournament?edit=${tournament.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Edit Tournament"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </Link>
                        )}
                        {canShareRoom(tournament) && (
                          <button
                            onClick={() => openRoomModal(tournament)}
                            className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Room Credentials"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          </button>
                        )}
                        {canUpdateResults(tournament) && (
                          <button
                            onClick={() => openResultsModal(tournament)}
                            className="p-2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Results"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteModal({ show: true, tournament })}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Delete Tournament"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Room Credentials Modal */}
      <Modal
        isOpen={roomModal.show}
        onClose={() => setRoomModal({ show: false, tournament: null })}
        title="Share Room Credentials"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setRoomModal({ show: false, tournament: null })}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRoomCredentials}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
            >
              Share with Players
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            These credentials will be visible to all registered players.
          </p>
          <FormField
            label="Room ID"
            value={roomCredentials.room_id}
            onChange={(e) => setRoomCredentials({ ...roomCredentials, room_id: e.target.value })}
            placeholder="Enter room ID"
          />
          <FormField
            label="Room Password"
            value={roomCredentials.room_password}
            onChange={(e) => setRoomCredentials({ ...roomCredentials, room_password: e.target.value })}
            placeholder="Enter room password"
          />
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={resultsModal.show}
        onClose={() => setResultsModal({ show: false, tournament: null })}
        title="Manage Results"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setResultsModal({ show: false, tournament: null })}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveResults}
              className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition"
            >
              Save Winners
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select winners from the registered players/teams.
          </p>
          <FormSelect
            label="1st Place"
            value={winners.winner_1}
            onChange={(e) => setWinners({ ...winners, winner_1: e.target.value })}
            options={[
              { value: "", label: "Select winner..." },
              ...registrations.map((r) => ({
                value: r.team_name || r.username,
                label: `${r.team_name || r.username} (Slot #${r.slot_number})`,
              })),
            ]}
            required
          />
          <FormSelect
            label="2nd Place"
            value={winners.winner_2}
            onChange={(e) => setWinners({ ...winners, winner_2: e.target.value })}
            options={[
              { value: "", label: "Select winner..." },
              ...registrations.map((r) => ({
                value: r.team_name || r.username,
                label: `${r.team_name || r.username} (Slot #${r.slot_number})`,
              })),
            ]}
          />
          <FormSelect
            label="3rd Place"
            value={winners.winner_3}
            onChange={(e) => setWinners({ ...winners, winner_3: e.target.value })}
            options={[
              { value: "", label: "Select winner..." },
              ...registrations.map((r) => ({
                value: r.team_name || r.username,
                label: `${r.team_name || r.username} (Slot #${r.slot_number})`,
              })),
            ]}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.show}
        onClose={() => setDeleteModal({ show: false, tournament: null })}
        title="Delete Tournament"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModal({ show: false, tournament: null })}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteTournament}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting..." : "Delete Tournament"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Warning: This action cannot be undone</p>
              <p className="text-sm text-red-600 dark:text-red-400">All tournament data and registrations will be permanently deleted.</p>
            </div>
          </div>
          {deleteModal.tournament && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">You are about to delete:</p>
              <p className="font-semibold text-gray-900 dark:text-white mt-1">
                {deleteModal.tournament.tournament_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {deleteModal.tournament.game_type} • {deleteModal.tournament.tournament_type} • Status: {deleteModal.tournament.status}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
