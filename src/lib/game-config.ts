/**
 * Game Configuration for Tournament Creation
 * 
 * This file defines all supported games, modes, team sizes, and validation rules
 * for the tournament creation wizard.
 * 
 * 🎮 Supported Games:
 * - Free Fire: BR Ranked (Solo/Duo/Squad), Clash Squad (1v1-4v4, 2 teams only, no location)
 * - BGMI: Battle Royale (Solo:100p/Duo:50t/Squad:25t, maps required), TDM (1v1-4v4, 2 teams)
 * - Valorant: Placeholder (5v5)
 * - CODM: Placeholder (BR/Multiplayer)
 * 
 * 📋 Strict Rules:
 * - Free Fire Clash Squad: NO location field, always 2 teams
 * - BGMI BR: Maps REQUIRED, registration caps vary by team size
 * - BGMI TDM: Always 2 teams
 */

// ============ Type Definitions ============

export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | 'battle_royale';

export interface TeamSizeOption {
  value: number;
  label: string;
  description: string;
  maxRegistrations: number; // Max teams or players for this team size
}

export interface GameMode {
  id: string;
  name: string;
  description: string;
  maxTeams: number;
  teamSizes: TeamSizeOption[];
  isPlaceholder?: boolean;
  hideLocation?: boolean;       // Hide location field (e.g., Clash Squad)
  requiresMap?: boolean;        // Map selection required (e.g., BGMI BR)
  supportedFormats: BracketFormat[];
}

export interface GameConfig {
  id: string;
  name: string;
  icon: string;
  modes: GameMode[];
  maps: string[];
  defaultMap: string;
  defaultRules: string;
  defaultDescription: string;
  prizeSuggestions: number[];
  entryFeeSuggestions: number[];
  recommendedDurationHours: number;
  registrationWindowHours: number;
}

// ============ Bracket Format Options ============

export const BRACKET_FORMATS: Record<BracketFormat, { label: string; description: string }> = {
  single_elimination: { label: "Single Elimination", description: "Lose once and you're out" },
  double_elimination: { label: "Double Elimination", description: "Lose twice to be eliminated" },
  round_robin: { label: "Round Robin", description: "Everyone plays everyone" },
  swiss: { label: "Swiss System", description: "Matched by performance" },
  battle_royale: { label: "Battle Royale", description: "Last team standing wins" },
};

// ============ Team Size Options ============

// Standard team vs team options (for Clash Squad, TDM)
const STANDARD_TEAM_SIZES: TeamSizeOption[] = [
  { value: 1, label: "1v1", description: "Single player vs single player", maxRegistrations: 2 },
  { value: 2, label: "2v2", description: "2 players per team", maxRegistrations: 2 },
  { value: 3, label: "3v3", description: "3 players per team", maxRegistrations: 2 },
  { value: 4, label: "4v4", description: "4 players per team", maxRegistrations: 2 },
];

// ============ Game Configurations ============

export const GAME_CONFIGS: Record<string, GameConfig> = {
  freefire: {
    id: "freefire",
    name: "Free Fire",
    icon: "🔥",
    modes: [
      {
        id: "br_ranked",
        name: "BR Ranked",
        description: "Classic Battle Royale mode",
        maxTeams: 48,
        teamSizes: [
          { value: 1, label: "Solo", description: "48 players free-for-all", maxRegistrations: 48 },
          { value: 2, label: "Duo", description: "24 teams of 2 players", maxRegistrations: 24 },
          { value: 4, label: "Squad", description: "12 squads of 4 players", maxRegistrations: 12 },
        ],
        supportedFormats: ['battle_royale', 'round_robin'],
      },
      {
        id: "clash_squad",
        name: "Clash Squad",
        description: "Tactical 4v4 mode - Always 2 teams",
        maxTeams: 2, // STRICT: Always 2 teams
        teamSizes: STANDARD_TEAM_SIZES,
        hideLocation: true, // NO location field for Clash Squad
        supportedFormats: ['single_elimination', 'double_elimination', 'round_robin'],
      },
    ],
    maps: ["Bermuda", "Purgatory", "Kalahari", "Nextera", "Alpine"],
    defaultMap: "Bermuda",
    defaultRules: `📋 **Tournament Rules**

1. **Match Format**
   - Classic Battle Royale mode
   - 1 match per round
   - Zone shrink: Normal speed

2. **Scoring System**
   - Kill points: 1 point per kill
   - Placement points:
     - 1st place: 15 points
     - 2nd place: 12 points
     - 3rd place: 10 points
     - 4th-6th: 6 points
     - 7th-12th: 3 points

3. **General Rules**
   - No teaming with other players/teams
   - No use of hacks or exploits
   - Room ID shared 15 mins before match
   - Late joiners will be disqualified
   - Screenshot of results required

4. **Device Requirements**
   - Emulators NOT allowed
   - Only mobile devices permitted`,
    defaultDescription: "Join the ultimate Free Fire battle royale tournament! Compete against the best players and win exciting prizes.",
    prizeSuggestions: [100, 250, 500, 1000, 2500, 5000],
    entryFeeSuggestions: [0, 10, 25, 50, 100],
    recommendedDurationHours: 2,
    registrationWindowHours: 4,
  },

  bgmi: {
    id: "bgmi",
    name: "BGMI",
    icon: "🎮",
    modes: [
      {
        id: "br",
        name: "Battle Royale",
        description: "Classic BR - Maps required",
        maxTeams: 100, // Solo cap, varies by team size
        teamSizes: [
          { value: 1, label: "Solo", description: "100 players (individual)", maxRegistrations: 100 },
          { value: 2, label: "Duo", description: "50 teams (2 players each)", maxRegistrations: 50 },
          { value: 4, label: "Squad", description: "25 teams (4 players each)", maxRegistrations: 25 },
        ],
        requiresMap: true, // Map selection is REQUIRED
        supportedFormats: ['battle_royale', 'round_robin'],
      },
      {
        id: "tdm",
        name: "TDM",
        description: "Team Deathmatch - Always 2 teams",
        maxTeams: 2, // STRICT: Always 2 teams
        teamSizes: STANDARD_TEAM_SIZES,
        supportedFormats: ['single_elimination', 'double_elimination', 'round_robin'],
      },
    ],
    maps: ["Erangel", "Miramar", "Sanhok", "Vikendi", "Livik", "Karakin"],
    defaultMap: "Erangel",
    defaultRules: `📋 **Tournament Rules**

1. **Match Format**
   - TPP/FPP as specified
   - 1 match per round
   - Weather: Random

2. **Scoring System**
   - Kill points: 1 point per kill
   - Winner takes all placement points

3. **General Rules**
   - No teaming with enemies
   - No use of triggers or external devices
   - No exploiting bugs or glitches
   - Room credentials shared 10 mins before
   - Report results with screenshots

4. **Device Requirements**
   - Mobile devices only
   - Emulators NOT allowed
   - Stable internet required`,
    defaultDescription: "Battle it out in the ultimate BGMI tournament! Show your survival skills and tactical prowess.",
    prizeSuggestions: [200, 500, 1000, 2000, 5000, 10000],
    entryFeeSuggestions: [0, 20, 50, 100, 200],
    recommendedDurationHours: 2,
    registrationWindowHours: 4,
  },

  valorant: {
    id: "valorant",
    name: "Valorant",
    icon: "⚔️",
    modes: [
      {
        id: "competitive",
        name: "Competitive 5v5",
        description: "Standard competitive mode (Coming Soon)",
        maxTeams: 16,
        teamSizes: [
          { value: 5, label: "5v5", description: "Standard 5v5 competitive", maxRegistrations: 16 },
        ],
        isPlaceholder: true,
        supportedFormats: ['single_elimination', 'double_elimination', 'swiss'],
      },
    ],
    maps: ["Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture", "Pearl", "Lotus", "Sunset"],
    defaultMap: "Ascent",
    defaultRules: `📋 **Tournament Rules**

Coming soon - Valorant tournament support will be added in a future update.

1. **Match Format**
   - 5v5 Competitive mode
   - Best of 1 (Bo1) - Group stage
   - Best of 3 (Bo3) - Finals

2. **General Rules**
   - No cheats or exploits
   - Players must use tournament accounts
   - Screenshots required after each match`,
    defaultDescription: "Compete in our Valorant 5v5 tournament! (Coming Soon)",
    prizeSuggestions: [500, 1000, 2500, 5000, 10000, 25000],
    entryFeeSuggestions: [0, 50, 100, 200, 500],
    recommendedDurationHours: 4,
    registrationWindowHours: 24,
  },

  codm: {
    id: "codm",
    name: "Call of Duty Mobile",
    icon: "🎯",
    modes: [
      {
        id: "br",
        name: "Battle Royale",
        description: "Classic BR mode (Coming Soon)",
        maxTeams: 100,
        teamSizes: [
          { value: 1, label: "Solo", description: "100 players BR", maxRegistrations: 100 },
          { value: 2, label: "Duo", description: "50 teams of 2", maxRegistrations: 50 },
          { value: 4, label: "Squad", description: "25 squads of 4", maxRegistrations: 25 },
        ],
        isPlaceholder: true,
        supportedFormats: ['battle_royale', 'round_robin'],
      },
      {
        id: "multiplayer",
        name: "Multiplayer",
        description: "5v5 multiplayer modes (Coming Soon)",
        maxTeams: 2,
        teamSizes: [
          { value: 5, label: "5v5", description: "Standard multiplayer", maxRegistrations: 2 },
        ],
        isPlaceholder: true,
        supportedFormats: ['single_elimination', 'double_elimination'],
      },
    ],
    maps: ["Isolated", "Blackout", "Alcatraz"],
    defaultMap: "Isolated",
    defaultRules: `📋 **Tournament Rules**

Coming soon - CODM tournament support will be added in a future update.

1. **Match Format**
   - Battle Royale / Multiplayer
   - Platform: All (Unified)

2. **General Rules**
   - No teaming or collusion
   - No use of external tools
   - Room code shared 10 mins before`,
    defaultDescription: "Drop into COD Mobile tournament! (Coming Soon)",
    prizeSuggestions: [150, 300, 500, 1000, 2500, 5000],
    entryFeeSuggestions: [0, 15, 30, 50, 100],
    recommendedDurationHours: 2,
    registrationWindowHours: 4,
  },
};

// ============ Helper Functions ============

export const SUPPORTED_GAMES = Object.keys(GAME_CONFIGS);

export function getGameConfig(gameId: string): GameConfig | undefined {
  return GAME_CONFIGS[gameId];
}

export function getGameModes(gameId: string): GameMode[] {
  return GAME_CONFIGS[gameId]?.modes || [];
}

export function getGameMode(gameId: string, modeId: string): GameMode | undefined {
  return GAME_CONFIGS[gameId]?.modes.find(m => m.id === modeId);
}

export function getTeamSizes(gameId: string, modeId: string): TeamSizeOption[] {
  const mode = getGameMode(gameId, modeId);
  return mode?.teamSizes || [];
}

export function getMaxTeams(gameId: string, modeId: string, teamSize: number): number {
  const mode = getGameMode(gameId, modeId);
  if (!mode) return 2;

  // Find the team size option to get maxRegistrations
  const teamSizeOption = mode.teamSizes.find(ts => ts.value === teamSize);
  if (teamSizeOption) {
    return teamSizeOption.maxRegistrations;
  }

  return mode.maxTeams;
}

/**
 * Check if location field should be hidden for this mode
 */
export function shouldHideLocation(gameId: string, modeId: string): boolean {
  const mode = getGameMode(gameId, modeId);
  return mode?.hideLocation === true;
}

/**
 * Check if map selection is required for this mode
 */
export function isMapRequired(gameId: string, modeId: string): boolean {
  const mode = getGameMode(gameId, modeId);
  return mode?.requiresMap === true;
}

/**
 * Get supported bracket formats for a mode
 */
export function getSupportedFormats(gameId: string, modeId: string): BracketFormat[] {
  const mode = getGameMode(gameId, modeId);
  return mode?.supportedFormats || ['single_elimination'];
}

export function isValidCombination(gameId: string, modeId: string, teamSize: number): boolean {
  const mode = getGameMode(gameId, modeId);
  if (!mode) return false;
  return mode.teamSizes.some(ts => ts.value === teamSize);
}

export function validateTournamentConfig(
  gameId: string,
  modeId: string,
  teamSize: number,
  maxTeams: number,
  mapName?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const gameConfig = getGameConfig(gameId);
  if (!gameConfig) {
    errors.push(`Invalid game: ${gameId}`);
    return { valid: false, errors };
  }

  const mode = getGameMode(gameId, modeId);
  if (!mode) {
    errors.push(`Invalid mode for ${gameConfig.name}: ${modeId}`);
    return { valid: false, errors };
  }

  if (mode.isPlaceholder) {
    errors.push(`${mode.name} is not yet available for ${gameConfig.name}`);
    return { valid: false, errors };
  }

  if (!isValidCombination(gameId, modeId, teamSize)) {
    const validSizes = mode.teamSizes.map(ts => ts.label).join(", ");
    errors.push(`Invalid team size for ${mode.name}. Valid options: ${validSizes}`);
  }

  const allowedMaxTeams = getMaxTeams(gameId, modeId, teamSize);
  if (maxTeams > allowedMaxTeams) {
    const sizeLabel = mode.teamSizes.find(ts => ts.value === teamSize)?.label || `${teamSize}v${teamSize}`;
    errors.push(`Max registrations cannot exceed ${allowedMaxTeams} for ${mode.name} ${sizeLabel}`);
  }

  if (maxTeams < 2) {
    errors.push("Must have at least 2 teams/players");
  }

  // Check if map is required but not provided
  if (mode.requiresMap && !mapName) {
    errors.push(`Map selection is required for ${mode.name}`);
  }

  return { valid: errors.length === 0, errors };
}

// ============ Smart Date Generation ============

export function generateSmartDates(gameId: string) {
  const gameConfig = getGameConfig(gameId);
  const durationHours = gameConfig?.recommendedDurationHours || 2;
  const regWindowHours = gameConfig?.registrationWindowHours || 4;
  
  const now = new Date();
  
  // Registration starts in 1 hour (rounded to next half hour)
  const regStart = new Date(now);
  regStart.setMinutes(Math.ceil(regStart.getMinutes() / 30) * 30, 0, 0);
  regStart.setHours(regStart.getHours() + 1);
  
  // Registration ends based on game's window
  const regEnd = new Date(regStart);
  regEnd.setHours(regEnd.getHours() + regWindowHours);
  
  // Tournament starts after registration ends (30 min buffer)
  const tournamentStart = new Date(regEnd);
  tournamentStart.setMinutes(tournamentStart.getMinutes() + 30);
  
  // Tournament ends based on game's duration
  const tournamentEnd = new Date(tournamentStart);
  tournamentEnd.setHours(tournamentEnd.getHours() + durationHours);
  
  return {
    registration_start_date: formatDateTimeLocal(regStart),
    registration_end_date: formatDateTimeLocal(regEnd),
    tournament_start_date: formatDateTimeLocal(tournamentStart),
    tournament_end_date: formatDateTimeLocal(tournamentEnd),
  };
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ============ API Payload Types ============

export interface TournamentPayload {
  // Core required fields
  name: string;
  game: string;
  mode: string;
  teamSize: number;
  maxTeams: number;
  
  // Registration fields
  registrationFields: {
    requireTeamName: boolean;
    requirePlayerNames: boolean;
    requireGameIds: boolean;
    customFields?: Array<{
      name: string;
      type: "text" | "number" | "select";
      required: boolean;
      options?: string[];
    }>;
  };
  
  // Schedule
  registrationStartDate: string;
  registrationEndDate: string;
  tournamentStartDate: string;
  tournamentEndDate?: string;
  
  // Location
  isOnline: boolean;
  venue?: string;
  venueAddress?: string;
  
  // Optional fields
  description?: string;
  rules?: string;
  mapName?: string;
  entryFee?: number;
  prizePool?: number;
  
  // Auto-scheduling
  scheduleType?: "once" | "everyday";
  publishTime?: string;
}

// ============ Example Payloads ============

export const EXAMPLE_PAYLOADS = {
  freefire_br_squad: {
    name: "Free Fire BR Championship",
    game: "freefire",
    mode: "br_ranked",
    teamSize: 4,
    maxTeams: 12,
    registrationFields: {
      requireTeamName: true,
      requirePlayerNames: true,
      requireGameIds: true,
    },
    registrationStartDate: "2026-01-12T10:00",
    registrationEndDate: "2026-01-12T14:00",
    tournamentStartDate: "2026-01-12T14:30",
    tournamentEndDate: "2026-01-12T16:30",
    isOnline: true,
    mapName: "Bermuda",
    entryFee: 50,
    prizePool: 1000,
  },

  freefire_clash_squad: {
    name: "Free Fire Clash Squad 4v4",
    game: "freefire",
    mode: "clash_squad",
    teamSize: 4,
    maxTeams: 2, // Always 2 teams
    registrationFields: {
      requireTeamName: true,
      requirePlayerNames: true,
      requireGameIds: true,
    },
    registrationStartDate: "2026-01-12T10:00",
    registrationEndDate: "2026-01-12T14:00",
    tournamentStartDate: "2026-01-12T14:30",
    tournamentEndDate: "2026-01-12T15:30",
    isOnline: true,
    mapName: "Bermuda",
    entryFee: 25,
    prizePool: 500,
  },

  bgmi_br: {
    name: "BGMI BR Showdown",
    game: "bgmi",
    mode: "br",
    teamSize: 4,
    maxTeams: 2, // Always 2 teams
    registrationFields: {
      requireTeamName: true,
      requirePlayerNames: true,
      requireGameIds: true,
    },
    registrationStartDate: "2026-01-12T10:00",
    registrationEndDate: "2026-01-12T14:00",
    tournamentStartDate: "2026-01-12T14:30",
    tournamentEndDate: "2026-01-12T16:30",
    isOnline: true,
    mapName: "Erangel",
    entryFee: 100,
    prizePool: 2000,
  },

  bgmi_tdm: {
    name: "BGMI TDM Battle",
    game: "bgmi",
    mode: "tdm",
    teamSize: 4,
    maxTeams: 2, // Always 2 teams
    registrationFields: {
      requireTeamName: true,
      requirePlayerNames: true,
      requireGameIds: true,
    },
    registrationStartDate: "2026-01-12T10:00",
    registrationEndDate: "2026-01-12T12:00",
    tournamentStartDate: "2026-01-12T12:30",
    tournamentEndDate: "2026-01-12T13:30",
    isOnline: true,
    entryFee: 50,
    prizePool: 500,
  },
};
