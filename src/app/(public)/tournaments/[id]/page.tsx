"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { isAuthenticated } from "@/lib/api-client";

interface Tournament {
  id: string;
  tournament_name: string;
  description: string;
  game_type: string;
  tournament_type: string;
  prize_pool: number;
  entry_fee: number;
  tournament_start_date: string;
  tournament_end_date: string;
  registration_start_date: string;
  registration_end_date: string;
  status: string;
  computed_status: string;
  max_teams: number;
  match_rules?: string;
  room_id?: string;
  room_password?: string;
  current_teams: number;
  host_name?: string;
  prize_distribution?: {
    first?: number;
    second?: number;
    third?: number;
    [key: string]: number | undefined;
  };
}

const GAME_INFO: Record<string, { name: string; icon: string; color: string }> = {
  freefire: { name: "Free Fire", icon: "🔥", color: "from-orange-500 to-red-500" },
  pubg: { name: "PUBG", icon: "🎯", color: "from-yellow-500 to-orange-500" },
  valorant: { name: "Valorant", icon: "⚔️", color: "from-red-500 to-pink-500" },
  codm: { name: "COD Mobile", icon: "🔫", color: "from-green-500 to-teal-500" },
};

export default function PublicTournamentDetailPage() {
  const params = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    
    fetch(`/api/tournaments/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournament(data.data.tournament);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "TBD";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      registration_open: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
      upcoming: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
      ongoing: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
      completed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-400" },
    };
    const style = styles[status] || styles.upcoming;
    return `${style.bg} ${style.text}`;
  };

  const canRegister = () => {
    if (!tournament) return false;
    const now = new Date();
    const regStart = new Date(tournament.registration_start_date);
    const regEnd = new Date(tournament.registration_end_date);
    return now >= regStart && now <= regEnd && (tournament.current_teams ?? 0) < tournament.max_teams;
  };

  const getRegistrationStatus = () => {
    if (!tournament) return { message: "", canRegister: false };
    
    const now = new Date();
    const regStart = new Date(tournament.registration_start_date);
    const regEnd = new Date(tournament.registration_end_date);
    
    if (now < regStart) {
      return { 
        message: `Registration opens ${formatDate(tournament.registration_start_date)}`,
        canRegister: false 
      };
    }
    
    if (now > regEnd) {
      return { message: "Registration has closed", canRegister: false };
    }
    
    if ((tournament.current_teams ?? 0) >= tournament.max_teams) {
      return { message: "Tournament is full", canRegister: false };
    }
    
    return { 
      message: `Registration closes ${formatDate(tournament.registration_end_date)}`,
      canRegister: true 
    };
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <span className="text-6xl mb-4 block">😕</span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Tournament Not Found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The tournament you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 transition"
        >
          Browse Tournaments
        </Link>
      </div>
    );
  }

  const gameInfo = GAME_INFO[tournament.game_type] || { name: tournament.game_type, icon: "🎮", color: "from-gray-500 to-gray-600" };
  const regStatus = getRegistrationStatus();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Tournaments
      </Link>

      {/* Hero Card */}
      <div className={`bg-gradient-to-br ${gameInfo.color} rounded-2xl p-8 mb-8 text-white relative overflow-hidden`}>
        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusBadge(tournament.status)}`}>
            {tournament.status.replace("_", " ")}
          </span>
        </div>
        
        <div className="flex items-start gap-4">
          <span className="text-5xl">{gameInfo.icon}</span>
          <div>
            <p className="text-white/80 text-sm mb-1">
              {gameInfo.name} • {tournament.tournament_type.charAt(0).toUpperCase() + tournament.tournament_type.slice(1)}
            </p>
            <h1 className="text-3xl font-bold mb-2">{tournament.tournament_name}</h1>
            {tournament.host_name && (
              <p className="text-white/80 text-sm">Hosted by {tournament.host_name}</p>
            )}
          </div>
        </div>
        
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/20 rounded-xl p-4">
            <p className="text-white/70 text-xs mb-1">Prize Pool</p>
            <p className="text-2xl font-bold">₹{tournament.prize_pool.toLocaleString()}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <p className="text-white/70 text-xs mb-1">Entry Fee</p>
            <p className="text-2xl font-bold">{tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : "Free"}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <p className="text-white/70 text-xs mb-1">Slots</p>
            <p className="text-2xl font-bold">{tournament.current_teams ?? 0}/{tournament.max_teams}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <p className="text-white/70 text-xs mb-1">Game Type</p>
            <p className="text-2xl font-bold capitalize">
              {tournament.tournament_type}
            </p>
          </div>
        </div>
      </div>

      {/* Registration CTA */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">
              {regStatus.canRegister ? "Register Now" : "Registration Status"}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {regStatus.message}
            </p>
          </div>
          
          {regStatus.canRegister ? (
            isLoggedIn ? (
              <Link
                href={`/register-tournament/${tournament.id}`}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition text-center"
              >
                Register for Tournament
              </Link>
            ) : (
              <Link
                href={`/login?redirect=/register-tournament/${tournament.id}&reason=registration`}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition text-center"
              >
                Sign in to Register
              </Link>
            )
          ) : (
            <span className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium rounded-xl">
              {tournament.status === "completed" ? "Tournament Ended" : "Registration Closed"}
            </span>
          )}
        </div>
        
        {/* Progress bar for slots */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>{tournament.current_teams ?? 0} registered</span>
            <span>{tournament.max_teams - (tournament.current_teams ?? 0)} slots left</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-orange-500 to-pink-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(((tournament.current_teams ?? 0) / tournament.max_teams) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tournament Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Schedule */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📅</span> Schedule
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Registration Period</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {formatDate(tournament.registration_start_date)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                to {formatDate(tournament.registration_end_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tournament Start</p>
              <p className="text-sm text-gray-900 dark:text-white font-medium">
                {formatDate(tournament.tournament_start_date)}
              </p>
            </div>
            {tournament.tournament_end_date && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tournament End</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatDate(tournament.tournament_end_date)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Prize Distribution */}
        {tournament.prize_distribution && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🏆</span> Prize Distribution
            </h2>
            <div className="space-y-3">
              {tournament.prize_distribution.first && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-lg">🥇</span> 1st Place
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ₹{tournament.prize_distribution.first.toLocaleString()}
                  </span>
                </div>
              )}
              {tournament.prize_distribution.second && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-lg">🥈</span> 2nd Place
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ₹{tournament.prize_distribution.second.toLocaleString()}
                  </span>
                </div>
              )}
              {tournament.prize_distribution.third && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-lg">🥉</span> 3rd Place
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ₹{tournament.prize_distribution.third.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {tournament.description && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📝</span> Description
          </h2>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {tournament.description}
          </p>
        </div>
      )}

      {/* Rules */}
      {tournament.match_rules && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📋</span> Rules
          </h2>
          <div className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap text-sm">
            {tournament.match_rules}
          </div>
        </div>
      )}

      {/* Guest CTA */}
      {!isLoggedIn && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 mt-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            Want to join this tournament?
          </h2>
          <p className="text-gray-300 mb-6">
            Create a free account to register and start competing!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/register?redirect=/register-tournament/${tournament.id}`}
              className="px-6 py-3 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Create Account
            </Link>
            <Link
              href={`/login?redirect=/register-tournament/${tournament.id}&reason=registration`}
              className="px-6 py-3 bg-white/20 text-white font-bold rounded-xl hover:bg-white/30 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
