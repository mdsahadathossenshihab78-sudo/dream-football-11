// Actions for Dream Football 11: accounts, squads, store, match rewards,
// and tournament persistence. Game data lives in ./catalog.ts.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";
import {
ALL_PLAYERS,
DEFAULT_TEAM_ID,
PLAYER_BY_ID,
STARTER_PLAYERS,
STARTING_COINS,
TEAM_BY_ID,
TEAMS,
matchReward,
} from "./catalog";

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  kind: z.enum(["club", "national"]),
  color: z.string(),
  color2: z.string(),
  rating: z.number(),
});

const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  pos: z.string(),
  group: z.enum(["GK", "DEF", "MID", "FWD"]),
  rating: z.number(),
  pace: z.number(),
  shooting: z.number(),
  passing: z.number(),
  defense: z.number(),
  price: z.number(),
  tier: z.enum(["starter", "gold", "epic", "legend"]),
});

const profileStateSchema = z.object({
  profileId: z.number(),
  name: z.string(),
  email: z.string(),
  coins: z.number(),
  teamId: z.string().nullable(),
  matchesPlayed: z.number(),
  wins: z.number(),
  draws: z.number(),
  losses: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  squad: z.array(z.object({ playerId: z.string(), inXi: z.boolean() })),
  tournamentJson: z.string().nullable(),
  isNew: z.boolean(),
});

type ProfileState = z.infer<typeof profileStateSchema>;

/** Pick the best starting XI (1 GK, 4 DEF, 3 MID, 3 FWD) from owned ids. */
function bestXi(ownedIds: string[]): Set<string> {
  const owned = ownedIds
    .map((id) => PLAYER_BY_ID.get(id))
    .filter((pl): pl is NonNullable<typeof pl> => pl != null);
  const byGroup = (g: string) =>
    owned.filter((pl) => pl.group === g).sort((a, b) => b.rating - a.rating);
  const xi = new Set<string>();
  const take = (g: string, n: number) => {
    for (const pl of byGroup(g).slice(0, n)) xi.add(pl.id);
  };
  take("GK", 1);
  take("DEF", 4);
  take("MID", 3);
  take("FWD", 3);
  // Fill any gaps (thin squad) with the best remaining players.
  if (xi.size < 11) {
    for (const pl of [...owned].sort((a, b) => b.rating - a.rating)) {
      if (xi.size >= 11) break;
      xi.add(pl.id);
    }
  }
  return xi;
}

async function loadState(
  ctx: Ctx,
  profileId: number,
  isNew: boolean,
): Promise<ProfileState> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profileId))
    .limit(1);
  const profile = rows[0];
  if (!profile) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
  const squadRows = await db
    .select()
    .from(schema.squadPlayers)
    .where(eq(schema.squadPlayers.profileId, profileId));
  const tRows = await db
    .select()
    .from(schema.tournamentState)
    .where(eq(schema.tournamentState.profileId, profileId))
    .limit(1);
  return {
    profileId: profile.id,
    name: profile.name,
    email: profile.email,
    coins: profile.coins,
    teamId: profile.teamId,
    matchesPlayed: profile.matchesPlayed,
    wins: profile.wins,
    draws: profile.draws,
    losses: profile.losses,
    goalsFor: profile.goalsFor,
    goalsAgainst: profile.goalsAgainst,
    squad: squadRows.map((r) => ({ playerId: r.playerId, inXi: r.inXi === 1 })),
    tournamentJson: tRows[0]?.json ?? null,
    isNew,
  };
}

export const Actions = {
  getCatalog: defineAction({
    description: "Returns all selectable teams and all players (starter, store) in the game catalog.",
    request: z.object({}),
    response: z.object({
      teams: z.array(teamSchema),
      players: z.array(playerSchema),
    }),
    async handler() {
      return { teams: TEAMS, players: ALL_PLAYERS };
    },
  }),

  loginOrCreate: defineAction({
    description: "Logs in with an email, or creates a new account with a starter squad and coins when the email is new.",
    request: z.object({
      name: z.string().trim().min(1).max(40),
      // Deliberately permissive here: the address is normalized and checked
      // in the handler so phone keyboards (stray spaces, capitals) don't
      // bounce a login with an opaque schema error.
      email: z.string().min(3).max(120),
    }),
    response: profileStateSchema,
    async handler(ctx, args) {
      const email = args.email.replace(/\s+/g, "").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        throw new Error("সঠিক জিমেইল ঠিকানা দাও — যেমন you@gmail.com");
      }
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.email, email))
        .limit(1);
      if (existing[0]) {
        return loadState(ctx, existing[0].id, false);
      }
      const inserted = await db
        .insert(schema.profiles)
        .values({
          name: args.name,
          email,
          coins: STARTING_COINS,
          teamId: DEFAULT_TEAM_ID,
        })
        .returning({ id: schema.profiles.id });
      const profile = inserted[0];
      if (!profile) throw new Error("অ্যাকাউন্ট তৈরি করা যায়নি");
      const xi = bestXi(STARTER_PLAYERS.map((pl) => pl.id));
      const statements: BatchItem<"sqlite">[] = STARTER_PLAYERS.map((pl) =>
        db.insert(schema.squadPlayers).values({
          profileId: profile.id,
          playerId: pl.id,
          inXi: xi.has(pl.id) ? 1 : 0,
        }),
      );
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
      ctx.invalidateQueries();
      return loadState(ctx, profile.id, true);
    },
  }),

  getProfile: defineAction({
    description: "Loads one account's full state: coins, selected team, career stats, squad, and tournament.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: profileStateSchema,
    async handler(ctx, args) {
      return loadState(ctx, args.profileId, false);
    },
  }),

  setTeam: defineAction({
    description: "Sets the account's selected club or national team.",
    request: z.object({
      profileId: z.number().int().positive(),
      teamId: z.string().min(1).max(60),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      if (!TEAM_BY_ID.has(args.teamId)) throw new Error("এই দলটি নেই");
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({ teamId: args.teamId })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setXi: defineAction({
    description: "Saves the account's starting eleven from owned players (exactly 11, exactly one goalkeeper).",
    request: z.object({
      profileId: z.number().int().positive(),
      playerIds: z.array(z.string().min(1).max(60)).length(11),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const owned = await db
        .select()
        .from(schema.squadPlayers)
        .where(eq(schema.squadPlayers.profileId, args.profileId));
      const ownedIds = new Set(owned.map((r) => r.playerId));
      const unique = new Set(args.playerIds);
      if (unique.size !== 11) throw new Error("একাদশে ১১ জন আলাদা খেলোয়াড় লাগবে");
      for (const id of args.playerIds) {
        if (!ownedIds.has(id)) throw new Error("এই খেলোয়াড় তোমার দলে নেই");
      }
      const gkCount = args.playerIds.filter(
        (id) => PLAYER_BY_ID.get(id)?.group === "GK",
      ).length;
      if (gkCount !== 1) throw new Error("একাদশে ঠিক একজন গোলকিপার লাগবে");
      const statements: BatchItem<"sqlite">[] = owned.map((r) =>
        db
          .update(schema.squadPlayers)
          .set({ inXi: unique.has(r.playerId) ? 1 : 0 })
          .where(eq(schema.squadPlayers.id, r.id)),
      );
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  buyPlayer: defineAction({
    description: "Buys one store player with the account's coins and adds him to the squad.",
    request: z.object({
      profileId: z.number().int().positive(),
      playerId: z.string().min(1).max(60),
    }),
    response: z.object({ coins: z.number() }),
    async handler(ctx, args) {
      const player = PLAYER_BY_ID.get(args.playerId);
      if (!player || player.price <= 0) throw new Error("এই খেলোয়াড় স্টোরে নেই");
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const profile = rows[0];
      if (!profile) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
      const owned = await db
        .select()
        .from(schema.squadPlayers)
        .where(eq(schema.squadPlayers.profileId, args.profileId));
      if (owned.some((r) => r.playerId === args.playerId)) {
        throw new Error("এই খেলোয়াড় ইতিমধ্যে তোমার দলে আছে");
      }
      if (profile.coins < player.price) {
        throw new Error("কয়েন যথেষ্ট নেই — আরও ম্যাচ খেলে কয়েন জমাও");
      }
      const newCoins = profile.coins - player.price;
      await db.batch([
        db
          .update(schema.profiles)
          .set({ coins: newCoins })
          .where(eq(schema.profiles.id, args.profileId)),
        db.insert(schema.squadPlayers).values({
          profileId: args.profileId,
          playerId: args.playerId,
          inXi: 0,
        }),
      ]);
      ctx.invalidateQueries();
      return { coins: newCoins };
    },
  }),

  recordMatch: defineAction({
    description: "Records a finished match, updates career stats, and awards coins for the result.",
    request: z.object({
      profileId: z.number().int().positive(),
      mode: z.enum(["quick", "tournament"]),
      stage: z.enum(["qf", "sf", "f"]).nullable().default(null),
      result: z.enum(["win", "draw", "loss"]),
      goalsFor: z.number().int().min(0).max(15),
      goalsAgainst: z.number().int().min(0).max(15),
    }),
    response: z.object({ coinsEarned: z.number(), coins: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const profile = rows[0];
      if (!profile) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
      const earned = matchReward(
        args.mode,
        args.mode === "tournament" ? args.stage : null,
        args.result,
        args.goalsFor,
      );
      const newCoins = profile.coins + earned;
      await db
        .update(schema.profiles)
        .set({
          coins: newCoins,
          matchesPlayed: profile.matchesPlayed + 1,
          wins: profile.wins + (args.result === "win" ? 1 : 0),
          draws: profile.draws + (args.result === "draw" ? 1 : 0),
          losses: profile.losses + (args.result === "loss" ? 1 : 0),
          goalsFor: profile.goalsFor + args.goalsFor,
          goalsAgainst: profile.goalsAgainst + args.goalsAgainst,
        })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { coinsEarned: earned, coins: newCoins };
    },
  }),

  saveTournament: defineAction({
    description: "Saves (or clears, with null) the account's current tournament bracket state.",
    request: z.object({
      profileId: z.number().int().positive(),
      json: z.string().max(30000).nullable(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      if (args.json == null) {
        await db
          .delete(schema.tournamentState)
          .where(eq(schema.tournamentState.profileId, args.profileId));
      } else {
        await db
          .insert(schema.tournamentState)
          .values({ profileId: args.profileId, json: args.json })
          .onConflictDoUpdate({
            target: schema.tournamentState.profileId,
            set: { json: args.json, updatedAt: new Date() },
          });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),
} satisfies ActionsModule;
