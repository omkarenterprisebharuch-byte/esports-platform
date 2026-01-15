"use client";

import { useEffect, useState, useCallback } from "react";
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
 * NEW LOCATION: /admin (migrated from /app/admin)
 * 
 * Layout based on Excalidraw design:
 * - Main content: View all tournaments created by host/admin
 * - Side panel: Tournament management options
 * - Tournament rows: List of all tournaments with actions
 * 
 * Features:
 * - Dashboard overview with stats
 * - Quick actions for common tasks
 * - Recent tournaments
 * - Management shortcuts
 */
export default function AdminPage() {
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [activeTab, setActiveTab] = useState<"normal" | "league">("normal");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
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

  // Auth is handled by layout - just fetch data
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

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

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

  // Filter tournaments by type
  const normalTournaments = tournaments.filter(t => !t.is_league_enabled);
  const leagueTournaments = tournaments.filter(t => t.is_league_enabled);
  const displayedTournaments = activeTab === "normal" ? normalTournaments : leagueTournaments;

  // Close menu when clicking outside
  const handleCloseMenu = () => setOpenMenuId(null);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="View and manage all tournaments created by you"
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
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
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

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg shadow-green-500/20">
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

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-500/20">
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

        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/20">
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

      {/* Main Content Area - Full Width with Tabs */}
      <div className="space-y-4">
        {/* Tournament List Header with Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Tournaments</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">View all tournaments created by you</p>
            </div>
            <Link
              href="/admin/create-tournament"
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Tournament
            </Link>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("normal")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === "normal"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                Normal Tournaments
                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">{normalTournaments.length}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("league")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === "league"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                League Tournaments
                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">{leagueTournaments.length}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tournament Rows */}
        {displayedTournaments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
            <EmptyState
              icon="trophy"
              title={activeTab === "normal" ? "No normal tournaments" : "No league tournaments"}
              description={activeTab === "normal" ? "Create your first tournament to get started" : "Create a league tournament to get started"}
              action={{ label: "Create Tournament", href: "/admin/create-tournament" }}
              variant="minimal"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {displayedTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/app/tournament/${tournament.id}`} className="flex items-center gap-4 flex-1">
                    <GameBadge game={tournament.game_type} size="lg" />
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg hover:text-indigo-600 dark:hover:text-indigo-400 transition">{tournament.tournament_name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {tournament.tournament_type.toUpperCase()} • {tournament.map_name || "TBD"}
                        </span>
                        <StatusBadge status={tournament.status} />
                      </div>
                    </div>
                  </Link>
                  
                  <div className="flex items-center gap-6">
                    {/* Slots Progress */}
                    <div className="text-center hidden sm:block">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all" 
                            style={{ width: `${(tournament.current_teams / tournament.max_teams) * 100}%` }} 
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {tournament.current_teams}/{tournament.max_teams}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Slots</p>
                    </div>
                    
                    {/* Date */}
                    <div className="text-center hidden lg:block">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {formatDate(tournament.tournament_start_date)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Start Time</p>
                    </div>
                    
                    {/* 3-Dot Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === tournament.id ? null : tournament.id);
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                      >
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>
                      
                      {/* Dropdown Menu */}
                      {openMenuId === tournament.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={handleCloseMenu} />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                            <Link
                              href={`/admin/tournament/${tournament.id}/manage`}
                              onClick={handleCloseMenu}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Manage Tournament
                            </Link>
                            
                            <hr className="my-1 border-gray-200 dark:border-gray-700" />
                            
                            <Link
                              href={`/app/tournament/${tournament.id}`}
                              onClick={handleCloseMenu}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              View Details
                            </Link>
                            
                            {canEdit(tournament) && (
                              <Link
                                href={`/admin/create-tournament?edit=${tournament.id}`}
                                onClick={handleCloseMenu}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Edit Tournament
                              </Link>
                            )}
                            
                            {canShareRoom(tournament) && (
                              <button
                                onClick={() => {
                                  handleCloseMenu();
                                  openRoomModal(tournament);
                                }}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Room Credentials
                              </button>
                            )}
                            
                            {canUpdateResults(tournament) && (
                              <button
                                onClick={() => {
                                  handleCloseMenu();
                                  openResultsModal(tournament);
                                }}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                Manage Results
                              </button>
                            )}
                            
                            <hr className="my-1 border-gray-200 dark:border-gray-700" />
                            
                            <button
                              onClick={() => {
                                handleCloseMenu();
                                setDeleteModal({ show: true, tournament });
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete Tournament
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Room Credentials Modal */}
      <Modal isOpen={roomModal.show} onClose={() => setRoomModal({ show: false, tournament: null })} title="Share Room Credentials"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setRoomModal({ show: false, tournament: null })} className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">Cancel</button>
            <button onClick={handleSaveRoomCredentials} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition">Share with Players</button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">These credentials will be visible to all registered players.</p>
          <FormField label="Room ID" value={roomCredentials.room_id} onChange={(e) => setRoomCredentials({ ...roomCredentials, room_id: e.target.value })} placeholder="Enter room ID" />
          <FormField label="Room Password" value={roomCredentials.room_password} onChange={(e) => setRoomCredentials({ ...roomCredentials, room_password: e.target.value })} placeholder="Enter room password" />
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal isOpen={resultsModal.show} onClose={() => setResultsModal({ show: false, tournament: null })} title="Manage Results"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setResultsModal({ show: false, tournament: null })} className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">Cancel</button>
            <button onClick={handleSaveResults} className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition">Save Winners</button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Select winners from the registered players/teams.</p>
          <FormSelect label="1st Place" value={winners.winner_1} onChange={(e) => setWinners({ ...winners, winner_1: e.target.value })} options={[{ value: "", label: "Select winner..." }, ...registrations.map((r) => ({ value: r.team_name || r.username, label: `${r.team_name || r.username} (Slot #${r.slot_number})` }))]} required />
          <FormSelect label="2nd Place" value={winners.winner_2} onChange={(e) => setWinners({ ...winners, winner_2: e.target.value })} options={[{ value: "", label: "Select winner..." }, ...registrations.map((r) => ({ value: r.team_name || r.username, label: `${r.team_name || r.username} (Slot #${r.slot_number})` }))]} />
          <FormSelect label="3rd Place" value={winners.winner_3} onChange={(e) => setWinners({ ...winners, winner_3: e.target.value })} options={[{ value: "", label: "Select winner..." }, ...registrations.map((r) => ({ value: r.team_name || r.username, label: `${r.team_name || r.username} (Slot #${r.slot_number})` }))]} />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal.show} onClose={() => setDeleteModal({ show: false, tournament: null })} title="Delete Tournament"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal({ show: false, tournament: null })} className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition" disabled={deleting}>Cancel</button>
            <button onClick={handleDeleteTournament} disabled={deleting} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed">{deleting ? "Deleting..." : "Delete Tournament"}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Warning: This action cannot be undone</p>
              <p className="text-sm text-red-600 dark:text-red-400">All tournament data and registrations will be permanently deleted.</p>
            </div>
          </div>
          {deleteModal.tournament && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">You are about to delete:</p>
              <p className="font-semibold text-gray-900 dark:text-white mt-1">{deleteModal.tournament.tournament_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{deleteModal.tournament.game_type} • {deleteModal.tournament.tournament_type} • Status: {deleteModal.tournament.status}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
