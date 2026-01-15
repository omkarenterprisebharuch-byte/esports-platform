"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import {
  GameSelectionStep,
  BasicInfoStep,
  ScheduleStep,
  RulesStep,
  PreviewStep,
  WizardProgress,
  BasicInfoData,
  ScheduleData,
  RulesData,
} from "@/components/tournament-wizard";
import { getGameConfig, getGameMode, getMaxTeams, generateSmartDates, BracketFormat } from "@/lib/game-config";
import { validateTournamentConfig } from "@/lib/game-config";

const WIZARD_STEPS = [
  { id: 1, name: "Game", icon: "🎮" },
  { id: 2, name: "Details", icon: "📋" },
  { id: 3, name: "Schedule", icon: "📅" },
  { id: 4, name: "Rules", icon: "📜" },
  { id: 5, name: "Preview", icon: "👁️" },
];

interface WizardFormData {
  game_id: string;
  mode_id: string;
  basicInfo: BasicInfoData;
  schedule: ScheduleData;
  rules: RulesData;
}

/**
 * Create Tournament Wizard - Multi-step tournament creation
 * 
 * Features:
 * - 5-step wizard (Game → Details → Schedule → Rules → Preview)
 * - Game-specific defaults with mode selection
 * - Smart date suggestions
 * - Validation at each step with game/mode/teamSize constraints
 * - Auto-scheduling support
 */
export default function CreateTournamentWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = !!editId;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const [formData, setFormData] = useState<WizardFormData>({
    game_id: "freefire",
    mode_id: "br_ranked",
    basicInfo: {
      tournament_name: "",
      team_size: 4,
      max_teams: 12,
      entry_fee: 0,
      prize_pool: 500,
      map_name: "Bermuda",
      is_online: true,
      bracket_format: "battle_royale",
    },
    schedule: {
      registration_start_date: "",
      registration_end_date: "",
      tournament_start_date: "",
      tournament_end_date: "",
      schedule_type: "once",
      publish_time: "",
    },
    rules: {
      description: "",
      match_rules: "",
    },
  });

  // Check authorization and load tournament data if editing
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const userData = data.data;
          if (!userData.is_host && !userData.is_admin) {
            router.push("/app");
          } else {
            setIsAuthorized(true);
            // Load tournament data if editing
            if (editId) {
              loadTournamentData(editId);
            }
          }
        } else {
          router.push("/login");
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router, editId]);

  // Load existing tournament for editing
  const loadTournamentData = async (tournamentId: string) => {
    try {
      setIsLoading(true);
      const res = await secureFetch(`/api/tournaments/${tournamentId}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        const t = data.data;
        
        // Format dates for datetime-local input
        const formatDateForInput = (dateStr: string) => {
          if (!dateStr) return "";
          const d = new Date(dateStr);
          return d.toISOString().slice(0, 16);
        };
        
        setFormData({
          game_id: t.game_type || "freefire",
          mode_id: t.game_mode || "br_ranked",
          basicInfo: {
            tournament_name: t.tournament_name || "",
            team_size: t.team_size || 4,
            max_teams: t.max_teams || 12,
            entry_fee: t.entry_fee || 0,
            prize_pool: t.prize_pool || 500,
            map_name: t.map_name || "",
            is_online: t.is_online !== false,
            venue: t.venue || "",
            bracket_format: (t.bracket_format || "battle_royale") as BracketFormat,
          },
          schedule: {
            registration_start_date: formatDateForInput(t.registration_start_date),
            registration_end_date: formatDateForInput(t.registration_end_date),
            tournament_start_date: formatDateForInput(t.tournament_start_date),
            tournament_end_date: formatDateForInput(t.tournament_end_date),
            schedule_type: t.schedule_type || "once",
            publish_time: t.publish_time || "",
          },
          rules: {
            description: t.description || "",
            match_rules: t.match_rules || "",
          },
        });
      }
    } catch (error) {
      console.error("Failed to load tournament:", error);
      setMessage({ type: "error", text: "Failed to load tournament data" });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply game defaults when game changes
  const handleGameChange = (gameId: string) => {
    const gameConfig = getGameConfig(gameId);
    if (!gameConfig) return;
    
    const firstMode = gameConfig.modes.find(m => !m.isPlaceholder) || gameConfig.modes[0];
    const smartDates = generateSmartDates(gameId);
    const defaultTeamSize = firstMode.teamSizes[firstMode.teamSizes.length - 1]?.value || 4;
    const maxTeams = getMaxTeams(gameId, firstMode.id, defaultTeamSize);
    const defaultFormat = firstMode.supportedFormats?.[0] || 'single_elimination';

    setFormData((prev) => ({
      game_id: gameId,
      mode_id: firstMode.id,
      basicInfo: {
        // In edit mode, preserve tournament name and map if they exist
        tournament_name: isEditMode ? prev.basicInfo.tournament_name : "",
        team_size: defaultTeamSize,
        max_teams: maxTeams,
        entry_fee: isEditMode ? prev.basicInfo.entry_fee : 0,
        prize_pool: isEditMode ? prev.basicInfo.prize_pool : (gameConfig.prizeSuggestions[2] || 500),
        // In edit mode, preserve map if the new game supports it, otherwise use default
        map_name: isEditMode && gameConfig.maps.includes(prev.basicInfo.map_name) 
          ? prev.basicInfo.map_name 
          : gameConfig.defaultMap,
        is_online: true,
        bracket_format: defaultFormat,
      },
      schedule: isEditMode ? prev.schedule : {
        ...smartDates,
        schedule_type: "once",
        publish_time: "",
      },
      rules: isEditMode ? prev.rules : {
        description: gameConfig.defaultDescription,
        match_rules: gameConfig.defaultRules,
      },
    }));
  };

  // Handle mode change
  const handleModeChange = (modeId: string) => {
    const modeConfig = getGameMode(formData.game_id, modeId);
    if (!modeConfig) return;

    const defaultTeamSize = modeConfig.teamSizes[modeConfig.teamSizes.length - 1]?.value || 4;
    const maxTeams = getMaxTeams(formData.game_id, modeId, defaultTeamSize);
    const defaultFormat = modeConfig.supportedFormats?.[0] || 'single_elimination';

    setFormData((prev) => ({
      ...prev,
      mode_id: modeId,
      basicInfo: {
        ...prev.basicInfo,
        team_size: defaultTeamSize,
        max_teams: maxTeams,
        bracket_format: defaultFormat,
        // All tournaments are online
        is_online: true,
      },
    }));
  };

  const updateBasicInfo = (data: Partial<BasicInfoData>) => {
    setFormData((prev) => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, ...data },
    }));
    const clearedErrors = { ...errors };
    Object.keys(data).forEach((key) => delete clearedErrors[key]);
    setErrors(clearedErrors);
  };

  const updateSchedule = (data: Partial<ScheduleData>) => {
    setFormData((prev) => ({
      ...prev,
      schedule: { ...prev.schedule, ...data },
    }));
    const clearedErrors = { ...errors };
    Object.keys(data).forEach((key) => delete clearedErrors[key]);
    setErrors(clearedErrors);
  };

  const updateRules = (data: Partial<RulesData>) => {
    setFormData((prev) => ({
      ...prev,
      rules: { ...prev.rules, ...data },
    }));
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 1: // Game Selection
        const modeConfig = getGameMode(formData.game_id, formData.mode_id);
        if (!modeConfig) {
          newErrors.mode = "Please select a valid mode";
        } else if (modeConfig.isPlaceholder) {
          newErrors.mode = "This mode is not yet available";
        }
        break;

      case 2: // Basic Info
        if (!formData.basicInfo.tournament_name.trim()) {
          newErrors.tournament_name = "Tournament name is required";
        } else if (formData.basicInfo.tournament_name.length < 3) {
          newErrors.tournament_name = "Tournament name must be at least 3 characters";
        }
        
        // Validate game/mode/teamSize combination including map
        const validation = validateTournamentConfig(
          formData.game_id,
          formData.mode_id,
          formData.basicInfo.team_size,
          formData.basicInfo.max_teams,
          formData.basicInfo.map_name
        );
        if (!validation.valid) {
          validation.errors.forEach((err, idx) => {
            newErrors[`config_${idx}`] = err;
          });
        }
        break;

      case 3: // Schedule
        const { registration_start_date, registration_end_date, tournament_start_date, tournament_end_date, schedule_type, publish_time } = formData.schedule;
        
        if (!registration_start_date) newErrors.registration_start_date = "Required";
        if (!registration_end_date) newErrors.registration_end_date = "Required";
        if (!tournament_start_date) newErrors.tournament_start_date = "Required";
        if (!tournament_end_date) newErrors.tournament_end_date = "Required";

        if (registration_start_date && registration_end_date) {
          if (new Date(registration_start_date) >= new Date(registration_end_date)) {
            newErrors.registration_end_date = "Must be after registration start";
          }
        }

        if (registration_end_date && tournament_start_date) {
          if (new Date(registration_end_date) >= new Date(tournament_start_date)) {
            newErrors.tournament_start_date = "Must be after registration end";
          }
        }

        if (tournament_start_date && tournament_end_date) {
          if (new Date(tournament_start_date) >= new Date(tournament_end_date)) {
            newErrors.tournament_end_date = "Must be after tournament start";
          }
        }

        if (schedule_type === "everyday" && !publish_time) {
          newErrors.publish_time = "Daily publish time is required";
        }
        break;

      case 4: // Rules & Description
      case 4: // Rules & Description
        if (!formData.rules.description.trim()) {
          newErrors.description = "Description is required";
        } else if (formData.rules.description.length < 20) {
          newErrors.description = "Description must be at least 20 characters";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length) {
      if (validateCurrentStep()) {
        setCurrentStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setMessage(null);

    // Build payload with new structure
    const payload = {
      tournament_name: formData.basicInfo.tournament_name,
      game_type: formData.game_id,
      game_mode: formData.mode_id,
      team_size: formData.basicInfo.team_size,
      max_teams: formData.basicInfo.max_teams,
      entry_fee: formData.basicInfo.entry_fee,
      prize_pool: formData.basicInfo.prize_pool,
      map_name: formData.basicInfo.map_name,
      is_online: formData.basicInfo.is_online,
      venue: formData.basicInfo.venue,
      description: formData.rules.description,
      match_rules: formData.rules.match_rules,
      registration_start_date: formData.schedule.registration_start_date,
      registration_end_date: formData.schedule.registration_end_date,
      tournament_start_date: formData.schedule.tournament_start_date,
      tournament_end_date: formData.schedule.tournament_end_date,
      schedule_type: formData.schedule.schedule_type,
      publish_time: formData.schedule.publish_time || null,
    };

    try {
      // Use PUT for edit, POST for create
      const url = isEditMode 
        ? `/api/tournaments/${editId}` 
        : "/api/tournaments";
      
      const res = await secureFetch(url, {
        method: isEditMode ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: "success", 
          text: data.message || (isEditMode ? "Tournament updated successfully!" : "Tournament created successfully!") 
        });
        setTimeout(() => {
          router.push("/admin");
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.message || `Failed to ${isEditMode ? "update" : "create"} tournament` });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthorized === null || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={isEditMode ? "Edit Tournament" : "Create Tournament"}
        subtitle={`Step ${currentStep} of ${WIZARD_STEPS.length}: ${WIZARD_STEPS[currentStep - 1].name}`}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Progress Indicator */}
      <WizardProgress
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        allowNavigation
        onStepClick={(step) => {
          if (step < currentStep) setCurrentStep(step);
        }}
      />

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Validation Errors */}
      {Object.keys(errors).filter(k => k.startsWith("config_")).length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <h4 className="font-medium text-red-700 dark:text-red-400 mb-2">Configuration Errors:</h4>
          <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
            {Object.entries(errors)
              .filter(([k]) => k.startsWith("config_"))
              .map(([k, v]) => <li key={k}>{v}</li>)}
          </ul>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        {currentStep === 1 && (
          <GameSelectionStep
            selectedGame={formData.game_id}
            selectedMode={formData.mode_id}
            onSelectGame={handleGameChange}
            onSelectMode={handleModeChange}
          />
        )}

        {currentStep === 2 && (
          <BasicInfoStep
            gameId={formData.game_id}
            modeId={formData.mode_id}
            data={formData.basicInfo}
            onChange={updateBasicInfo}
            errors={errors}
          />
        )}

        {currentStep === 3 && (
          <ScheduleStep
            gameId={formData.game_id}
            data={formData.schedule}
            onChange={updateSchedule}
            errors={errors}
          />
        )}

        {currentStep === 4 && (
          <RulesStep
            gameId={formData.game_id}
            data={formData.rules}
            onChange={updateRules}
            errors={errors}
          />
        )}

        {currentStep === 5 && (
          <PreviewStep
            gameId={formData.game_id}
            modeId={formData.mode_id}
            basicInfo={formData.basicInfo}
            schedule={formData.schedule}
            rules={formData.rules}
            isEditMode={isEditMode}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`px-6 py-3 rounded-xl font-medium transition flex items-center gap-2
            ${currentStep === 1
              ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {currentStep < WIZARD_STEPS.length ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-900 dark:from-white dark:to-gray-100
                     text-white dark:text-gray-900 rounded-xl font-medium 
                     hover:from-gray-900 hover:to-black dark:hover:from-gray-100 dark:hover:to-white
                     transition flex items-center gap-2 shadow-lg"
          >
            Next
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-8 py-3 ${isEditMode 
              ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700" 
              : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            } text-white rounded-xl font-medium transition flex items-center gap-2 shadow-lg disabled:opacity-50`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                {isEditMode ? "Updating..." : "Publishing..."}
              </>
            ) : (
              <>
                {isEditMode ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Update Tournament
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Publish Tournament
                  </>
                )}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
