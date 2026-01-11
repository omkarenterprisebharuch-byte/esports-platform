# Tournament Creation System - Game Rules & Data Model

## 📋 Overview

This document describes the tournament creation system with game-specific rules, modes, team sizes, and validation constraints.

## 🎯 Core Data Model

### Tournament Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Tournament name (3-100 chars) |
| `game` | enum | Game identifier: `freefire`, `bgmi`, `valorant`, `codm` |
| `mode` | string | Game-specific mode identifier |
| `teamSize` | number | Players per team (1-5) |
| `maxTeams` | number | Maximum teams allowed (2-100) |
| `registrationStartDate` | datetime | When registration opens |
| `registrationEndDate` | datetime | When registration closes |
| `tournamentStartDate` | datetime | Tournament start time |
| `isOnline` | boolean | Online or offline tournament |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Tournament description (max 2000 chars) |
| `rules` | string | Match rules (max 5000 chars) |
| `mapName` | string | Map selection |
| `entryFee` | number | Entry fee in ₹ (min 0) |
| `prizePool` | number | Prize pool in ₹ (min 0) |
| `venue` | string | Venue name (required if offline) |
| `tournamentEndDate` | datetime | Tournament end time |

---

## 🎮 Game Rules & Constraints

### 🔥 Free Fire

#### BR Ranked Mode
| Team Size | Max Teams | Description |
|-----------|-----------|-------------|
| Solo (1) | 48 | 48 players battle royale |
| Duo (2) | 24 | 24 teams of 2 players |
| Squad (4) | 12 | 12 squads of 4 players |

**Maps:** Bermuda, Purgatory, Kalahari, Nextera, Alpine

#### Clash Squad Mode
| Team Size | Max Teams | Description |
|-----------|-----------|-------------|
| 1v1 | 2 | 1 player per team |
| 2v2 | 2 | 2 players per team |
| 3v3 | 2 | 3 players per team |
| 4v4 | 2 | 4 players per team |

⚠️ **Constraint:** Clash Squad always has exactly **2 teams**

---

### 🟢 BGMI (Battlegrounds Mobile India)

#### BR Mode
| Team Size | Max Teams | Description |
|-----------|-----------|-------------|
| 1v1 | 2 | Single player vs single player |
| 2v2 | 2 | 2 players per team |
| 3v3 | 2 | 3 players per team |
| 4v4 | 2 | 4 players per team |

**Maps:** Erangel, Miramar, Sanhok, Vikendi, Livik, Karakin

#### TDM Mode
| Team Size | Max Teams | Description |
|-----------|-----------|-------------|
| 1v1 | 2 | Single player vs single player |
| 2v2 | 2 | 2 players per team |
| 3v3 | 2 | 3 players per team |
| 4v4 | 2 | 4 players per team |

⚠️ **Constraint:** BGMI tournaments always have exactly **2 teams**

---

### 🔵 Valorant (Placeholder)

| Team Size | Max Teams | Description |
|-----------|-----------|-------------|
| 5v5 | 16 | Standard 5v5 competitive |

**Maps:** Ascent, Bind, Haven, Split, Icebox, Breeze, Fracture, Pearl, Lotus, Sunset

📌 **Status:** Coming Soon

---

### 🎯 CODM (Placeholder)

#### BR Mode
| Team Size | Max Teams | Description |
|-----------|-----------|-------------|
| Solo | 100 | 100 players BR |
| Duo | 50 | 50 teams of 2 |
| Squad | 25 | 25 squads of 4 |

#### Multiplayer Mode
| Team Size | Max Teams | Description |
|-----------|-----------|-------------|
| 5v5 | 2 | Standard multiplayer |

**Maps:** Isolated, Blackout, Alcatraz

📌 **Status:** Coming Soon

---

## ✅ Validation Rules

### Game → Mode → Team Size Dependency

```javascript
// Valid combinations
const VALID_GAME_CONFIGS = {
  freefire: {
    br_ranked: [1, 2, 4],      // Solo, Duo, Squad
    clash_squad: [1, 2, 3, 4], // 1v1, 2v2, 3v3, 4v4
  },
  bgmi: {
    br: [1, 2, 3, 4],          // Always 2 teams
    tdm: [1, 2, 3, 4],         // Always 2 teams
  },
  valorant: {
    competitive: [5],          // 5v5 only
  },
  codm: {
    br: [1, 2, 4],             // Solo, Duo, Squad
    multiplayer: [5],          // 5v5 only
  },
};
```

### Max Teams Enforcement

```javascript
const MAX_TEAMS_CONFIG = {
  freefire: {
    br_ranked: { 1: 48, 2: 24, 4: 12 },
    clash_squad: { 1: 2, 2: 2, 3: 2, 4: 2 },
  },
  bgmi: {
    br: { 1: 2, 2: 2, 3: 2, 4: 2 },
    tdm: { 1: 2, 2: 2, 3: 2, 4: 2 },
  },
  valorant: {
    competitive: { 5: 16 },
  },
  codm: {
    br: { 1: 100, 2: 50, 4: 25 },
    multiplayer: { 5: 2 },
  },
};
```

### Date Validation
- `registrationEndDate` > `registrationStartDate`
- `tournamentStartDate` >= `registrationEndDate`
- `tournamentEndDate` > `tournamentStartDate` (if provided)

### Offline Tournament Validation
- If `isOnline === false`, then `venue` is required

---

## 🖥️ UI Wireframe (Text-Based)

```
┌─────────────────────────────────────────────────────────────┐
│ Create Tournament                                           │
│ Step 1 of 5: Game                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Choose Your Game                                           │
│  ─────────────────                                          │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 🔥 Free Fire    │  │ 🎮 BGMI        │                  │
│  │ 2 modes        ✓│  │ 2 modes         │                  │
│  │ BR, Clash Squad │  │ BR, TDM         │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ ⚔️ Valorant     │  │ 🎯 CODM        │                  │
│  │ Coming Soon     │  │ Coming Soon     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  Select Mode for Free Fire                                  │
│  ─────────────────────────                                  │
│                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐      │
│  │ BR Ranked           ✓ │  │ Clash Squad           │      │
│  │ Classic BR mode       │  │ 4v4 tactical mode     │      │
│  │ Solo, Duo, Squad      │  │ ⚠️ Always 2 teams    │      │
│  └───────────────────────┘  └───────────────────────┘      │
│                                                             │
│  ┌──────────┐                                ┌──────────┐  │
│  │  Back    │                                │   Next   │  │
│  └──────────┘                                └──────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Create Tournament                                           │
│ Step 2 of 5: Details                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tournament Name *                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Free Fire Championship                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Team Size *                                                │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                   │
│  │ 1v1  │  │ 2v2  │  │ 3v3  │  │ 4v4 ✓│                   │
│  └──────┘  └──────┘  └──────┘  └──────┘                   │
│                                                             │
│  Max Teams *                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 12                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│  Maximum allowed for Squad: 12                              │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ⚠️ Clash Squad mode always has 2 teams            │    │
│  │ This is a game restriction and cannot be changed.  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Tournament Location                                        │
│  ┌───────────────┐  ┌───────────────┐                      │
│  │ 🌐 Online   ✓ │  │ 📍 Offline    │                      │
│  └───────────────┘  └───────────────┘                      │
│                                                             │
│  Map                                                        │
│  [Bermuda✓] [Purgatory] [Kalahari] [Nextera] [Alpine]      │
│                                                             │
│  Entry Fee (₹)              Prize Pool (₹)                  │
│  ┌────────────┐             ┌────────────┐                 │
│  │ 50         │             │ 1000       │                 │
│  └────────────┘             └────────────┘                 │
│  [Free] [₹10] [₹25] [₹50]   [₹100] [₹250] [₹500] [₹1000]  │
│                                                             │
│  ┌──────────┐                                ┌──────────┐  │
│  │  Back    │                                │   Next   │  │
│  └──────────┘                                └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Tournament",
  "type": "object",
  "required": [
    "name",
    "game",
    "mode",
    "teamSize",
    "maxTeams",
    "registrationStartDate",
    "registrationEndDate",
    "tournamentStartDate",
    "isOnline"
  ],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 3,
      "maxLength": 100,
      "description": "Tournament name"
    },
    "game": {
      "type": "string",
      "enum": ["freefire", "bgmi", "valorant", "codm"],
      "description": "Game identifier"
    },
    "mode": {
      "type": "string",
      "description": "Game-specific mode identifier"
    },
    "teamSize": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "description": "Number of players per team"
    },
    "maxTeams": {
      "type": "integer",
      "minimum": 2,
      "maximum": 100,
      "description": "Maximum number of teams allowed"
    },
    "registrationFields": {
      "type": "object",
      "properties": {
        "requireTeamName": { "type": "boolean", "default": true },
        "requirePlayerNames": { "type": "boolean", "default": true },
        "requireGameIds": { "type": "boolean", "default": true },
        "customFields": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "type": { "enum": ["text", "number", "select"] },
              "required": { "type": "boolean" },
              "options": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    },
    "registrationStartDate": {
      "type": "string",
      "format": "date-time"
    },
    "registrationEndDate": {
      "type": "string",
      "format": "date-time"
    },
    "tournamentStartDate": {
      "type": "string",
      "format": "date-time"
    },
    "tournamentEndDate": {
      "type": "string",
      "format": "date-time"
    },
    "isOnline": {
      "type": "boolean",
      "default": true
    },
    "venue": {
      "type": "string",
      "maxLength": 200
    },
    "description": {
      "type": "string",
      "maxLength": 2000
    },
    "rules": {
      "type": "string",
      "maxLength": 5000
    },
    "mapName": {
      "type": "string",
      "maxLength": 100
    },
    "entryFee": {
      "type": "number",
      "minimum": 0,
      "default": 0
    },
    "prizePool": {
      "type": "number",
      "minimum": 0,
      "default": 0
    }
  }
}
```

---

## 📝 Example API Payloads

### Free Fire BR Squad

```json
{
  "name": "Free Fire BR Championship",
  "game": "freefire",
  "mode": "br_ranked",
  "teamSize": 4,
  "maxTeams": 12,
  "registrationFields": {
    "requireTeamName": true,
    "requirePlayerNames": true,
    "requireGameIds": true
  },
  "registrationStartDate": "2026-01-12T10:00:00.000Z",
  "registrationEndDate": "2026-01-12T14:00:00.000Z",
  "tournamentStartDate": "2026-01-12T14:30:00.000Z",
  "tournamentEndDate": "2026-01-12T16:30:00.000Z",
  "isOnline": true,
  "mapName": "Bermuda",
  "entryFee": 50,
  "prizePool": 1000,
  "description": "Join the ultimate Free Fire battle royale tournament!",
  "rules": "Standard BR rules apply. No teaming, no exploits."
}
```

### Free Fire Clash Squad 4v4

```json
{
  "name": "Free Fire Clash Squad 4v4",
  "game": "freefire",
  "mode": "clash_squad",
  "teamSize": 4,
  "maxTeams": 2,
  "registrationFields": {
    "requireTeamName": true,
    "requirePlayerNames": true,
    "requireGameIds": true
  },
  "registrationStartDate": "2026-01-12T10:00:00.000Z",
  "registrationEndDate": "2026-01-12T14:00:00.000Z",
  "tournamentStartDate": "2026-01-12T14:30:00.000Z",
  "tournamentEndDate": "2026-01-12T15:30:00.000Z",
  "isOnline": true,
  "mapName": "Bermuda",
  "entryFee": 25,
  "prizePool": 500
}
```

### BGMI BR 4v4

```json
{
  "name": "BGMI BR Showdown",
  "game": "bgmi",
  "mode": "br",
  "teamSize": 4,
  "maxTeams": 2,
  "registrationFields": {
    "requireTeamName": true,
    "requirePlayerNames": true,
    "requireGameIds": true
  },
  "registrationStartDate": "2026-01-12T10:00:00.000Z",
  "registrationEndDate": "2026-01-12T14:00:00.000Z",
  "tournamentStartDate": "2026-01-12T14:30:00.000Z",
  "tournamentEndDate": "2026-01-12T16:30:00.000Z",
  "isOnline": true,
  "mapName": "Erangel",
  "entryFee": 100,
  "prizePool": 2000
}
```

### BGMI TDM 2v2

```json
{
  "name": "BGMI TDM Battle",
  "game": "bgmi",
  "mode": "tdm",
  "teamSize": 2,
  "maxTeams": 2,
  "registrationFields": {
    "requireTeamName": true,
    "requirePlayerNames": true,
    "requireGameIds": true
  },
  "registrationStartDate": "2026-01-12T10:00:00.000Z",
  "registrationEndDate": "2026-01-12T12:00:00.000Z",
  "tournamentStartDate": "2026-01-12T12:30:00.000Z",
  "tournamentEndDate": "2026-01-12T13:30:00.000Z",
  "isOnline": true,
  "entryFee": 50,
  "prizePool": 500
}
```

---

## 🔄 API Endpoint

### Create Tournament

```http
POST /api/tournaments
Content-Type: application/json
Authorization: Bearer <token>

{
  // Tournament payload as shown above
}
```

### Response

```json
{
  "success": true,
  "message": "Tournament created successfully",
  "data": {
    "id": "uuid",
    "name": "Tournament Name",
    "game": "freefire",
    "mode": "br_ranked",
    "teamSize": 4,
    "maxTeams": 12,
    "status": "draft"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Invalid team size for selected game and mode",
  "errors": [
    {
      "field": "teamSize",
      "message": "Invalid team size for BR Ranked. Valid options: Solo, Duo, Squad"
    }
  ]
}
```
