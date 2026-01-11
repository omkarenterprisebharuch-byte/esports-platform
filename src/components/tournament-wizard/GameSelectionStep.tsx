"use client";

import { GAME_CONFIGS, GameConfig, GameMode, getGameModes } from "@/lib/game-config";

interface GameSelectionStepProps {
  selectedGame: string;
  selectedMode: string;
  onSelectGame: (game: string) => void;
  onSelectMode: (mode: string) => void;
}

export default function GameSelectionStep({ 
  selectedGame, 
  selectedMode,
  onSelectGame,
  onSelectMode 
}: GameSelectionStepProps) {
  const games = Object.values(GAME_CONFIGS);
  const selectedGameConfig = GAME_CONFIGS[selectedGame];
  const modes = selectedGame ? getGameModes(selectedGame) : [];

  const handleGameSelect = (gameId: string) => {
    onSelectGame(gameId);
    // Auto-select first mode when game changes
    const gameModes = getGameModes(gameId);
    if (gameModes.length > 0) {
      onSelectMode(gameModes[0].id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Game Selection */}
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Choose Your Game
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Select the game for your tournament
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {games.map((game: GameConfig) => {
            const isPlaceholder = game.modes.every(m => m.isPlaceholder);
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => handleGameSelect(game.id)}
                disabled={isPlaceholder}
                className={`relative p-6 rounded-2xl border-2 transition-all duration-200 text-left
                  ${isPlaceholder 
                    ? "opacity-60 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    : selectedGame === game.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-800"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                  }`}
              >
                {isPlaceholder && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                      Coming Soon
                    </span>
                  </div>
                )}
                {selectedGame === game.id && !isPlaceholder && (
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
                      {game.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {game.modes.length} mode{game.modes.length > 1 ? 's' : ''} available
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {game.modes.map((mode) => (
                    <span
                      key={mode.id}
                      className={`px-2 py-1 text-xs rounded-full ${
                        mode.isPlaceholder
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {mode.name}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Selection - Show when game is selected */}
      {selectedGame && modes.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Select Mode for {selectedGameConfig?.name}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Choose the tournament format
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modes.map((mode: GameMode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onSelectMode(mode.id)}
                disabled={mode.isPlaceholder}
                className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left
                  ${mode.isPlaceholder
                    ? "opacity-60 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    : selectedMode === mode.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
              >
                {mode.isPlaceholder && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">
                    Coming Soon
                  </span>
                )}
                
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {mode.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {mode.description}
                    </p>
                  </div>
                  {selectedMode === mode.id && !mode.isPlaceholder && (
                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Team sizes:
                  </span>
                  {mode.teamSizes.map((ts) => (
                    <span
                      key={ts.value}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                    >
                      {ts.label}
                    </span>
                  ))}
                </div>

                {/* Mode-specific badges */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {mode.maxTeams === 2 && !mode.isPlaceholder && (
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                      ⚠️ Always 2 teams
                    </span>
                  )}
                  {mode.hideLocation && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      🌐 Online only
                    </span>
                  )}
                  {mode.requiresMap && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      🗺️ Map required
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-blue-500 text-xl">💡</span>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Game Rules:</strong> Each game has specific modes and constraints:
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
              <li><strong>Free Fire Clash Squad:</strong> Always 2 teams, no location field</li>
              <li><strong>BGMI BR:</strong> Solo (100p), Duo (50t), Squad (25t) - Map required</li>
              <li><strong>BGMI TDM:</strong> Always 2 teams</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
