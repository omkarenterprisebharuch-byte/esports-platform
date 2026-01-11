# Tournament Creation System - Implementation Guide

## 📋 Overview

Tournament creation form for event organizers with strict game-specific rules and validation.

---

## 🎯 Core Data Model (Minimum)

```typescript
interface TournamentPayload {
  // Required
  name: string;                    // Tournament name (3-100 chars)
  game: 'freefire' | 'bgmi' | 'valorant' | 'codm';
  mode: string;                    // Game-specific mode ID
  bracket_format: BracketFormat;   // Tournament format
  team_size: number;               // Players per team
  max_teams: number;               // Max teams/players allowed
  
  // Registration
  registration_start_date: string; // ISO datetime
  registration_end_date: string;   // ISO datetime
  tournament_start_date: string;   // ISO datetime
  tournament_end_date: string;     // ISO datetime
  
  // Optional
  map_name?: string;               // Required for BGMI BR
  entry_fee?: number;              // Entry fee in ₹
  prize_pool?: number;             // Prize pool in ₹
  is_online?: boolean;             // Hidden for Clash Squad
  venue?: string;                  // Required if offline
  description?: string;            // Max 2000 chars
  rules?: string;                  // Max 5000 chars (Markdown)
}

type BracketFormat = 
  | 'single_elimination' 
  | 'double_elimination' 
  | 'round_robin' 
  | 'swiss' 
  | 'battle_royale';
```

---

## 🎮 Game Rules & Constraints (STRICT)

### 🔥 Free Fire

#### 1️⃣ BR Ranked

| Team Size | Label | Max Registrations | Description |
|-----------|-------|-------------------|-------------|
| 1 | Solo | 48 | 48 players free-for-all |
| 2 | Duo | 24 | 24 teams of 2 players |
| 4 | Squad | 12 | 12 squads of 4 players |

**Maps:** Bermuda, Purgatory, Kalahari, Nextera, Alpine  
**Supported Formats:** `battle_royale`, `round_robin`

#### 2️⃣ Clash Squad

| Team Size | Label | Max Registrations | Description |
|-----------|-------|-------------------|-------------|
| 1 | 1v1 | 2 | Single player vs single player |
| 2 | 2v2 | 2 | 2 players per team |
| 3 | 3v3 | 2 | 3 players per team |
| 4 | 4v4 | 2 | 4 players per team |

**⚠️ STRICT RULES:**
- ❌ **NO** tournament location field (always online)
- ✅ **Exactly 2 teams** always
- **Supported Formats:** `single_elimination`, `double_elimination`, `round_robin`

---

### 🟢 BGMI (Battlegrounds Mobile India)

#### 1️⃣ Battle Royale

| Team Size | Label | Max Registrations | Description |
|-----------|-------|-------------------|-------------|
| 1 | Solo | 100 | 100 players (individual) |
| 2 | Duo | 50 | 50 teams (2 players each) |
| 4 | Squad | 25 | 25 teams (4 players each) |

**Maps:** Erangel, Miramar, Sanhok, Vikendi, Livik, Karakin  
**⚠️ Map selection is REQUIRED**  
**Supported Formats:** `battle_royale`, `round_robin`

#### 2️⃣ TDM (Team Deathmatch)

| Team Size | Label | Max Registrations | Description |
|-----------|-------|-------------------|-------------|
| 1 | 1v1 | 2 | Single player vs single player |
| 2 | 2v2 | 2 | 2 players per team |
| 3 | 3v3 | 2 | 3 players per team |
| 4 | 4v4 | 2 | 4 players per team |

**⚠️ STRICT RULES:**
- ✅ **Exactly 2 teams** always
- **Supported Formats:** `single_elimination`, `double_elimination`, `round_robin`

---

### 🔵 Valorant (Placeholder - Coming Soon)

| Team Size | Label | Max Teams |
|-----------|-------|-----------|
| 5 | 5v5 | 16 |

**Maps:** Ascent, Bind, Haven, Split, Icebox, Breeze, Fracture, Pearl, Lotus, Sunset

---

### 🎯 CODM (Placeholder - Coming Soon)

#### BR Mode
| Team Size | Max Registrations |
|-----------|-------------------|
| Solo | 100 |
| Duo | 50 |
| Squad | 25 |

#### Multiplayer Mode
| Team Size | Max Teams |
|-----------|-----------|
| 5v5 | 2 |

---

## ✅ Validation Rules

### Game → Mode → Team Size Dependency

```typescript
function validateConfig(game: string, mode: string, teamSize: number, maxTeams: number, map?: string) {
  // 1. Check valid game
  if (!GAME_CONFIGS[game]) return { valid: false, error: 'Invalid game' };
  
  // 2. Check valid mode for game
  const modeConfig = GAME_CONFIGS[game].modes.find(m => m.id === mode);
  if (!modeConfig) return { valid: false, error: 'Invalid mode for game' };
  
  // 3. Check valid team size for mode
  const teamSizeOption = modeConfig.teamSizes.find(ts => ts.value === teamSize);
  if (!teamSizeOption) return { valid: false, error: 'Invalid team size for mode' };
  
  // 4. Check max teams doesn't exceed limit
  if (maxTeams > teamSizeOption.maxRegistrations) {
    return { valid: false, error: `Max registrations: ${teamSizeOption.maxRegistrations}` };
  }
  
  // 5. Check map required
  if (modeConfig.requiresMap && !map) {
    return { valid: false, error: 'Map selection required' };
  }
  
  return { valid: true };
}
```

### Enforced Constraints

| Rule | Enforcement |
|------|-------------|
| Player caps (Solo/Duo/Squad) | Auto-set based on team size |
| Team caps (Clash Squad/TDM) | Locked to 2, cannot change |
| Map selection (BGMI BR) | Required, validation fails without |
| Location field (Clash Squad) | Hidden from UI completely |
| Invalid submissions | Submit button disabled |

---

## 🖥️ UI / UX Requirements

### Dynamic Form Behavior

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Game Selection                                      │
├─────────────────────────────────────────────────────────────┤
│  [🔥 Free Fire]  [🎮 BGMI]  [⚔️ Valorant*] [🎯 CODM*]      │
│                                   * Coming Soon              │
│                                                              │
│  Mode Selection (after game selected):                       │
│  ┌────────────────────┐ ┌────────────────────┐              │
│  │ BR Ranked          │ │ Clash Squad        │              │
│  │ Solo, Duo, Squad   │ │ 1v1, 2v2, 3v3, 4v4 │              │
│  │                    │ │ ⚠️ Always 2 teams  │              │
│  │                    │ │ 🌐 Online only     │              │
│  └────────────────────┘ └────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Details                                             │
├─────────────────────────────────────────────────────────────┤
│  Tournament Name: [____________________________]            │
│                                                              │
│  Team Size: [Solo] [Duo] [Squad]  ← Dynamic based on mode   │
│                                                              │
│  Max Registrations: [24]  ← Auto-calculated / locked        │
│  ⚠️ TDM mode always has 2 teams (locked)                    │
│                                                              │
│  Map: [Erangel*] [Miramar] [Sanhok]  ← *Required for BGMI BR│
│                                                              │
│  Format: [Single Elim] [Double Elim] [Battle Royale]        │
│                                                              │
│  Location: [🌐 Online] [📍 Offline]  ← Hidden for Clash Squad│
│                                                              │
│  Entry Fee: [₹0]  Prize Pool: [₹500]                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Config Summary: BGMI | BR | Duo | 50 teams | Erangel│    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Conditional Fields

| Condition | Field Behavior |
|-----------|----------------|
| Game = Free Fire, Mode = Clash Squad | Hide location field |
| Game = BGMI, Mode = BR | Map field required |
| Mode.maxTeams = 2 | Lock max teams, show warning |
| is_online = false | Show venue field |

### Error Display

- Inline errors below each field
- Summary errors at form top
- Submit disabled until all errors cleared

---

## 💾 API / Data Persistence

### JSON Payload Structure

```json
{
  "name": "string",
  "game": "freefire|bgmi|valorant|codm",
  "mode": "string",
  "bracket_format": "single_elimination|double_elimination|round_robin|swiss|battle_royale",
  "team_size": "number",
  "max_teams": "number",
  "map_name": "string|null",
  "entry_fee": "number",
  "prize_pool": "number",
  "is_online": "boolean",
  "venue": "string|null",
  "registration_start_date": "ISO8601",
  "registration_end_date": "ISO8601",
  "tournament_start_date": "ISO8601",
  "tournament_end_date": "ISO8601",
  "description": "string",
  "rules": "string"
}
```

---

## 📦 Example API Payloads

### Free Fire BR Ranked (Squad)

```json
{
  "name": "Free Fire Friday Night Battle",
  "game": "freefire",
  "mode": "br_ranked",
  "bracket_format": "battle_royale",
  "team_size": 4,
  "max_teams": 12,
  "map_name": "Bermuda",
  "entry_fee": 50,
  "prize_pool": 1000,
  "is_online": true,
  "venue": null,
  "registration_start_date": "2026-01-15T10:00:00Z",
  "registration_end_date": "2026-01-15T18:00:00Z",
  "tournament_start_date": "2026-01-15T19:00:00Z",
  "tournament_end_date": "2026-01-15T22:00:00Z",
  "description": "Join the ultimate Free Fire squad battle!",
  "rules": "Standard BR rules apply..."
}
```

### Free Fire Clash Squad (4v4)

```json
{
  "name": "Clash Squad Championship",
  "game": "freefire",
  "mode": "clash_squad",
  "bracket_format": "single_elimination",
  "team_size": 4,
  "max_teams": 2,
  "map_name": "Bermuda",
  "entry_fee": 0,
  "prize_pool": 500,
  "is_online": true,
  "venue": null,
  "registration_start_date": "2026-01-20T14:00:00Z",
  "registration_end_date": "2026-01-20T17:00:00Z",
  "tournament_start_date": "2026-01-20T18:00:00Z",
  "tournament_end_date": "2026-01-20T20:00:00Z",
  "description": "4v4 tactical showdown!",
  "rules": "Best of 7 rounds..."
}
```

### BGMI Battle Royale (Duo)

```json
{
  "name": "BGMI Duo Showdown",
  "game": "bgmi",
  "mode": "br",
  "bracket_format": "battle_royale",
  "team_size": 2,
  "max_teams": 50,
  "map_name": "Erangel",
  "entry_fee": 100,
  "prize_pool": 5000,
  "is_online": true,
  "venue": null,
  "registration_start_date": "2026-01-25T08:00:00Z",
  "registration_end_date": "2026-01-25T16:00:00Z",
  "tournament_start_date": "2026-01-25T17:00:00Z",
  "tournament_end_date": "2026-01-25T21:00:00Z",
  "description": "50 Duo teams battle for glory!",
  "rules": "Map: Erangel (TPP)..."
}
```

### BGMI TDM (4v4)

```json
{
  "name": "TDM Arena Battle",
  "game": "bgmi",
  "mode": "tdm",
  "bracket_format": "double_elimination",
  "team_size": 4,
  "max_teams": 2,
  "map_name": "Warehouse",
  "entry_fee": 25,
  "prize_pool": 200,
  "is_online": true,
  "venue": null,
  "registration_start_date": "2026-01-30T12:00:00Z",
  "registration_end_date": "2026-01-30T14:00:00Z",
  "tournament_start_date": "2026-01-30T15:00:00Z",
  "tournament_end_date": "2026-01-30T16:30:00Z",
  "description": "4v4 TDM deathmatch!",
  "rules": "First team to 40 kills wins..."
}
```

---

## ✅ Implementation Checklist

- [x] Game configuration with modes
- [x] Team size options per mode
- [x] Max registrations per team size
- [x] Location field hiding for Clash Squad
- [x] Map required validation for BGMI BR
- [x] Bracket format selection
- [x] Dynamic form validation
- [x] Configuration summary display
- [x] Example API payloads
- [ ] Backend validation endpoint
- [ ] Tournament persistence

---

## 📁 Related Files

- `src/lib/game-config.ts` - Game configurations and validation
- `src/components/tournament-wizard/GameSelectionStep.tsx` - Game/mode selection
- `src/components/tournament-wizard/BasicInfoStep.tsx` - Details form
- `src/app/app/admin/create-tournament/page.tsx` - Wizard page
