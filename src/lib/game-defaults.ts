// Game-specific defaults for tournament creation wizard
// These smart defaults pre-fill the form based on selected game type

export interface GameDefaults {
  game_type: string;
  display_name: string;
  icon: string;
  tournament_types: TournamentTypeConfig[];
  maps: string[];
  default_map: string;
  default_rules: string;
  default_description: string;
  prize_pool_suggestions: number[];
  entry_fee_suggestions: number[];
  recommended_duration_hours: number;
  registration_window_hours: number;
}

export interface TournamentTypeConfig {
  type: "solo" | "duo" | "squad";
  display_name: string;
  max_teams: number;
  team_size: number;
  description: string;
}

export const GAME_DEFAULTS: Record<string, GameDefaults> = {
  freefire: {
    game_type: "freefire",
    display_name: "Free Fire",
    icon: "🔥",
    tournament_types: [
      { type: "solo", display_name: "Solo", max_teams: 48, team_size: 1, description: "48 players battle royale" },
      { type: "duo", display_name: "Duo", max_teams: 24, team_size: 2, description: "24 teams of 2 players" },
      { type: "squad", display_name: "Squad", max_teams: 12, team_size: 4, description: "12 squads of 4 players" },
    ],
    maps: ["Bermuda", "Purgatory", "Kalahari", "Nextera", "Alpine"],
    default_map: "Bermuda",
    default_rules: `📋 **Tournament Rules**

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
    default_description: "Join the ultimate Free Fire battle royale tournament! Compete against the best players and win exciting prizes. Show your skills in intense survival gameplay.",
    prize_pool_suggestions: [100, 250, 500, 1000, 2500, 5000],
    entry_fee_suggestions: [0, 10, 25, 50, 100],
    recommended_duration_hours: 2,
    registration_window_hours: 4,
  },

  pubg: {
    game_type: "pubg",
    display_name: "PUBG Mobile / BGMI",
    icon: "🎮",
    tournament_types: [
      { type: "solo", display_name: "Solo", max_teams: 100, team_size: 1, description: "100 players battle royale" },
      { type: "duo", display_name: "Duo", max_teams: 50, team_size: 2, description: "50 teams of 2 players" },
      { type: "squad", display_name: "Squad", max_teams: 25, team_size: 4, description: "25 squads of 4 players" },
    ],
    maps: ["Erangel", "Miramar", "Sanhok", "Vikendi", "Livik", "Karakin"],
    default_map: "Erangel",
    default_rules: `📋 **Tournament Rules**

1. **Match Format**
   - Classic Battle Royale - TPP
   - 1 match per round
   - Weather: Random

2. **Scoring System**
   - Kill points: 1 point per kill
   - Placement points:
     - Winner Winner: 20 points
     - 2nd place: 15 points
     - 3rd place: 12 points
     - 4th-5th: 8 points
     - 6th-10th: 5 points
     - 11th-15th: 3 points

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
    default_description: "Battle it out in the ultimate PUBG Mobile tournament! Show your survival skills and tactical prowess to claim victory and amazing prizes.",
    prize_pool_suggestions: [200, 500, 1000, 2000, 5000, 10000],
    entry_fee_suggestions: [0, 20, 50, 100, 200],
    recommended_duration_hours: 3,
    registration_window_hours: 6,
  },

  valorant: {
    game_type: "valorant",
    display_name: "Valorant",
    icon: "⚔️",
    tournament_types: [
      { type: "squad", display_name: "5v5", max_teams: 16, team_size: 5, description: "16 teams in single elimination" },
    ],
    maps: ["Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture", "Pearl", "Lotus", "Sunset"],
    default_map: "Ascent",
    default_rules: `📋 **Tournament Rules**

1. **Match Format**
   - 5v5 Competitive mode
   - Best of 1 (Bo1) - Group stage
   - Best of 3 (Bo3) - Finals
   - Map veto system for Bo3

2. **Tournament Structure**
   - Single Elimination bracket
   - 16 teams maximum
   - All players must be in team Discord

3. **Overtime Rules**
   - First to 13 rounds wins
   - Overtime: Win by 2 (max 15-15 draw)

4. **General Rules**
   - No cheats or exploits
   - Players must use tournament accounts
   - Screenshots required after each match
   - 10 minute grace period for tech issues
   - Match must start within 5 mins of schedule

5. **Requirements**
   - PC only
   - Minimum rank requirement may apply
   - Discord for communication`,
    default_description: "Compete in our Valorant 5v5 tournament! Assemble your team, strategize, and outplay opponents in this tactical shooter competition.",
    prize_pool_suggestions: [500, 1000, 2500, 5000, 10000, 25000],
    entry_fee_suggestions: [0, 50, 100, 200, 500],
    recommended_duration_hours: 4,
    registration_window_hours: 24,
  },

  codm: {
    game_type: "codm",
    display_name: "Call of Duty Mobile",
    icon: "🎯",
    tournament_types: [
      { type: "solo", display_name: "Solo BR", max_teams: 100, team_size: 1, description: "100 players battle royale" },
      { type: "duo", display_name: "Duo BR", max_teams: 50, team_size: 2, description: "50 teams of 2 players" },
      { type: "squad", display_name: "Squad BR", max_teams: 25, team_size: 4, description: "25 squads battle royale" },
    ],
    maps: ["Isolated", "Blackout", "Alcatraz"],
    default_map: "Isolated",
    default_rules: `📋 **Tournament Rules**

1. **Match Format**
   - Battle Royale mode
   - Platform: All (Unified)
   - Class selection: Allowed

2. **Scoring System**
   - Kill points: 1 point per kill
   - Placement points:
     - 1st: 20 points
     - 2nd: 15 points
     - 3rd: 12 points
     - 4th-5th: 8 points
     - 6th-10th: 4 points

3. **General Rules**
   - No teaming or collusion
   - No use of external tools
   - No exploiting glitches
   - Room code shared 10 mins before
   - Submit result screenshots

4. **Device Requirements**
   - Mobile devices only
   - Controller support: As per lobby settings
   - Stable internet connection`,
    default_description: "Drop into COD Mobile battle royale tournament! Prove your skills in the warzone and compete for glory and prizes.",
    prize_pool_suggestions: [150, 300, 500, 1000, 2500, 5000],
    entry_fee_suggestions: [0, 15, 30, 50, 100],
    recommended_duration_hours: 2,
    registration_window_hours: 4,
  },
};

export const SUPPORTED_GAMES = Object.keys(GAME_DEFAULTS);

export function getGameDefaults(gameType: string): GameDefaults {
  return GAME_DEFAULTS[gameType] || GAME_DEFAULTS.freefire;
}

export function getTournamentTypeConfig(gameType: string, tournamentType: "solo" | "duo" | "squad"): TournamentTypeConfig | undefined {
  const game = getGameDefaults(gameType);
  return game.tournament_types.find(t => t.type === tournamentType);
}

export function getMaxTeamsForGame(gameType: string, tournamentType: "solo" | "duo" | "squad"): number {
  const config = getTournamentTypeConfig(gameType, tournamentType);
  return config?.max_teams || 48;
}

// Helper to generate smart dates
export function generateSmartDates(gameType: string) {
  const game = getGameDefaults(gameType);
  const now = new Date();
  
  // Registration starts in 1 hour (rounded to next half hour)
  const regStart = new Date(now);
  regStart.setMinutes(Math.ceil(regStart.getMinutes() / 30) * 30, 0, 0);
  regStart.setHours(regStart.getHours() + 1);
  
  // Registration ends based on game's window
  const regEnd = new Date(regStart);
  regEnd.setHours(regEnd.getHours() + game.registration_window_hours);
  
  // Tournament starts after registration ends (30 min buffer)
  const tournamentStart = new Date(regEnd);
  tournamentStart.setMinutes(tournamentStart.getMinutes() + 30);
  
  // Tournament ends based on game's duration
  const tournamentEnd = new Date(tournamentStart);
  tournamentEnd.setHours(tournamentEnd.getHours() + game.recommended_duration_hours);
  
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
