"use client";

import { getGameConfig, getGameMode, BRACKET_FORMATS } from "@/lib/game-config";
import { BasicInfoData } from "./BasicInfoStep";
import { ScheduleData } from "./ScheduleStep";
import { RulesData } from "./RulesStep";

interface PreviewStepProps {
  gameId: string;
  modeId: string;
  basicInfo: BasicInfoData;
  schedule: ScheduleData;
  rules: RulesData;
  isEditMode?: boolean;
}

export default function PreviewStep({ gameId, modeId, basicInfo, schedule, rules, isEditMode = false }: PreviewStepProps) {
  const gameConfig = getGameConfig(gameId);
  const modeConfig = getGameMode(gameId, modeId);
  const teamSizeLabel = modeConfig?.teamSizes.find(ts => ts.value === basicInfo.team_size)?.label || `${basicInfo.team_size}v${basicInfo.team_size}`;

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (!gameConfig || !modeConfig) {
    return <div className="text-center py-8 text-gray-500">Configuration not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isEditMode ? "Review & Update" : "Review & Publish"}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          {isEditMode ? "Review your changes before updating" : "Review your tournament details before publishing"}
        </p>
      </div>

      {/* Tournament Card Preview */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-1">
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
          {/* Banner Area */}
          <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-6xl">{gameConfig.icon}</span>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {basicInfo.tournament_name || "Untitled Tournament"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {gameConfig.name} • {modeConfig.name} • {teamSizeLabel}
                </p>
              </div>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 
                             text-sm font-medium rounded-full">
                {schedule.schedule_type === "everyday" ? "🔄 Daily" : "📅 One-time"}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {basicInfo.max_teams}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {basicInfo.team_size === 1 ? "Players" : "Teams"}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {teamSizeLabel}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Team Size</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {BRACKET_FORMATS[basicInfo.bracket_format]?.label || "N/A"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Format</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ₹{basicInfo.prize_pool}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Prize Pool</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {basicInfo.entry_fee > 0 ? `₹${basicInfo.entry_fee}` : "Free"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Entry Fee</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {basicInfo.map_name || "N/A"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Map</p>
              </div>
            </div>

            {/* Location Badge */}
            <div className="mt-4">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium
                ${basicInfo.is_online
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                }`}>
                {basicInfo.is_online ? "🌐 Online Tournament" : `📍 ${basicInfo.venue || "Offline Venue"}`}
              </span>
            </div>

            {/* Schedule Info */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Registration Opens</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(schedule.registration_start_date)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Registration Closes</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(schedule.registration_end_date)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Tournament Start</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(schedule.tournament_start_date)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Tournament End</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(schedule.tournament_end_date)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description Preview */}
      {rules.description && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">📝 Description</h4>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {rules.description}
          </p>
        </div>
      )}

      {/* Rules Preview */}
      {rules.match_rules && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">📋 Match Rules</h4>
          <div className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap text-sm font-mono">
            {rules.match_rules}
          </div>
        </div>
      )}

      {/* Confirmation */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-green-500 text-xl">✅</span>
          <div>
            <h4 className="font-medium text-green-800 dark:text-green-300">Ready to Publish</h4>
            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
              {schedule.schedule_type === "everyday" 
                ? `This tournament template will auto-publish every day at ${schedule.publish_time || "the scheduled time"}.`
                : "Your tournament will be visible to players once published. You can edit it until it starts."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
