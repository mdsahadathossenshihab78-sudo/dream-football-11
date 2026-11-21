// Drizzle schema for Dream Football 11.
//
// profiles: one row per account (created with name + Gmail-style email).
// squad_players: players the account owns; in_xi marks the starting eleven.
// tournament_state: the account's current 8-team knockout bracket as JSON.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  coins: integer("coins").notNull().default(0),
  teamId: text("team_id"),
  matchesPlayed: integer("matches_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  goalsFor: integer("goals_for").notNull().default(0),
  goalsAgainst: integer("goals_against").notNull().default(0),
  // The user's custom formation: 11 slots {playerId, role, x, y} as JSON.
  // x/y are pitch percentages (x 4..96 left→right, y 4..96 top=attack →
  // bottom=own goal) on the squad screen's formation pitch.
  formationJson: text("formation_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const squadPlayers = sqliteTable("squad_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull(),
  playerId: text("player_id").notNull(),
  inXi: integer("in_xi").notNull().default(0),
});

export const tournamentState = sqliteTable("tournament_state", {
  profileId: integer("profile_id").primaryKey(),
  json: text("json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
