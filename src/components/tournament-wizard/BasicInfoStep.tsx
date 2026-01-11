"use client";

import { getGameConfig, getGameMode, getMaxTeams, TeamSizeOption } from "@/lib/game-config";

export interface BasicInfoData {
  tournament_name: string;
  team_size: number;
  max_teams: number;
  entry_fee: number;
  prize_pool: number;
  map_name: string;
  is_online: boolean;
  venue?: string;
}

interface BasicInfoStepProps {
  gameId: string;
  modeId: string;
  data: BasicInfoData;
  onChange: (data: Partial<BasicInfoData>) => void;
  errors: Record<string, string>;
}

export default function BasicInfoStep({ gameId, modeId, data, onChange, errors }: BasicInfoStepProps) {
  const gameConfig = getGameConfig(gameId);
  const modeConfig = getGameMode(gameId, modeId);

  if (!gameConfig || !modeConfig) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Please select a game and mode first
      </div>
    );
  }

  const teamSizes = modeConfig.teamSizes;
  const isTeamsLocked = modeConfig.maxTeams === 2;
  const currentMaxTeams = getMaxTeams(gameId, modeId, data.team_size);

  const handleTeamSizeChange = (size: number) => {
    const newMaxTeams = getMaxTeams(gameId, modeId, size);
    onChange({
      team_size: size,
      // If max teams is locked (e.g., BGMI always 2 teams), set it automatically
      max_teams: isTeamsLocked ? 2 : Math.min(data.max_teams, newMaxTeams),
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Tournament Details
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Set up your {gameConfig.name} - {modeConfig.name} tournament
        </p>
      </div>

      {/* Tournament Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tournament Name *
        </label>
        <input
          type="text"
          value={data.tournament_name}
          onChange={(e) => onChange({ tournament_name: e.target.value })}
          placeholder={`e.g., ${gameConfig.name} ${modeConfig.name} Championship`}
          className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                     text-gray-900 dark:text-white placeholder-gray-400
                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                     ${errors.tournament_name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
        />
        {errors.tournament_name && (
          <p className="mt-1 text-sm text-red-500">{errors.tournament_name}</p>
        )}
      </div>

      {/* Team Size Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Team Size *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {teamSizes.map((ts: TeamSizeOption) => (
            <button
              key={ts.value}
              type="button"
              onClick={() => handleTeamSizeChange(ts.value)}
              className={`p-4 rounded-xl border-2 text-center transition-all
                ${data.team_size === ts.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
            >
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                {ts.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {ts.description}
              </div>
            </button>
          ))}
        </div>
        {errors.team_size && (
          <p className="mt-1 text-sm text-red-500">{errors.team_size}</p>
        )}
      </div>

      {/* Max Teams */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Max Teams *
        </label>
        {isTeamsLocked ? (
          <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-orange-500">⚠️</span>
              <span className="text-orange-700 dark:text-orange-400 font-medium">
                {modeConfig.name} mode always has 2 teams
              </span>
            </div>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
              This is a game restriction and cannot be changed.
            </p>
          </div>
        ) : (
          <>
            <input
              type="number"
              value={data.max_teams}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 2;
                onChange({ max_teams: Math.min(value, currentMaxTeams) });
              }}
              min={2}
              max={currentMaxTeams}
              className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                        text-gray-900 dark:text-white
                        focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                        ${errors.max_teams ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Maximum allowed for {modeConfig.name} with {data.team_size} players per team: {currentMaxTeams}
            </p>
          </>
        )}
        {errors.max_teams && (
          <p className="mt-1 text-sm text-red-500">{errors.max_teams}</p>
        )}
      </div>

      {/* Map Selection */}
      {gameConfig.maps.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Map
          </label>
          <div className="flex flex-wrap gap-2">
            {gameConfig.maps.map((map) => (
              <button
                key={map}
                type="button"
                onClick={() => onChange({ map_name: map })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${data.map_name === map
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
              >
                {map}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Online/Offline Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tournament Location
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ is_online: true, venue: undefined })}
            className={`p-4 rounded-xl border-2 text-center transition-all
              ${data.is_online
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300"
              }`}
          >
            <span className="text-2xl">🌐</span>
            <div className="font-medium text-gray-900 dark:text-white mt-2">Online</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Play from anywhere</div>
          </button>
          <button
            type="button"
            onClick={() => onChange({ is_online: false })}
            className={`p-4 rounded-xl border-2 text-center transition-all
              ${!data.is_online
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300"
              }`}
          >
            <span className="text-2xl">📍</span>
            <div className="font-medium text-gray-900 dark:text-white mt-2">Offline</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">At a venue</div>
          </button>
        </div>
      </div>

      {/* Venue (if offline) */}
      {!data.is_online && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Venue Name *
          </label>
          <input
            type="text"
            value={data.venue || ''}
            onChange={(e) => onChange({ venue: e.target.value })}
            placeholder="e.g., Gaming Arena, City Convention Center"
            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-white placeholder-gray-400
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                       ${errors.venue ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
          />
          {errors.venue && (
            <p className="mt-1 text-sm text-red-500">{errors.venue}</p>
          )}
        </div>
      )}

      {/* Entry Fee & Prize Pool */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Entry Fee (₹)
          </label>
          <input
            type="number"
            value={data.entry_fee}
            onChange={(e) => onChange({ entry_fee: parseInt(e.target.value) || 0 })}
            min={0}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl 
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {gameConfig.entryFeeSuggestions.slice(0, 4).map((fee) => (
              <button
                key={fee}
                type="button"
                onClick={() => onChange({ entry_fee: fee })}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 
                          rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {fee === 0 ? "Free" : `₹${fee}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Prize Pool (₹)
          </label>
          <input
            type="number"
            value={data.prize_pool}
            onChange={(e) => onChange({ prize_pool: parseInt(e.target.value) || 0 })}
            min={0}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl 
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {gameConfig.prizeSuggestions.slice(0, 4).map((prize) => (
              <button
                key={prize}
                type="button"
                onClick={() => onChange({ prize_pool: prize })}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 
                          rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                ₹{prize}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Configuration Summary */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Configuration Summary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Game</span>
            <p className="font-medium text-gray-900 dark:text-white">{gameConfig.name}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Mode</span>
            <p className="font-medium text-gray-900 dark:text-white">{modeConfig.name}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Team Size</span>
            <p className="font-medium text-gray-900 dark:text-white">{data.team_size}v{data.team_size}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Max Teams</span>
            <p className="font-medium text-gray-900 dark:text-white">{data.max_teams}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

