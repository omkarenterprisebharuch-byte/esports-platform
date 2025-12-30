"use client";

import { generateSmartDates, getGameDefaults } from "@/lib/game-defaults";

export interface ScheduleData {
  registration_start_date: string;
  registration_end_date: string;
  tournament_start_date: string;
  tournament_end_date: string;
  schedule_type: "once" | "everyday";
  publish_time: string;
}

interface ScheduleStepProps {
  gameType: string;
  data: ScheduleData;
  onChange: (data: Partial<ScheduleData>) => void;
  errors: Record<string, string>;
}

export default function ScheduleStep({ gameType, data, onChange, errors }: ScheduleStepProps) {
  const gameDefaults = getGameDefaults(gameType);

  const handleApplySmartDates = () => {
    const smartDates = generateSmartDates(gameType);
    onChange(smartDates);
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Schedule & Timing
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Set when registration opens and when the tournament begins
        </p>
      </div>

      {/* Smart Dates Button */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">⚡ Quick Setup</h3>
            <p className="text-sm text-indigo-100">
              Auto-fill with recommended timing ({gameDefaults.registration_window_hours}hr registration, 
              {gameDefaults.recommended_duration_hours}hr tournament)
            </p>
          </div>
          <button
            type="button"
            onClick={handleApplySmartDates}
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium 
                      hover:bg-indigo-50 transition flex-shrink-0"
          >
            Apply Smart Dates
          </button>
        </div>
      </div>

      {/* Schedule Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tournament Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ schedule_type: "once" })}
            className={`p-4 rounded-xl border-2 text-left transition-all
              ${data.schedule_type === "once"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300"
              }`}
          >
            <div className="font-semibold text-gray-900 dark:text-white">📅 One-time</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Single tournament on specific dates
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChange({ schedule_type: "everyday" })}
            className={`p-4 rounded-xl border-2 text-left transition-all
              ${data.schedule_type === "everyday"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300"
              }`}
          >
            <div className="font-semibold text-gray-900 dark:text-white">🔄 Daily Recurring</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Auto-publish every day at set time
            </div>
          </button>
        </div>
      </div>

      {/* Recurring Time */}
      {data.schedule_type === "everyday" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Daily Publish Time *
          </label>
          <input
            type="time"
            value={data.publish_time}
            onChange={(e) => onChange({ publish_time: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl 
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tournament will be auto-published at this time every day
          </p>
        </div>
      )}

      {/* Date Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Registration Start *
          </label>
          <input
            type="datetime-local"
            value={data.registration_start_date}
            onChange={(e) => onChange({ registration_start_date: e.target.value })}
            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                       ${errors.registration_start_date ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
          />
          {data.registration_start_date && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatDateDisplay(data.registration_start_date)}
            </p>
          )}
          {errors.registration_start_date && (
            <p className="mt-1 text-sm text-red-500">{errors.registration_start_date}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Registration End *
          </label>
          <input
            type="datetime-local"
            value={data.registration_end_date}
            onChange={(e) => onChange({ registration_end_date: e.target.value })}
            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                       ${errors.registration_end_date ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
          />
          {data.registration_end_date && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatDateDisplay(data.registration_end_date)}
            </p>
          )}
          {errors.registration_end_date && (
            <p className="mt-1 text-sm text-red-500">{errors.registration_end_date}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tournament Start *
          </label>
          <input
            type="datetime-local"
            value={data.tournament_start_date}
            onChange={(e) => onChange({ tournament_start_date: e.target.value })}
            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                       ${errors.tournament_start_date ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
          />
          {data.tournament_start_date && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatDateDisplay(data.tournament_start_date)}
            </p>
          )}
          {errors.tournament_start_date && (
            <p className="mt-1 text-sm text-red-500">{errors.tournament_start_date}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tournament End *
          </label>
          <input
            type="datetime-local"
            value={data.tournament_end_date}
            onChange={(e) => onChange({ tournament_end_date: e.target.value })}
            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                       ${errors.tournament_end_date ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
          />
          {data.tournament_end_date && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatDateDisplay(data.tournament_end_date)}
            </p>
          )}
          {errors.tournament_end_date && (
            <p className="mt-1 text-sm text-red-500">{errors.tournament_end_date}</p>
          )}
        </div>
      </div>

      {/* Timeline Visualization */}
      {data.registration_start_date && data.tournament_end_date && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">📊 Timeline</h4>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            
            <div className="relative pl-10 pb-4">
              <div className="absolute left-2.5 w-3 h-3 bg-green-500 rounded-full" />
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Registration Opens</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{formatDateDisplay(data.registration_start_date)}</p>
              </div>
            </div>

            <div className="relative pl-10 pb-4">
              <div className="absolute left-2.5 w-3 h-3 bg-yellow-500 rounded-full" />
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Registration Closes</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{formatDateDisplay(data.registration_end_date)}</p>
              </div>
            </div>

            <div className="relative pl-10 pb-4">
              <div className="absolute left-2.5 w-3 h-3 bg-indigo-500 rounded-full" />
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Tournament Begins</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{formatDateDisplay(data.tournament_start_date)}</p>
              </div>
            </div>

            <div className="relative pl-10">
              <div className="absolute left-2.5 w-3 h-3 bg-red-500 rounded-full" />
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Tournament Ends</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{formatDateDisplay(data.tournament_end_date)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
