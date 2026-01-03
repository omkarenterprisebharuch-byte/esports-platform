"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/api-client";

interface Tournament {
  id: string;
  name: string;
  game_type: string;
  tournament_type: string;
  prize_pool: number;
  start_date: string;
  status: string;
  max_teams: number;
  registered_count: number;
}

const FEATURED_GAMES = [
  { name: "Free Fire", icon: "🔥", color: "from-orange-500 to-red-500" },
  { name: "PUBG", icon: "🎯", color: "from-yellow-500 to-orange-500" },
  { name: "Valorant", icon: "⚔️", color: "from-red-500 to-pink-500" },
  { name: "COD Mobile", icon: "🔫", color: "from-green-500 to-teal-500" },
];

export default function LandingPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    
    // Fetch public tournaments
    fetch("/api/tournaments?limit=6&filter=upcoming")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournaments(data.data.tournaments || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getGameEmoji = (gameType: string) => {
    const emojis: Record<string, string> = {
      freefire: "🔥",
      pubg: "🎯",
      valorant: "⚔️",
      codm: "🔫",
    };
    return emojis[gameType] || "🎮";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Compete. <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Win.</span> Dominate.
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Join thousands of gamers in epic esports tournaments. Play your favorite games,
              win prizes, and climb the leaderboards.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="px-8 py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition text-lg shadow-xl"
                >
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition text-lg shadow-xl"
                  >
                    Start Playing Now
                  </Link>
                  <Link
                    href="/tournaments"
                    className="px-8 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition text-lg border border-white/20"
                  >
                    Browse Tournaments
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Featured Games
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURED_GAMES.map((game) => (
              <Link
                key={game.name}
                href={`/tournaments?game=${game.name.toLowerCase().replace(" ", "")}`}
                className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${game.color} group hover:scale-105 transition-transform duration-200`}
              >
                <span className="text-4xl">{game.icon}</span>
                <h3 className="text-lg font-bold text-white mt-2">{game.name}</h3>
                <div className="absolute top-2 right-2 bg-white/20 rounded-full px-2 py-1 text-xs text-white">
                  Active
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Tournaments */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Upcoming Tournaments
            </h2>
            <Link
              href="/tournaments"
              className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
            >
              View All →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-900 rounded-xl p-6 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.id}`}
                  className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-700 transition group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{getGameEmoji(tournament.game_type)}</span>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                      {tournament.status.replace("_", " ")}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition">
                    {tournament.name}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <span>🏆</span>
                      <span>₹{tournament.prize_pool.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>{formatDate(tournament.start_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>👥</span>
                      <span>
                        {tournament.registered_count}/{tournament.max_teams} slots
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400 group-hover:underline">
                      View Details →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && tournaments.length === 0 && (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">🎮</span>
              <p className="text-gray-600 dark:text-gray-400">
                No upcoming tournaments at the moment. Check back soon!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      {!isLoggedIn && (
        <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Start Your Esports Journey?
            </h2>
            <p className="text-gray-300 mb-8">
              Create your free account and join tournaments today. 
              No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-8 py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition"
              >
                Create Free Account
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 bg-transparent text-white font-bold rounded-xl hover:bg-white/10 transition border border-white/30"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Why Choose Us?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "🏆",
                title: "Competitive Tournaments",
                description: "Join daily and weekly tournaments with real prize pools",
              },
              {
                icon: "👥",
                title: "Team Management",
                description: "Create teams, invite friends, and compete together",
              },
              {
                icon: "💰",
                title: "Secure Payments",
                description: "Safe wallet system for entry fees and prize withdrawals",
              },
              {
                icon: "📊",
                title: "Leaderboards",
                description: "Track your progress and climb the ranks",
              },
              {
                icon: "🔔",
                title: "Real-time Updates",
                description: "Get notified about matches, results, and more",
              },
              {
                icon: "💬",
                title: "Tournament Chat",
                description: "Communicate with other players in real-time",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800"
              >
                <span className="text-4xl mb-4 block">{feature.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
