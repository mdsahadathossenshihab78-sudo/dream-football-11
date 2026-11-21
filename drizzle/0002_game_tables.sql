DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  coins INTEGER NOT NULL DEFAULT 0,
  team_id TEXT,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE squad_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  in_xi INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE tournament_state (
  profile_id INTEGER PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
