"use client";

import { GAME_DEFAULTS, GameDefaults } from "@/lib/game-defaults";

interface GameSelectionStepProps {
  selectedGame: string;
  onSelectGame: (game: string) => void;
}

export default function GameSelectionStep({ selectedGame, onSelectGame }: GameSelectionStepProps) {
  const games = Object.values(GAME_DEFAULTS);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Choose Your Game
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Select the game for your tournament. We&apos;ll set up smart defaults for you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {games.map((game: GameDefaults) => (
          <button
            key={game.game_type}
            type="button"
            onClick={() => onSelectGame(game.game_type)}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-200 text-left
              ${selectedGame === game.game_type
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-800"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
              }`}
          >
            {selectedGame === game.game_type && (
              <div className="absolute top-3 right-3">
                <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <span className="text-4xl">{game.icon}</span>
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  {game.display_name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {game.tournament_types.length} format{game.tournament_types.length > 1 ? 's' : ''} • 
                  {game.maps.length} map{game.maps.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {game.tournament_types.map((type) => (
                <span
                  key={type.type}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full"
                >
                  {type.display_name}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-6">
        <div className="flex items-start gap-3">
          <span className="text-blue-500 text-xl">💡</span>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Smart Defaults:</strong> After selecting a game, we&apos;ll automatically set up 
              recommended rules, maps, team sizes, and scoring systems. You can customize everything later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
