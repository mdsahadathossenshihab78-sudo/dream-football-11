// Game catalog for Dream Football 11 — all teams and players are original,
// fictional creations for this game. Clubs are invented; national teams use
// country names with invented squads and generic color badges (no real
// crests, kits, or player likenesses).

export type PosGroup = "GK" | "DEF" | "MID" | "FWD";
export type Tier = "starter" | "gold" | "epic" | "legend";

export interface PlayerDef {
  id: string;
  name: string;
  pos: string; // display label, e.g. "ST", "CB"
  group: PosGroup;
  rating: number;
  pace: number;
  shooting: number;
  passing: number;
  defense: number;
  price: number; // 0 for starter-squad players
  tier: Tier;
}

export interface TeamDef {
  id: string;
  name: string;
  short: string; // 3-letter badge text
  kind: "club" | "national";
  color: string; // primary kit color
  color2: string; // secondary / shorts color
  rating: number; // CPU strength when this team is the opponent
}

export const TEAMS: TeamDef[] = [
  // ---- Fictional clubs ----
  { id: "dhaka-kings", name: "Dhaka Kings", short: "DHK", kind: "club", color: "#0e7a3d", color2: "#f5c518", rating: 78 },
  { id: "bengal-royals", name: "Bengal Royals", short: "BGR", kind: "club", color: "#7a1f2b", color2: "#ffffff", rating: 76 },
  { id: "chattogram-city", name: "Chattogram City", short: "CTG", kind: "club", color: "#1d4ed8", color2: "#ffffff", rating: 74 },
  { id: "sylhet-strikers", name: "Sylhet Strikers", short: "SYL", kind: "club", color: "#0ea5e9", color2: "#0b2417", rating: 72 },
  { id: "rajshahi-rangers", name: "Rajshahi Rangers", short: "RAJ", kind: "club", color: "#b45309", color2: "#ffffff", rating: 71 },
  { id: "khulna-titans", name: "Khulna Titans", short: "KHU", kind: "club", color: "#334155", color2: "#f5c518", rating: 73 },
  { id: "barishal-blazers", name: "Barishal Blazers", short: "BAR", kind: "club", color: "#dc2626", color2: "#ffffff", rating: 70 },
  { id: "cumilla-comets", name: "Cumilla Comets", short: "CUM", kind: "club", color: "#6d28d9", color2: "#ffffff", rating: 69 },
  { id: "london-lions", name: "London Lions", short: "LON", kind: "club", color: "#991b1b", color2: "#f5c518", rating: 84 },
  { id: "paris-stars", name: "Paris Stars", short: "PAR", kind: "club", color: "#1e3a8a", color2: "#ffffff", rating: 85 },
  { id: "munich-giants", name: "Munich Giants", short: "MUN", kind: "club", color: "#b91c1c", color2: "#ffffff", rating: 86 },
  { id: "tokyo-samurai", name: "Tokyo Samurai", short: "TOK", kind: "club", color: "#0f766e", color2: "#ffffff", rating: 80 },
  // ---- National teams (country names, invented squads) ----
  { id: "bangladesh", name: "Bangladesh", short: "BAN", kind: "national", color: "#006a4e", color2: "#f42a41", rating: 72 },
  { id: "brazil", name: "Brazil", short: "BRA", kind: "national", color: "#f5c518", color2: "#009c3b", rating: 90 },
  { id: "argentina", name: "Argentina", short: "ARG", kind: "national", color: "#75aadb", color2: "#ffffff", rating: 90 },
  { id: "france", name: "France", short: "FRA", kind: "national", color: "#1e3a8a", color2: "#ffffff", rating: 89 },
  { id: "england", name: "England", short: "ENG", kind: "national", color: "#f8fafc", color2: "#1e3a8a", rating: 88 },
  { id: "spain", name: "Spain", short: "ESP", kind: "national", color: "#c60b1e", color2: "#f5c518", rating: 88 },
  { id: "germany", name: "Germany", short: "GER", kind: "national", color: "#f8fafc", color2: "#111111", rating: 87 },
  { id: "portugal", name: "Portugal", short: "POR", kind: "national", color: "#046a38", color2: "#da291c", rating: 87 },
  { id: "italy", name: "Italy", short: "ITA", kind: "national", color: "#1d4ed8", color2: "#ffffff", rating: 86 },
  { id: "netherlands", name: "Netherlands", short: "NED", kind: "national", color: "#f97316", color2: "#ffffff", rating: 86 },
];

const p = (
  id: string,
  name: string,
  pos: string,
  group: PosGroup,
  rating: number,
  pace: number,
  shooting: number,
  passing: number,
  defense: number,
  price: number,
  tier: Tier,
): PlayerDef => ({ id, name, pos, group, rating, pace, shooting, passing, defense, price, tier });

// Starter squad — handed to every new account (16 players: 2 GK, 5 DEF, 5 MID, 4 FWD).
export const STARTER_PLAYERS: PlayerDef[] = [
  p("st-gk1", "Arif Hossain", "GK", "GK", 72, 40, 20, 55, 74, 0, "starter"),
  p("st-gk2", "Tanvir Islam", "GK", "GK", 66, 38, 18, 48, 68, 0, "starter"),
  p("st-d1", "Rakibul Hasan", "CB", "DEF", 71, 62, 30, 58, 73, 0, "starter"),
  p("st-d2", "Shakib Rahman", "CB", "DEF", 69, 58, 28, 55, 71, 0, "starter"),
  p("st-d3", "Naim Sheikh", "LB", "DEF", 68, 74, 32, 60, 66, 0, "starter"),
  p("st-d4", "Imran Kabir", "RB", "DEF", 67, 72, 30, 59, 65, 0, "starter"),
  p("st-d5", "Foysal Ahmed", "CB", "DEF", 64, 55, 25, 50, 66, 0, "starter"),
  p("st-m1", "Mahmudul Hasan", "CM", "MID", 72, 66, 55, 74, 60, 0, "starter"),
  p("st-m2", "Rifat Chowdhury", "CDM", "MID", 70, 60, 45, 68, 70, 0, "starter"),
  p("st-m3", "Sabbir Khan", "CAM", "MID", 71, 70, 62, 72, 45, 0, "starter"),
  p("st-m4", "Akash Barman", "LM", "MID", 67, 78, 50, 64, 42, 0, "starter"),
  p("st-m5", "Rubel Mia", "RM", "MID", 65, 76, 48, 62, 40, 0, "starter"),
  p("st-f1", "Jamal Bhuiyan Jr", "ST", "FWD", 73, 80, 72, 60, 30, 0, "starter"),
  p("st-f2", "Towhid Ridoy", "LW", "FWD", 70, 84, 66, 62, 28, 0, "starter"),
  p("st-f3", "Shanto Das", "RW", "FWD", 68, 82, 63, 60, 26, 0, "starter"),
  p("st-f4", "Emon Talukdar", "ST", "FWD", 65, 74, 64, 55, 25, 0, "starter"),
];

// Store — Gold tier.
export const GOLD_PLAYERS: PlayerDef[] = [
  p("gd-gk1", "Viktor Lindqvist", "GK", "GK", 84, 45, 22, 66, 86, 2200, "gold"),
  p("gd-d1", "Marco Bellini", "CB", "DEF", 83, 68, 35, 66, 85, 2000, "gold"),
  p("gd-d2", "Kenji Watanabe", "RB", "DEF", 82, 84, 40, 72, 80, 1800, "gold"),
  p("gd-m1", "Lucas Ferreira", "CM", "MID", 84, 74, 68, 86, 62, 2400, "gold"),
  p("gd-m2", "Omar Haddad", "CDM", "MID", 82, 66, 50, 78, 82, 1900, "gold"),
  p("gd-f1", "Dario Kovac", "ST", "FWD", 85, 86, 85, 66, 32, 2600, "gold"),
  p("gd-f2", "Felix Wagner", "LW", "FWD", 83, 90, 78, 74, 30, 2100, "gold"),
];

// Store — Epic tier.
export const EPIC_PLAYERS: PlayerDef[] = [
  p("ep-gk1", "Casimir Novak", "GK", "GK", 90, 48, 25, 74, 92, 6000, "epic"),
  p("ep-d1", "Alessandro Romano", "CB", "DEF", 90, 74, 40, 74, 92, 5800, "epic"),
  p("ep-d2", "Rafael Duarte", "LB", "DEF", 88, 90, 55, 82, 86, 5200, "epic"),
  p("ep-m1", "Enzo Marchetti", "CAM", "MID", 91, 80, 82, 93, 50, 7000, "epic"),
  p("ep-m2", "Soren Bakker", "CM", "MID", 89, 76, 74, 90, 72, 5600, "epic"),
  p("ep-f1", "Matteo Rinaldi", "ST", "FWD", 91, 90, 92, 72, 34, 7500, "epic"),
  p("ep-f2", "Yuki Tanaka", "RW", "FWD", 89, 94, 84, 80, 30, 6200, "epic"),
];

// Store — Legend tier.
export const LEGEND_PLAYERS: PlayerDef[] = [
  p("lg-m1", "Riven Costa", "CAM", "MID", 96, 88, 90, 97, 55, 15000, "legend"),
  p("lg-f1", "Kael Drakon", "ST", "FWD", 97, 95, 97, 80, 35, 18000, "legend"),
  p("lg-f2", "Zayne Okafor", "LW", "FWD", 95, 97, 93, 84, 32, 16000, "legend"),
  p("lg-d1", "Dmitri Volkov", "CB", "DEF", 94, 78, 42, 76, 96, 13000, "legend"),
];

export const ALL_PLAYERS: PlayerDef[] = [
  ...STARTER_PLAYERS,
  ...GOLD_PLAYERS,
  ...EPIC_PLAYERS,
  ...LEGEND_PLAYERS,
];

export const PLAYER_BY_ID = new Map(ALL_PLAYERS.map((pl) => [pl.id, pl]));
export const TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

export const STARTING_COINS = 500;
export const DEFAULT_TEAM_ID = "dhaka-kings";

// Coin rewards, computed on the server from the reported result.
export function matchReward(
  mode: "quick" | "tournament",
  stage: "qf" | "sf" | "f" | null,
  result: "win" | "draw" | "loss",
  goalsFor: number,
): number {
  const goals = Math.min(Math.max(goalsFor, 0), 8);
  const goalBonus = goals * 20;
  if (mode === "quick") {
    const base = result === "win" ? 150 : result === "draw" ? 70 : 40;
    return base + goalBonus;
  }
  if (stage === "sf") {
    const base = result === "win" ? 400 : result === "draw" ? 150 : 80;
    return base + goalBonus;
  }
  if (stage === "f") {
    const base = result === "win" ? 800 + 1000 : result === "draw" ? 200 : 120;
    return base + goalBonus;
  }
  // quarter-final (default tournament stage)
  const base = result === "win" ? 250 : result === "draw" ? 100 : 60;
  return base + goalBonus;
}
