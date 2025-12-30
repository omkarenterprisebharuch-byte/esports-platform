"use client";

import { getGameDefaults, TournamentTypeConfig } from "@/lib/game-defaults";

export interface BasicInfoData {
  tournament_name: string;
  tournament_type: "solo" | "duo" | "squad";
  max_teams: number;
  entry_fee: number;
  prize_pool: number;
  map_name: string;
}

interface BasicInfoStepProps {
  gameType: string;
  data: BasicInfoData;
  onChange: (data: Partial<BasicInfoData>) => void;
  errors: Record<string, string>;
}

export default function BasicInfoStep({ gameType, data, onChange, errors }: BasicInfoStepProps) {
  const gameDefaults = getGameDefaults(gameType);

  const handleTypeChange = (type: "solo" | "duo" | "squad") => {
    const typeConfig = gameDefaults.tournament_types.find(t => t.type === type);
    onChange({
      tournament_type: type,
      max_teams: typeConfig?.max_teams || data.max_teams,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Tournament Details
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Set up the basic information for your {gameDefaults.display_name} tournament
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
          placeholder={`e.g., ${gameDefaults.display_name} Championship`}
          className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                     text-gray-900 dark:text-white placeholder-gray-400
                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                     ${errors.tournament_name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
        />
        {errors.tournament_name && (
          <p className="mt-1 text-sm text-red-500">{errors.tournament_name}</p>
        )}
      </div>

      {/* Tournament Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tournament Format *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {gameDefaults.tournament_types.map((type: TournamentTypeConfig) => (
            <button
              key={type.type}
              type="button"
              onClick={() => handleTypeChange(type.type)}
              className={`p-4 rounded-xl border-2 text-left transition-all
                ${data.tournament_type === type.type
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white">
                {type.display_name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {type.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Max Teams */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Max {data.tournament_type === "solo" ? "Players" : "Teams"} *
        </label>
        <input
          type="number"
          value={data.max_teams}
          onChange={(e) => onChange({ max_teams: parseInt(e.target.value) || 0 })}
          min={2}
          max={100}
          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Recommended for {data.tournament_type}: {gameDefaults.tournament_types.find(t => t.type === data.tournament_type)?.max_teams || 48}
        </p>
      </div>

      {/* Map Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Map
        </label>
        <div className="flex flex-wrap gap-2">
          {gameDefaults.maps.map((map) => (
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
            {gameDefaults.entry_fee_suggestions.slice(0, 4).map((fee) => (
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
            {gameDefaults.prize_pool_suggestions.slice(0, 4).map((prize) => (
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
    </div>
  );
}
