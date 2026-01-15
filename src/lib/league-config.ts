/**
 * League Mode Configuration & Validation
 * 
 * Handles slot validation, lobby calculations, and business rules
 * for Free Fire and BGMI league tournaments.
 * 
 * 🎮 Slot Rules:
 * - Free Fire: Solo (50x), Duo (24x), Squad (12x)
 * - BGMI: Solo (100x), Duo (50x), Squad (25x)
 * 
 * 🏟️ Teams per Lobby:
 * - Solo: 48 players per lobby
 * - Duo: 24 teams per lobby
 * - Squad: 12 teams per lobby
 */

// ============ Types ============

export type LeagueGame = 'freefire' | 'bgmi';
export type LeagueMode = 'solo' | 'duo' | 'squad';

export interface SlotRule {
  multiple: number;
  minSlots: number;
  maxSlots: number;
  teamsPerLobby: number;
}

export interface LeagueValidationResult {
  valid: boolean;
  error?: string;
  lobbyCount?: number;
  teamsPerLobby?: number;
  totalCapacity?: number;
}

export interface LobbyInfo {
  lobbyNumber: number;
  lobbyId: string;
  lobbyPassword: string;
  maxTeams: number;
  currentTeams: number;
  status: 'pending' | 'open' | 'in_progress' | 'completed';
}

export interface LeagueMessage {
  id: number;
  tournamentId: string;
  senderId: string;
  senderUsername?: string;
  recipientType: 'global' | 'lobby' | 'team';
  recipientLobbyId?: number;
  recipientLobbyNumber?: number;
  recipientTeamId?: number;
  recipientTeamName?: string;
  content: string;
  isDeleted: boolean;
  deletableUntil: Date;
  canDelete: boolean;
  createdAt: Date;
}

// ============ Configuration ============

/**
 * Slot validation rules per game and mode
 */
export const SLOT_RULES: Record<LeagueGame, Record<LeagueMode, SlotRule>> = {
  freefire: {
    solo: { multiple: 50, minSlots: 50, maxSlots: 500, teamsPerLobby: 48 },
    duo: { multiple: 24, minSlots: 24, maxSlots: 240, teamsPerLobby: 24 },
    squad: { multiple: 12, minSlots: 12, maxSlots: 120, teamsPerLobby: 12 },
  },
  bgmi: {
    solo: { multiple: 100, minSlots: 100, maxSlots: 1000, teamsPerLobby: 48 },
    duo: { multiple: 50, minSlots: 50, maxSlots: 500, teamsPerLobby: 24 },
    squad: { multiple: 25, minSlots: 25, maxSlots: 250, teamsPerLobby: 12 },
  },
};

/**
 * Teams per lobby (fixed across games)
 */
export const TEAMS_PER_LOBBY: Record<LeagueMode, number> = {
  solo: 48,  // 48 individual players
  duo: 24,   // 24 teams of 2
  squad: 12, // 12 teams of 4
};

/**
 * Players per team based on mode
 */
export const PLAYERS_PER_TEAM: Record<LeagueMode, number> = {
  solo: 1,
  duo: 2,
  squad: 4,
};

/**
 * Message delete window in minutes
 */
export const MESSAGE_DELETE_WINDOW_MINUTES = 5;

// ============ Validation Functions ============

/**
 * Check if a game supports league mode
 */
export function isLeagueGameSupported(game: string): game is LeagueGame {
  return game === 'freefire' || game === 'bgmi';
}

/**
 * Check if a mode is valid for league
 */
export function isLeagueModeValid(mode: string): mode is LeagueMode {
  return mode === 'solo' || mode === 'duo' || mode === 'squad';
}

/**
 * Get slot validation rule for game and mode
 */
export function getSlotRule(game: LeagueGame, mode: LeagueMode): SlotRule {
  return SLOT_RULES[game][mode];
}

/**
 * Validate total slots for a league tournament
 */
export function validateLeagueSlots(
  game: string,
  mode: string,
  totalSlots: number
): LeagueValidationResult {
  // Validate game
  if (!isLeagueGameSupported(game)) {
    return {
      valid: false,
      error: `League mode is only available for Free Fire and BGMI. Got: ${game}`,
    };
  }

  // Validate mode
  if (!isLeagueModeValid(mode)) {
    return {
      valid: false,
      error: `Invalid mode: ${mode}. Must be solo, duo, or squad.`,
    };
  }

  const rule = getSlotRule(game, mode);

  // Check positive
  if (totalSlots <= 0) {
    return {
      valid: false,
      error: 'Total slots must be a positive number.',
    };
  }

  // Check minimum
  if (totalSlots < rule.minSlots) {
    return {
      valid: false,
      error: `Minimum ${rule.minSlots} slots required for ${game.toUpperCase()} ${mode} mode.`,
    };
  }

  // Check maximum
  if (totalSlots > rule.maxSlots) {
    return {
      valid: false,
      error: `Maximum ${rule.maxSlots} slots allowed for ${game.toUpperCase()} ${mode} mode.`,
    };
  }

  // Check multiple
  if (totalSlots % rule.multiple !== 0) {
    return {
      valid: false,
      error: `${game.toUpperCase()} ${mode} mode requires slots to be a multiple of ${rule.multiple}. Got: ${totalSlots}`,
    };
  }

  // Calculate lobbies
  const teamsPerLobby = TEAMS_PER_LOBBY[mode];
  const lobbyCount = Math.ceil(totalSlots / teamsPerLobby);
  const totalCapacity = lobbyCount * teamsPerLobby;

  return {
    valid: true,
    lobbyCount,
    teamsPerLobby,
    totalCapacity,
  };
}

/**
 * Calculate lobby count from slots
 */
export function calculateLobbyCount(mode: LeagueMode, totalSlots: number): number {
  const teamsPerLobby = TEAMS_PER_LOBBY[mode];
  return Math.ceil(totalSlots / teamsPerLobby);
}

/**
 * Get friendly slot rule description
 */
export function getSlotRuleDescription(game: LeagueGame, mode: LeagueMode): string {
  const rule = getSlotRule(game, mode);
  const gameName = game === 'freefire' ? 'Free Fire' : 'BGMI';
  return `${gameName} ${mode}: multiples of ${rule.multiple} (min: ${rule.minSlots}, max: ${rule.maxSlots})`;
}

/**
 * Get all valid slot options for a game and mode
 */
export function getValidSlotOptions(game: LeagueGame, mode: LeagueMode): number[] {
  const rule = getSlotRule(game, mode);
  const options: number[] = [];
  for (let i = rule.minSlots; i <= rule.maxSlots; i += rule.multiple) {
    options.push(i);
  }
  return options;
}

// ============ Lobby Functions ============

/**
 * Generate unique lobby ID for a tournament
 */
export function generateLobbyId(tournamentId: string, lobbyNumber: number): string {
  const shortId = tournamentId.slice(0, 8);
  return `L${shortId}-${String(lobbyNumber).padStart(3, '0')}`;
}

/**
 * Generate secure random password for lobby
 */
export function generateLobbyPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like O, 0, I, 1
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Create lobby info objects for a tournament
 */
export function generateLobbiesInfo(
  tournamentId: string,
  mode: LeagueMode,
  totalSlots: number
): Omit<LobbyInfo, 'currentTeams' | 'status'>[] {
  const lobbyCount = calculateLobbyCount(mode, totalSlots);
  const teamsPerLobby = TEAMS_PER_LOBBY[mode];
  
  const lobbies: Omit<LobbyInfo, 'currentTeams' | 'status'>[] = [];
  
  for (let i = 1; i <= lobbyCount; i++) {
    lobbies.push({
      lobbyNumber: i,
      lobbyId: generateLobbyId(tournamentId, i),
      lobbyPassword: generateLobbyPassword(),
      maxTeams: teamsPerLobby,
    });
  }
  
  return lobbies;
}

// ============ Message Functions ============

/**
 * Calculate when a message becomes undeletable
 */
export function calculateDeletableUntil(createdAt: Date): Date {
  return new Date(createdAt.getTime() + MESSAGE_DELETE_WINDOW_MINUTES * 60 * 1000);
}

/**
 * Check if a message can still be deleted
 */
export function canDeleteMessage(deletableUntil: Date): boolean {
  return new Date() < deletableUntil;
}

/**
 * Get remaining delete time in seconds
 */
export function getRemainingDeleteTime(deletableUntil: Date): number {
  const remaining = deletableUntil.getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Format remaining delete time for display
 */
export function formatRemainingDeleteTime(deletableUntil: Date): string {
  const seconds = getRemainingDeleteTime(deletableUntil);
  if (seconds <= 0) return 'Cannot delete';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s remaining`;
  }
  return `${secs}s remaining`;
}

// ============ UI Helpers ============

/**
 * Get league mode options for UI
 */
export function getLeagueModeOptions(): { value: LeagueMode; label: string; description: string }[] {
  return [
    { value: 'solo', label: 'Solo', description: '48 players per lobby' },
    { value: 'duo', label: 'Duo', description: '24 teams (2 players each) per lobby' },
    { value: 'squad', label: 'Squad', description: '12 teams (4 players each) per lobby' },
  ];
}

/**
 * Get supported games for league mode
 */
export function getLeagueGames(): { value: LeagueGame; label: string; icon: string }[] {
  return [
    { value: 'freefire', label: 'Free Fire', icon: '🔥' },
    { value: 'bgmi', label: 'BGMI', icon: '🎯' },
  ];
}

/**
 * Get slot rule summary for display
 */
export function getSlotRuleSummary(game: LeagueGame, mode: LeagueMode): {
  multiple: number;
  min: number;
  max: number;
  teamsPerLobby: number;
  playersPerTeam: number;
} {
  const rule = getSlotRule(game, mode);
  return {
    multiple: rule.multiple,
    min: rule.minSlots,
    max: rule.maxSlots,
    teamsPerLobby: TEAMS_PER_LOBBY[mode],
    playersPerTeam: PLAYERS_PER_TEAM[mode],
  };
}

export default {
  SLOT_RULES,
  TEAMS_PER_LOBBY,
  PLAYERS_PER_TEAM,
  MESSAGE_DELETE_WINDOW_MINUTES,
  validateLeagueSlots,
  calculateLobbyCount,
  generateLobbiesInfo,
  canDeleteMessage,
  getRemainingDeleteTime,
};
