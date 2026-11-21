// Dream Football 11 — game hub: home, teams, squad, store, quick match and
// an 8-team knockout tournament, with a playable 11v11 match engine.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api, type ApiResponse } from "./api";
import { MatchScreen, type MatchFinish } from "./MatchScreen";
import { FlagBadge, PlayerAvatar, TeamLogo } from "./branding";
import type { EnginePlayerInfo, PosGroup } from "./engine";
import stadiumHero from "./assets/stadium-hero.webp";

const FIELDS = actionFields<typeof Actions>();

type Catalog = ApiResponse<typeof api, "getCatalog">;
type TeamDef = Catalog["teams"][number];
type PlayerDef = Catalog["players"][number];
type Profile = ApiResponse<typeof api, "getProfile">;

const GROUP_ORDER: PosGroup[] = ["GK", "DEF", "MID", "FWD"];
const TIER_LABEL: Record<PlayerDef["tier"], string> = {
  starter: "স্টার্টার",
  gold: "গোল্ড",
  epic: "এপিক",
  legend: "লেজেন্ড",
};
const TIER_STYLE: Record<PlayerDef["tier"], string> = {
  starter: "bg-[#334155] text-white",
  gold: "bg-[#b8860b] text-white",
  epic: "bg-[#c2410c] text-white",
  legend: "bg-black text-[var(--gold)] ring-1 ring-[var(--gold)]",
};

// Collectible-card backgrounds per tier, like football-game player cards.
const TIER_CARD: Record<PlayerDef["tier"], string> = {
  starter: "linear-gradient(160deg,#3d4c63 0%,#1c2739 55%,#131c2c 100%)",
  gold: "linear-gradient(160deg,#f7d774 0%,#c9930a 45%,#8a5f00 100%)",
  epic: "linear-gradient(160deg,#ff9a3d 0%,#d63c14 50%,#7a1503 100%)",
  legend: "linear-gradient(160deg,#3a3a42 0%,#0a0a0e 55%,#000000 100%)",
};
const TIER_CARD_TEXT: Record<PlayerDef["tier"], string> = {
  starter: "text-white",
  gold: "text-[#2a1c00]",
  epic: "text-white",
  legend: "text-[var(--gold)]",
};

// ---------------- helpers ----------------

function Coin({ amount, big }: { amount: number; big?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black ${big ? "text-lg" : "text-sm"}`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-[var(--gold)] font-black text-black ${
          big ? "h-6 w-6 text-xs" : "h-5 w-5 text-[10px]"
        }`}
      >
        C
      </span>
      <span className="tabular-nums">{amount.toLocaleString("en-US")}</span>
    </span>
  );
}

/** Kit colour per tier for the illustrated player avatars. Each player's
 * face, hair and skin tone come from PlayerAvatar, seeded by player id. */
function tierKit(tier: PlayerDef["tier"]): string {
  return tier === "legend"
    ? "#f5c518"
    : tier === "epic"
      ? "#ff5a1f"
      : tier === "gold"
        ? "#7a4d00"
        : "#22c55e";
}

function PlayerFigure({ pl, size = 92 }: { pl: PlayerDef; size?: number }) {
  return <PlayerAvatar seed={pl.id} kit={tierKit(pl.tier)} size={size} />;
}

/** eFootball-style collectible player card: big rating, position, kit
 * figure, name plate and the four key stats along the bottom. */
function PlayerCard({
  pl,
  footer,
  compact,
}: {
  pl: PlayerDef;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`game-panel card-sheen relative overflow-hidden ${TIER_CARD_TEXT[pl.tier]}`}
      style={{ background: TIER_CARD[pl.tier] }}
    >
      <div className="flex items-start justify-between px-3 pt-3">
        <div className="text-center leading-none">
          <p className={`${compact ? "text-3xl" : "text-4xl"} font-black italic tabular-nums drop-shadow`}>
            {pl.rating}
          </p>
          <p className="mt-1 text-xs font-black tracking-widest">{pl.pos}</p>
          <span
            className={`mt-1.5 inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-black tracking-wider ${TIER_STYLE[pl.tier]}`}
          >
            {TIER_LABEL[pl.tier]}
          </span>
        </div>
        <PlayerFigure pl={pl} size={compact ? 64 : 84} />
      </div>
      <div className="mt-1 bg-black/45 px-3 py-2">
        <p className="truncate text-center text-sm font-black uppercase tracking-wide text-white">
          {pl.name}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-1 bg-black/30 px-2 py-2 text-center">
        {(
          [
            ["গতি", pl.pace],
            ["শুট", pl.shooting],
            ["পাস", pl.passing],
            ["ডিফ", pl.defense],
          ] as const
        ).map(([label, v]) => (
          <div key={label}>
            <p className="text-sm font-black tabular-nums text-white">{v}</p>
            <p className="text-[9px] font-bold text-white/60">{label}</p>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

function Crest({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 3 41 9v13c0 11-7.5 19.4-17 23C14.5 41.4 7 33 7 22V9L24 3z"
        fill="#0b2417"
        stroke="#f5c518"
        strokeWidth="2.5"
      />
      <circle cx="24" cy="21" r="8" fill="#f8fafc" stroke="#111" strokeWidth="1.4" />
      <path d="M24 16.5 27.8 19.3 26.4 23.7h-4.8L20.2 19.3z" fill="#111" />
      <text x="24" y="40" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#f5c518">
        DF
      </text>
    </svg>
  );
}

// ---------------- tournament model ----------------

interface TMatch {
  home: string;
  away: string;
  hs: number | null;
  as: number | null;
  winner: string | null;
}
interface Tourney {
  userTeamId: string;
  teams: string[];
  qf: TMatch[];
  sf: TMatch[];
  f: TMatch[];
  champion: string | null;
}

function parseTourney(json: string | null): Tourney | null {
  if (!json) return null;
  try {
    const t = JSON.parse(json) as Tourney;
    if (!t || !Array.isArray(t.teams) || !Array.isArray(t.qf)) return null;
    return t;
  } catch {
    return null;
  }
}

function simTie(home: TeamDef, away: TeamDef): TMatch {
  const goals = (att: number, def: number) => {
    const exp = 1.25 + (att - def) * 0.035;
    return Math.max(0, Math.min(5, Math.round(exp + (Math.random() - 0.5) * 2.2)));
  };
  const hs = goals(home.rating, away.rating);
  const as = goals(away.rating, home.rating);
  let winner = hs > as ? home.id : as > hs ? away.id : null;
  if (!winner) {
    // penalties
    winner = Math.random() < 0.5 + (home.rating - away.rating) * 0.01 ? home.id : away.id;
  }
  return { home: home.id, away: away.id, hs, as, winner };
}

function buildNextRound(t: Tourney, teamById: Map<string, TeamDef>): Tourney {
  const next = { ...t, qf: [...t.qf], sf: [...t.sf], f: [...t.f] };
  const winners = (ms: TMatch[]) => ms.map((m) => m.winner);
  if (next.sf.length === 0 && next.qf.every((m) => m.winner)) {
    const w = winners(next.qf);
    next.sf = [
      { home: w[0] ?? "", away: w[1] ?? "", hs: null, as: null, winner: null },
      { home: w[2] ?? "", away: w[3] ?? "", hs: null, as: null, winner: null },
    ];
  }
  if (next.f.length === 0 && next.sf.length === 2 && next.sf.every((m) => m.winner)) {
    const w = winners(next.sf);
    next.f = [{ home: w[0] ?? "", away: w[1] ?? "", hs: null, as: null, winner: null }];
  }
  if (next.f.length === 1 && next.f[0]?.winner) {
    next.champion = next.f[0].winner;
  }
  void teamById;
  return next;
}

function currentStage(t: Tourney): "qf" | "sf" | "f" | "done" {
  if (t.champion) return "done";
  if (t.qf.some((m) => !m.winner)) return "qf";
  if (t.sf.length === 0 || t.sf.some((m) => !m.winner)) return "sf";
  return "f";
}

// ---------------- CPU squad generation ----------------

const CPU_FIRST = ["Liam", "Noah", "Lucas", "Mateo", "Kenji", "Yusuf", "Omar", "Felix", "Dario", "Enzo", "Rafael", "Soren", "Viktor", "Marco", "Bruno", "Ivan", "Hugo", "Nils", "Thiago", "Leon"];
const CPU_LAST = ["Costa", "Silva", "Novak", "Kovac", "Tanaka", "Haddad", "Wagner", "Romano", "Bakker", "Lindqvist", "Duarte", "Marchetti", "Ferreira", "Volkov", "Rinaldi", "Okafor", "Mendes", "Santos", "Keller", "Braun"];

function makeCpuXI(team: TeamDef): EnginePlayerInfo[] {
  const layout: { pos: string; group: PosGroup }[] = [
    { pos: "GK", group: "GK" },
    { pos: "LB", group: "DEF" }, { pos: "CB", group: "DEF" }, { pos: "CB", group: "DEF" }, { pos: "RB", group: "DEF" },
    { pos: "LM", group: "MID" }, { pos: "CM", group: "MID" }, { pos: "RM", group: "MID" },
    { pos: "LW", group: "FWD" }, { pos: "ST", group: "FWD" }, { pos: "RW", group: "FWD" },
  ];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const clamp99 = (v: number) => Math.max(30, Math.min(99, Math.round(v)));
  return layout.map((slot, i) => {
    const rating = clamp99(team.rating + rnd(-3, 3) + (slot.group === "GK" ? 1 : 0));
    const name = `${CPU_FIRST[Math.floor(Math.random() * CPU_FIRST.length)]} ${CPU_LAST[Math.floor(Math.random() * CPU_LAST.length)]}`;
    void i;
    return {
      name,
      pos: slot.pos,
      group: slot.group,
      rating,
      pace: clamp99(rating + rnd(-12, 14) + (slot.group === "FWD" ? 7 : slot.group === "GK" ? -32 : 0)),
      shooting: clamp99(rating + rnd(-8, 10) + (slot.group === "FWD" ? 8 : slot.group === "MID" ? 0 : -22)),
      passing: clamp99(rating + rnd(-10, 10) + (slot.group === "MID" ? 6 : 0)),
      defense: clamp99(rating + rnd(-8, 10) + (slot.group === "DEF" ? 8 : slot.group === "GK" ? 10 : -20)),
    };
  });
}

function xiInfos(profile: Profile, playerById: Map<string, PlayerDef>): EnginePlayerInfo[] {
  const xi = profile.squad
    .filter((s) => s.inXi)
    .map((s) => playerById.get(s.playerId))
    .filter((pl): pl is PlayerDef => pl != null);
  const ordered: PlayerDef[] = [];
  for (const g of GROUP_ORDER) {
    ordered.push(...xi.filter((pl) => pl.group === g).sort((a, b) => b.rating - a.rating));
  }
  return ordered.map((pl) => ({
    name: pl.name,
    pos: pl.pos,
    group: pl.group,
    rating: pl.rating,
    pace: pl.pace,
    shooting: pl.shooting,
    passing: pl.passing,
    defense: pl.defense,
  }));
}

function bestXiIds(owned: PlayerDef[]): string[] {
  const byGroup = (g: PosGroup) =>
    owned.filter((pl) => pl.group === g).sort((a, b) => b.rating - a.rating);
  const ids: string[] = [];
  const take = (g: PosGroup, n: number) => byGroup(g).slice(0, n).forEach((pl) => ids.push(pl.id));
  take("GK", 1);
  take("DEF", 4);
  take("MID", 3);
  take("FWD", 3);
  if (ids.length < 11) {
    for (const pl of [...owned].sort((a, b) => b.rating - a.rating)) {
      if (ids.length >= 11) break;
      if (!ids.includes(pl.id)) ids.push(pl.id);
    }
  }
  return ids;
}

// ---------------- app ----------------

type View = "home" | "teams" | "squad" | "store" | "play";

interface MatchCfg {
  mode: "quick" | "tournament";
  stage: "qf" | "sf" | "f" | null;
  cpuTeamId: string;
  userTeamId: string;
}

// Webview storage can throw (blocked cookies / sandboxed frame). A storage
// failure must never break login: keep the id in state first, persist as a
// best-effort extra.
function readStoredProfileId(): number | null {
  try {
    const v = window.localStorage.getItem("sf-profile-id");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function storeProfileId(id: number) {
  try {
    window.localStorage.setItem("sf-profile-id", String(id));
  } catch {
    // storage unavailable — the in-memory login still works for this session
  }
}

export function App() {
  const queryClient = useQueryClient();
  const [profileId, setProfileId] = useState<number | null>(readStoredProfileId);
  const [view, setView] = useState<View>("home");
  const [matchCfg, setMatchCfg] = useState<MatchCfg | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const [tourney, setTourney] = useState<Tourney | null>(null);
  const tourneyInitFor = useRef<number | null>(null);

  const catalogQ = useQuery({ queryKey: ["catalog"], queryFn: () => api.getCatalog({}) });
  const profileQ = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile({ profileId: profileId ?? 0 }),
    enabled: profileId != null,
  });

  const profile = profileQ.data ?? null;
  const teamById = useMemo(
    () => new Map((catalogQ.data?.teams ?? []).map((t) => [t.id, t])),
    [catalogQ.data],
  );
  const playerById = useMemo(
    () => new Map((catalogQ.data?.players ?? []).map((pl) => [pl.id, pl])),
    [catalogQ.data],
  );

  useEffect(() => {
    if (profile && tourneyInitFor.current !== profile.profileId) {
      tourneyInitFor.current = profile.profileId;
      setTourney(parseTourney(profile.tournamentJson));
    }
  }, [profile]);

  const saveTourneyMut = useMutation({
    mutationFn: (json: string | null) =>
      api.saveTournament({ profileId: profileId ?? 0, json }),
  });

  const persistTourney = (t: Tourney | null) => {
    setTourney(t);
    saveTourneyMut.mutate(t ? JSON.stringify(t) : null);
  };

  const invalidateProfile = () =>
    queryClient.invalidateQueries({ queryKey: ["profile", profileId] });

  // ---------- match flow ----------
  const startQuickMatch = (cpuTeamId: string) => {
    if (!profile) return;
    setMatchCfg({
      mode: "quick",
      stage: null,
      cpuTeamId,
      userTeamId: profile.teamId ?? "dhaka-kings",
    });
    setMatchKey((k) => k + 1);
  };

  const startTournamentMatch = (t: Tourney, stage: "qf" | "sf" | "f") => {
    const round = stage === "qf" ? t.qf : stage === "sf" ? t.sf : t.f;
    const tie = round.find(
      (m) => !m.winner && (m.home === t.userTeamId || m.away === t.userTeamId),
    );
    if (!tie) return;
    const cpuTeamId = tie.home === t.userTeamId ? tie.away : tie.home;
    setMatchCfg({ mode: "tournament", stage, cpuTeamId, userTeamId: t.userTeamId });
    setMatchKey((k) => k + 1);
  };

  const handleMatchFinish = (r: MatchFinish) => {
    setMatchCfg(null);
    invalidateProfile();
    if (matchCfg?.mode === "tournament" && tourney && matchCfg.stage) {
      const stage = matchCfg.stage;
      const roundKey = stage;
      const round = [...tourney[roundKey]];
      const idx = round.findIndex(
        (m) => !m.winner && (m.home === tourney.userTeamId || m.away === tourney.userTeamId),
      );
      if (idx >= 0) {
        const tie = round[idx];
        if (tie) {
          const userIsHome = tie.home === tourney.userTeamId;
          const hs = userIsHome ? r.userGoals : r.cpuGoals;
          const as = userIsHome ? r.cpuGoals : r.userGoals;
          let winner: string;
          if (r.pensWinner) {
            winner = r.pensWinner === "user" ? tourney.userTeamId : userIsHome ? tie.away : tie.home;
          } else {
            winner = r.userGoals > r.cpuGoals ? tourney.userTeamId : userIsHome ? tie.away : tie.home;
          }
          round[idx] = { ...tie, hs, as, winner };
        }
      }
      // simulate the rest of this round
      const simmed = round.map((m) => {
        if (m.winner) return m;
        const h = teamById.get(m.home);
        const a = teamById.get(m.away);
        return h && a ? simTie(h, a) : m;
      });
      const updated: Tourney = { ...tourney, [roundKey]: simmed };
      persistTourney(buildNextRound(updated, teamById));
      setView("play");
    }
  };

  // ---------- render ----------
  if (catalogQ.isPending || (profileId != null && profileQ.isPending)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <Crest size={56} />
          <p className="mt-3 text-sm text-[var(--dim)]">লোড হচ্ছে…</p>
        </div>
      </div>
    );
  }
  if (catalogQ.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 text-center">
        <p className="text-sm text-[var(--danger)]">গেমের ডেটা লোড হয়নি। আবার চেষ্টা করো।</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <LoginScreen
        onDone={(id) => {
          setProfileId(id);
          storeProfileId(id);
        }}
      />
    );
  }

  const userTeam = teamById.get(matchCfg?.userTeamId ?? profile.teamId ?? "dhaka-kings") ??
    catalogQ.data?.teams[0];
  const cpuTeam = matchCfg ? teamById.get(matchCfg.cpuTeamId) : undefined;

  if (matchCfg && userTeam && cpuTeam) {
    return (
      <MatchScreen
        key={matchKey}
        profileId={profile.profileId}
        userTeam={userTeam}
        cpuTeam={cpuTeam}
        userXI={xiInfos(profile, playerById)}
        cpuXI={makeCpuXI(cpuTeam)}
        mode={matchCfg.mode}
        stage={matchCfg.stage}
        onFinish={handleMatchFinish}
        onRematch={matchCfg.mode === "quick" ? () => setMatchKey((k) => k + 1) : undefined}
        onQuit={() => setMatchCfg(null)}
      />
    );
  }

  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "হোম", icon: <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
    { id: "teams", label: "দলসমূহ", icon: <path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6z" /> },
    { id: "squad", label: "আমার দল", icon: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /> },
    { id: "store", label: "স্টোর", icon: <path d="M6 7h15l-1.5 9h-12zM6 7L5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" /> },
    { id: "play", label: "খেলো", icon: <path d="M6 4l14 8-14 8z" /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* game HUD bar */}
      <header className="sticky top-0 z-20 border-b-2 border-[var(--gold)]/70 bg-[#02060f]/97 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-base font-black text-white ring-2 ring-white/30">
              {profile.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-black italic">
                DREAM <span className="text-[var(--gold)]">FOOTBALL 11</span>
              </p>
              <p className="text-[11px] font-semibold text-[var(--dim)]">{profile.name} • ম্যানেজার</p>
            </div>
          </div>
          <div className="game-panel flex items-center bg-[var(--surface2)] px-3.5 py-1.5 ring-1 ring-[var(--gold)]/50">
            <Coin amount={profile.coins} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
        {view === "home" && (
          <HomeScreen
            profile={profile}
            teamById={teamById}
            playerById={playerById}
            go={(v) => setView(v)}
          />
        )}
        {view === "teams" && (
          <TeamsScreen
            profile={profile}
            teams={catalogQ.data?.teams ?? []}
            onChanged={invalidateProfile}
          />
        )}
        {view === "squad" && (
          <SquadScreen
            profile={profile}
            playerById={playerById}
            team={teamById.get(profile.teamId ?? "dhaka-kings")}
            onChanged={invalidateProfile}
          />
        )}
        {view === "store" && (
          <StoreScreen
            profile={profile}
            players={catalogQ.data?.players ?? []}
            onChanged={invalidateProfile}
          />
        )}
        {view === "play" && (
          <PlayScreen
            profile={profile}
            teams={catalogQ.data?.teams ?? []}
            teamById={teamById}
            tourney={tourney}
            onQuick={startQuickMatch}
            onStartTournament={() => {
              const uid = profile.teamId ?? "dhaka-kings";
              const others = (catalogQ.data?.teams ?? [])
                .filter((t) => t.id !== uid)
                .sort(() => Math.random() - 0.5)
                .slice(0, 7)
                .map((t) => t.id);
              const teams8 = [uid, ...others];
              const qf: TMatch[] = [0, 2, 4, 6].map((i) => ({
                home: teams8[i] ?? uid,
                away: teams8[i + 1] ?? uid,
                hs: null,
                as: null,
                winner: null,
              }));
              persistTourney({ userTeamId: uid, teams: teams8, qf, sf: [], f: [], champion: null });
            }}
            onTournamentMatch={(stage) => tourney && startTournamentMatch(tourney, stage)}
            onSimRest={() => {
              if (!tourney) return;
              let t: Tourney = { ...tourney };
              for (const key of ["qf", "sf", "f"] as const) {
                t = buildNextRound(t, teamById);
                const round = t[key].map((m) => {
                  if (m.winner) return m;
                  const h = teamById.get(m.home);
                  const a = teamById.get(m.away);
                  return h && a ? simTie(h, a) : m;
                });
                t = { ...t, [key]: round };
              }
              persistTourney(buildNextRound(t, teamById));
            }}
            onDropTournament={() => persistTourney(null)}
          />
        )}
      </main>

      {/* game dock */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-[var(--gold)]/60 bg-[#02060f]/97 pb-safe backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {navItems.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-label={item.label}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-black ${
                  active ? "text-[var(--gold)]" : "text-[var(--dim)]"
                }`}
              >
                {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--gold)]" />}
                <svg
                  width="23"
                  height="23"
                  viewBox="0 0 24 24"
                  fill={active ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  {item.icon}
                </svg>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ---------------- login ----------------

function LoginScreen({ onDone }: { onDone: (profileId: number) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () =>
      api.loginOrCreate({
        name: name.trim(),
        // Phone keyboards love stray spaces and capitals — normalize here so
        // the server always sees the clean address.
        email: email.replace(/\s+/g, "").toLowerCase(),
      }),
    onSuccess: (res) => onDone(res.profileId),
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      // Server messages written for the player are Bengali; anything else
      // (schema/transport English) gets a plain Bengali explanation.
      setError(
        /[\u0980-\u09FF]/.test(msg)
          ? msg
          : "লগইন হয়নি — নাম আর জিমেইল ঠিক করে আবার চেষ্টা করো",
      );
    },
  });

  const submit = () => {
    if (!name.trim()) {
      setError("তোমার নাম লিখো");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.replace(/\s+/g, ""))) {
      setError("সঠিক জিমেইল ঠিকানা দাও — যেমন you@gmail.com");
      return;
    }
    setError(null);
    login.mutate();
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="relative">
        <img src={stadiumHero} alt="রাতের আলোয় ফুটবল স্টেডিয়াম" className="h-72 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center px-4 text-center">
          <Crest size={60} />
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.35em] text-[var(--gold)]">
            11 vs 11 • ফুটবল গেম
          </p>
          <h1 className="mt-1 -skew-x-6 text-4xl font-black italic tracking-tight">
            DREAM <span className="text-[var(--gold)]">FOOTBALL 11</span>
          </h1>
          <p className="mt-1 text-sm font-semibold text-white/75">
            নিজের দল গড়ো, মাঠে নেমে ম্যাচ জেতো, এপিক খেলোয়াড় কেনো
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-md px-5 pb-10 pt-5">
        <label htmlFor="sf-name" className="text-sm font-bold">
          তোমার নাম
        </label>
        <input
          id="sf-name"
          {...FIELDS.loginOrCreate.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="যেমন: শিহাব"
          className="mt-1.5 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
        />
        <label htmlFor="sf-email" className="mt-4 block text-sm font-bold">
          জিমেইল ঠিকানা
        </label>
        <input
          id="sf-email"
          {...FIELDS.loginOrCreate.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gmail.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-1.5 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
        />
        <p className="mt-2 text-xs text-[var(--dim)]">
          নতুন জিমেইল দিয়ে অ্যাকাউন্ট খুললেই পেয়ে যাবে নিজের একটা দল — ১৬ জন খেলোয়াড় আর ৫০০ কয়েন।
        </p>
        {error && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={login.isPending}
          className="game-panel mt-5 min-h-13 w-full bg-[var(--accent)] py-3 text-xl font-black italic text-white shadow-[0_6px_24px_rgba(0,217,95,0.4)] disabled:opacity-60"
        >
          {login.isPending ? "হচ্ছে…" : "খেলা শুরু করো ▶"}
        </button>
      </div>
    </div>
  );
}

// ---------------- home ----------------

function HomeScreen({
  profile,
  teamById,
  playerById,
  go,
}: {
  profile: Profile;
  teamById: Map<string, TeamDef>;
  playerById: Map<string, PlayerDef>;
  go: (v: View) => void;
}) {
  const team = teamById.get(profile.teamId ?? "dhaka-kings");
  const xi = xiInfos(profile, playerById);
  const avg = xi.length ? Math.round(xi.reduce((s, pl) => s + pl.rating, 0) / xi.length) : 0;
  const nextEpic = [...playerById.values()]
    .filter((pl) => pl.tier === "epic" && !profile.squad.some((s) => s.playerId === pl.id))
    .sort((a, b) => a.price - b.price)[0];

  const topDef = profile.squad
    .filter((s) => s.inXi)
    .map((s) => playerById.get(s.playerId))
    .filter((pl): pl is PlayerDef => pl != null)
    .sort((a, b) => b.rating - a.rating)[0];
  return (
    <div>
      {/* game lobby hero */}
      <div className="game-panel relative overflow-hidden">
        <img src={stadiumHero} alt="" className="h-56 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--gold)]">
            ম্যাচ ডে • {profile.name}
          </p>
          <p className="mt-0.5 -skew-x-6 text-3xl font-black italic text-white">
            মাঠে নামার <span className="text-[var(--gold)]">সময়!</span>
          </p>
          <button
            type="button"
            onClick={() => go("play")}
            className="game-panel mt-3 min-h-13 w-full bg-[var(--accent)] py-3 text-xl font-black italic text-white shadow-[0_6px_24px_rgba(0,217,95,0.45)]"
          >
            ▶ ম্যাচ খেলো
          </button>
          <p className="mt-2 text-center text-[11px] font-semibold text-white/60">
            ফোন পাশে ঘুরিয়ে দুই হাতে ধরে খেলো — জয়স্টিক বামে, শুট ডানে
          </p>
        </div>
      </div>

      {/* mode tiles */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => go("play")}
          className="game-panel bg-gradient-to-br from-[#0e5c2c] to-[#083d1c] p-4 text-left"
        >
          <p className="text-2xl">⚡</p>
          <p className="mt-1 font-black italic">কুইক ম্যাচ</p>
          <p className="text-[11px] font-semibold text-white/60">এখনই একটা ম্যাচ • জিতলে ১৫০ কয়েন</p>
        </button>
        <button
          type="button"
          onClick={() => go("play")}
          className="game-panel bg-gradient-to-br from-[#8a6a00] to-[#4d3a00] p-4 text-left"
        >
          <p className="text-2xl">🏆</p>
          <p className="mt-1 font-black italic">টুর্নামেন্ট</p>
          <p className="text-[11px] font-semibold text-white/60">৮ দলের নকআউট • চ্যাম্পিয়ন পুরস্কার</p>
        </button>
      </div>

      {team && (
        <button
          type="button"
          onClick={() => go("squad")}
          className="game-panel mt-3 flex w-full items-center gap-3 bg-[var(--surface)] p-4 text-left"
        >
          <TeamLogo team={team} size={50} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-lg font-black italic">
              {team.name}
              {team.kind === "national" && <FlagBadge teamId={team.id} width={26} />}
            </p>
            <p className="text-xs font-semibold text-[var(--dim)]">
              {team.kind === "club" ? "ক্লাব" : "জাতীয় দল"} • দলের শক্তি{" "}
              <span className="text-base font-black text-[var(--gold)]">{avg}</span>
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/50">
              <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${avg}%` }} />
            </div>
          </div>
          <span className="text-sm font-black text-[var(--gold)]">দল দেখো ›</span>
        </button>
      )}

      {topDef && (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--dim)]">
            তোমার সেরা খেলোয়াড়
          </p>
          <div className="mt-2">
            <PlayerCard compact pl={topDef} />
          </div>
        </div>
      )}

      <div className="game-panel mt-4 grid grid-cols-5 gap-1 bg-[var(--surface)] px-2 py-3 text-center">
        {[
          { label: "ম্যাচ", value: profile.matchesPlayed },
          { label: "জয়", value: profile.wins },
          { label: "ড্র", value: profile.draws },
          { label: "হার", value: profile.losses },
          { label: "গোল", value: profile.goalsFor },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-xl font-black italic tabular-nums">{s.value}</p>
            <p className="text-[11px] font-bold text-[var(--dim)]">{s.label}</p>
          </div>
        ))}
      </div>

      {nextEpic && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--gold)]">
              স্টোরে এপিক কার্ড
            </p>
            <p className="text-[11px] font-semibold text-[var(--dim)]">
              আর {Math.max(0, nextEpic.price - profile.coins).toLocaleString("en-US")} কয়েন হলেই তোমার
            </p>
          </div>
          <button
            type="button"
            onClick={() => go("store")}
            className="mt-2 block w-full text-left"
            aria-label={`স্টোরে যাও — ${nextEpic.name}`}
          >
            <PlayerCard compact pl={nextEpic} />
          </button>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/50">
            <div
              className="h-full rounded-full bg-[var(--gold)]"
              style={{ width: `${Math.min(100, (profile.coins / nextEpic.price) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- teams ----------------

function TeamsScreen({
  profile,
  teams,
  onChanged,
}: {
  profile: Profile;
  teams: TeamDef[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"club" | "national">("club");
  const [error, setError] = useState<string | null>(null);
  const setTeam = useMutation({
    mutationFn: (teamId: string) => api.setTeam({ profileId: profile.profileId, teamId }),
    onSuccess: onChanged,
    onError: (e) => setError(e instanceof Error ? e.message : "দল বদলানো যায়নি"),
  });
  const list = teams.filter((t) => t.kind === tab);
  return (
    <div>
      <h2 className="text-2xl font-black italic">
        দল <span className="text-[var(--gold)]">বেছে নাও</span>
      </h2>
      <p className="mt-0.5 text-sm font-semibold text-[var(--dim)]">ক্লাব বা জাতীয় দল — যেটার জার্সি পরে মাঠে নামবে</p>
      <div className="game-panel mt-3 grid grid-cols-2 gap-1 bg-[var(--surface)] p-1.5">
        {(["club", "national"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`min-h-10 font-black italic ${
              tab === k ? "bg-[var(--accent)] text-white" : "text-[var(--dim)]"
            }`}
          >
            {k === "club" ? "⚽ ক্লাব" : "🌍 জাতীয় দল"}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{error}</p>}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((t) => {
          const selected = profile.teamId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeam.mutate(t.id)}
              aria-label={`${t.name}, শক্তি ${t.rating}${selected ? ", তোমার দল" : ""}`}
              className={`game-panel relative flex flex-col items-center px-3 pb-3 pt-4 text-center ${
                selected ? "bg-[var(--surface2)] ring-2 ring-[var(--gold)]" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"
              }`}
            >
              {selected && (
                <span className="absolute right-0 top-0 bg-[var(--gold)] px-2 py-0.5 text-[10px] font-black text-black">
                  আমার দল
                </span>
              )}
              {/* the team's own logo, drawn for this game */}
              <TeamLogo team={t} size={62} />
              <span className="mt-2 flex w-full items-center justify-center gap-1.5">
                {t.kind === "national" && <FlagBadge teamId={t.id} width={24} />}
                <span className="truncate text-sm font-black">{t.name}</span>
              </span>
              <span className="mt-1.5 flex w-full items-center gap-1.5">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50">
                  <span className="block h-full rounded-full bg-[var(--gold)]" style={{ width: `${t.rating}%` }} />
                </span>
                <span className="text-xs font-black tabular-nums text-[var(--gold)]">{t.rating}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- squad ----------------

const SLOT_POS: { x: number; y: number }[] = [
  { x: 50, y: 88 }, // GK
  { x: 14, y: 74 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 86, y: 74 },
  { x: 22, y: 52 }, { x: 50, y: 57 }, { x: 78, y: 52 },
  { x: 16, y: 26 }, { x: 50, y: 18 }, { x: 84, y: 26 },
];

function SquadScreen({
  profile,
  playerById,
  team,
  onChanged,
}: {
  profile: Profile;
  playerById: Map<string, PlayerDef>;
  team?: TeamDef;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owned = profile.squad
    .map((s) => ({ def: playerById.get(s.playerId), inXi: s.inXi }))
    .filter((r): r is { def: PlayerDef; inXi: boolean } => r.def != null);
  const xiOrdered: PlayerDef[] = [];
  for (const g of GROUP_ORDER) {
    xiOrdered.push(
      ...owned.filter((r) => r.inXi && r.def.group === g).map((r) => r.def).sort((a, b) => b.rating - a.rating),
    );
  }
  const xiIds = new Set(xiOrdered.map((pl) => pl.id));

  const setXi = useMutation({
    mutationFn: (ids: string[]) => api.setXi({ profileId: profile.profileId, playerIds: ids }),
    onSuccess: () => {
      setSelected(null);
      setHint(null);
      onChanged();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "একাদশ সেভ হয়নি"),
  });

  const tapPlayer = (pl: PlayerDef) => {
    setError(null);
    if (!selected) {
      setSelected(pl.id);
      setHint(
        xiIds.has(pl.id)
          ? `${pl.name} বাছা হয়েছে — বদলাতে বেঞ্চের একই পজিশনের খেলোয়াড়ে ট্যাপ করো`
          : `${pl.name} বাছা হয়েছে — একাদশে ঢোকাতে একই পজিশনের খেলোয়াড়ে ট্যাপ করো`,
      );
      return;
    }
    if (selected === pl.id) {
      setSelected(null);
      setHint(null);
      return;
    }
    const first = playerById.get(selected);
    if (!first) {
      setSelected(pl.id);
      return;
    }
    const firstInXi = xiIds.has(first.id);
    const thisInXi = xiIds.has(pl.id);
    if (firstInXi === thisInXi) {
      setSelected(pl.id);
      return;
    }
    if (first.group !== pl.group) {
      setHint("শুধু একই পজিশনের খেলোয়াড়ের সাথে বদলানো যাবে");
      return;
    }
    const outId = firstInXi ? first.id : pl.id;
    const inId = firstInXi ? pl.id : first.id;
    const newIds = xiOrdered.map((x) => (x.id === outId ? inId : x.id));
    // keep engine slot order: GK, DEF, MID, FWD by rating
    const newDefs = newIds
      .map((id) => playerById.get(id))
      .filter((d): d is PlayerDef => d != null);
    const ordered: string[] = [];
    for (const g of GROUP_ORDER) {
      ordered.push(
        ...newDefs.filter((d) => d.group === g).sort((a, b) => b.rating - a.rating).map((d) => d.id),
      );
    }
    setXi.mutate(ordered);
  };

  const xiAvg = xiOrdered.length
    ? Math.round(xiOrdered.reduce((s, pl) => s + pl.rating, 0) / xiOrdered.length)
    : 0;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {team && <TeamLogo team={team} size={46} />}
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black italic">
              আমার <span className="text-[var(--gold)]">দল</span>
              {team?.kind === "national" && <FlagBadge teamId={team.id} width={28} />}
            </h2>
            <p className="text-sm font-semibold text-[var(--dim)]">
              {team ? `${team.name} • ` : ""}ফরমেশন ৪-৩-৩ • দলের শক্তি{" "}
              <span className="font-black text-[var(--gold)]">{xiAvg}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setXi.mutate(bestXiIds(owned.map((r) => r.def)))}
          className="game-panel shrink-0 bg-[var(--gold)] px-4 py-2 text-sm font-black italic text-black"
        >
          সেরা একাদশ
        </button>
      </div>

      {/* formation pitch with mini player cards, like a game team screen */}
      <div
        className="game-panel relative mt-3 overflow-hidden ring-1 ring-white/20"
        style={{
          aspectRatio: "100 / 118",
          background:
            "repeating-linear-gradient(to bottom, #148544 0 10%, #0f7038 10% 20%)",
        }}
      >
        <div className="absolute inset-2 rounded-lg border-2 border-white/70" />
        <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-white/70" />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70"
          style={{ width: "22%", aspectRatio: "1" }}
        />
        <div className="absolute left-1/2 top-2 h-10 w-1/2 -translate-x-1/2 border-2 border-t-0 border-white/70" />
        <div className="absolute bottom-2 left-1/2 h-10 w-1/2 -translate-x-1/2 border-2 border-b-0 border-white/70" />
        <span className="absolute left-3 top-2.5 rounded bg-black/55 px-2 py-0.5 text-[10px] font-black tracking-widest text-white">
          ৪-৩-৩
        </span>
        {xiOrdered.map((pl, i) => {
          const slot = SLOT_POS[i] ?? { x: 50, y: 50 };
          const isSel = selected === pl.id;
          return (
            <button
              key={pl.id}
              type="button"
              onClick={() => tapPlayer(pl)}
              aria-label={`${pl.name}, ${pl.pos}, রেটিং ${pl.rating}`}
              className="absolute w-[19%] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <span
                className={`card-sheen block overflow-hidden shadow-lg ${
                  isSel ? "ring-[3px] ring-[var(--gold)]" : "ring-1 ring-black/40"
                }`}
                style={{
                  background: TIER_CARD[pl.tier],
                  clipPath: "polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))",
                }}
              >
                <span className={`flex items-baseline justify-center gap-1 pt-1 ${TIER_CARD_TEXT[pl.tier]}`}>
                  <span className="text-lg font-black italic leading-none tabular-nums">{pl.rating}</span>
                  <span className="text-[9px] font-black">{pl.pos}</span>
                </span>
                <span className="flex justify-center py-0.5">
                  <PlayerFigure pl={pl} size={30} />
                </span>
                <span className="block truncate bg-black/60 px-1 py-0.5 text-center text-[9px] font-black text-white">
                  {pl.name.split(" ").slice(-1)[0]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {hint && <p className="mt-2 text-sm font-semibold text-[var(--gold)]">{hint}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}

      <h3 className="mt-5 text-lg font-black italic">বেঞ্চ ও রিজার্ভ</h3>
      <p className="text-xs font-semibold text-[var(--dim)]">
        কার্ডে ট্যাপ করে একাদশের একই পজিশনের খেলোয়াড়ের সাথে বদলাও
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {owned
          .filter((r) => !r.inXi)
          .sort((a, b) => b.def.rating - a.def.rating)
          .map(({ def: pl }) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => tapPlayer(pl)}
              aria-label={`${pl.name}, ${pl.pos}, রেটিং ${pl.rating} — একাদশে বদলাতে ট্যাপ করো`}
              className={`text-left ${selected === pl.id ? "ring-[3px] ring-[var(--gold)]" : ""}`}
              style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))" }}
            >
              <PlayerCard compact pl={pl} />
            </button>
          ))}
      </div>
      {owned.every((r) => r.inXi) && (
        <p className="mt-2 text-sm text-[var(--dim)]">বেঞ্চ খালি — স্টোর থেকে খেলোয়াড় কিনলে তার কার্ড এখানে আসবে।</p>
      )}
    </div>
  );
}

// ---------------- store ----------------

function StoreScreen({
  profile,
  players,
  onChanged,
}: {
  profile: Profile;
  players: PlayerDef[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  const ownedIds = new Set(profile.squad.map((s) => s.playerId));
  const buy = useMutation({
    mutationFn: (playerId: string) => api.buyPlayer({ profileId: profile.profileId, playerId }),
    onSuccess: (_res, playerId) => {
      const pl = players.find((x) => x.id === playerId);
      setBought(pl ? `${pl.name} তোমার দলে যোগ দিল!` : null);
      setError(null);
      onChanged();
    },
    onError: (e) => {
      setBought(null);
      setError(e instanceof Error ? e.message : "কেনা যায়নি");
    },
  });

  const tiers: PlayerDef["tier"][] = ["legend", "epic", "gold"];
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black italic">
            প্লেয়ার <span className="text-[var(--gold)]">স্টোর</span>
          </h2>
          <p className="text-sm font-semibold text-[var(--dim)]">ম্যাচ খেলে কয়েন জমাও, কার্ড কিনে দল শক্ত করো</p>
        </div>
        <div className="game-panel shrink-0 bg-[var(--surface2)] px-3.5 py-1.5 ring-1 ring-[var(--gold)]/50">
          <Coin amount={profile.coins} />
        </div>
      </div>
      {bought && (
        <p className="game-panel mt-3 bg-[var(--accent)] p-3 text-center text-sm font-black text-white">
          🎉 {bought}
        </p>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{error}</p>}

      {tiers.map((tier) => (
        <div key={tier} className="mt-6">
          <h3 className="flex items-center gap-2 text-lg font-black italic">
            <span className={`px-2.5 py-0.5 text-[11px] font-black ${TIER_STYLE[tier]}`}>
              {TIER_LABEL[tier]}
            </span>
            {tier === "legend" ? "সর্বকালের সেরারা" : tier === "epic" ? "বিশ্বমানের তারকা" : "নির্ভরযোগ্য তারকা"}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {players
              .filter((pl) => pl.tier === tier)
              .sort((a, b) => b.rating - a.rating)
              .map((pl) => {
                const owned = ownedIds.has(pl.id);
                const afford = profile.coins >= pl.price;
                return (
                  <PlayerCard
                    key={pl.id}
                    pl={pl}
                    footer={
                      <div className="bg-black/55 px-2.5 pb-2.5 pt-2">
                        <button
                          type="button"
                          disabled={owned || buy.isPending}
                          onClick={() => buy.mutate(pl.id)}
                          aria-label={owned ? `${pl.name} ইতিমধ্যে দলে আছে` : `${pl.name} কেনো, দাম ${pl.price} কয়েন`}
                          className={`flex min-h-10 w-full items-center justify-center gap-1.5 text-sm font-black italic ${
                            owned
                              ? "bg-white/15 text-white/50"
                              : afford
                                ? "bg-[var(--gold)] text-black"
                                : "bg-white/10 text-white ring-1 ring-white/30"
                          }`}
                          style={{ clipPath: "polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px))" }}
                        >
                          {owned ? "✓ দলে আছে" : (
                            <>
                              কেনো • <Coin amount={pl.price} />
                            </>
                          )}
                        </button>
                        {!owned && !afford && (
                          <p className="mt-1.5 text-center text-[10px] font-semibold text-white/60">
                            আরও {(pl.price - profile.coins).toLocaleString("en-US")} কয়েন লাগবে
                          </p>
                        )}
                      </div>
                    }
                  />
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- play & tournament ----------------

function BracketMatch({
  m,
  teamById,
  userTeamId,
}: {
  m: TMatch;
  teamById: Map<string, TeamDef>;
  userTeamId: string;
}) {
  const home = teamById.get(m.home);
  const away = teamById.get(m.away);
  if (!home || !away) return null;
  const row = (t: TeamDef, score: number | null) => (
    <div
      className={`flex items-center gap-2 py-1 ${
        m.winner === t.id ? "font-black text-[var(--gold)]" : ""
      } ${t.id === userTeamId ? "underline decoration-[var(--accent)] decoration-2 underline-offset-4" : ""}`}
    >
      <TeamLogo team={t} size={22} />
      {t.kind === "national" && <FlagBadge teamId={t.id} width={20} />}
      <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
      <span className="tabular-nums text-sm font-black">{score ?? "–"}</span>
    </div>
  );
  return (
    <div className="rounded-[var(--radius)] bg-[var(--surface)] px-3 py-1.5 ring-1 ring-[var(--border)]">
      {row(home, m.hs)}
      {row(away, m.as)}
    </div>
  );
}

function PlayScreen({
  profile,
  teams,
  teamById,
  tourney,
  onQuick,
  onStartTournament,
  onTournamentMatch,
  onSimRest,
  onDropTournament,
}: {
  profile: Profile;
  teams: TeamDef[];
  teamById: Map<string, TeamDef>;
  tourney: Tourney | null;
  onQuick: (cpuTeamId: string) => void;
  onStartTournament: () => void;
  onTournamentMatch: (stage: "qf" | "sf" | "f") => void;
  onSimRest: () => void;
  onDropTournament: () => void;
}) {
  const myTeamId = profile.teamId ?? "dhaka-kings";
  const opponents = teams.filter((t) => t.id !== myTeamId);
  const [oppId, setOppId] = useState<string>("");
  const selectedOpp = teamById.get(oppId) ?? opponents[0];

  const stage = tourney ? currentStage(tourney) : null;
  const playStage: "qf" | "sf" | "f" | null =
    stage === "qf" || stage === "sf" || stage === "f" ? stage : null;
  const userAlive =
    tourney != null &&
    stage !== "done" &&
    (stage === "qf"
      ? tourney.qf.some((m) => !m.winner && (m.home === tourney.userTeamId || m.away === tourney.userTeamId))
      : stage === "sf"
        ? tourney.sf.some((m) => !m.winner && (m.home === tourney.userTeamId || m.away === tourney.userTeamId))
        : tourney.f.some((m) => !m.winner && (m.home === tourney.userTeamId || m.away === tourney.userTeamId)));
  const userEliminated = tourney != null && !tourney.champion && !userAlive;

  const myTeam = teamById.get(myTeamId);
  return (
    <div>
      <h2 className="text-2xl font-black italic">
        ম্যাচ <span className="text-[var(--gold)]">খেলো</span>
      </h2>

      {/* quick match — VS presentation */}
      <section className="game-panel mt-3 bg-[var(--surface)] p-4">
        <h3 className="font-black italic">⚡ কুইক ম্যাচ</h3>
        <p className="mt-0.5 text-sm font-semibold text-[var(--dim)]">জিতলে ১৫০ কয়েন + প্রতি গোলে বোনাস</p>
        {selectedOpp && myTeam && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <TeamLogo team={myTeam} size={58} />
              <span className="flex max-w-28 items-center gap-1.5 truncate text-xs font-black">
                {myTeam.kind === "national" && <FlagBadge teamId={myTeam.id} width={20} />}
                {myTeam.short}
              </span>
              <span className="text-[10px] font-bold text-[var(--dim)]">শক্তি {myTeam.rating}</span>
            </div>
            <span className="-skew-x-6 bg-[var(--gold)] px-2.5 py-1 text-lg font-black italic text-black">VS</span>
            <div className="flex flex-col items-center gap-1.5">
              <TeamLogo team={selectedOpp} size={58} />
              <span className="flex max-w-28 items-center gap-1.5 truncate text-xs font-black">
                {selectedOpp.kind === "national" && <FlagBadge teamId={selectedOpp.id} width={20} />}
                {selectedOpp.short}
              </span>
              <span className="text-[10px] font-bold text-[var(--dim)]">শক্তি {selectedOpp.rating}</span>
            </div>
          </div>
        )}
        <label htmlFor="opp-select" className="mt-4 block text-xs font-bold text-[var(--dim)]">
          প্রতিপক্ষ বদলাও
        </label>
        <select
          id="opp-select"
          value={selectedOpp?.id ?? ""}
          onChange={(e) => setOppId(e.target.value)}
          className="mt-1 w-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-2.5 font-bold"
        >
          {opponents.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} (শক্তি {t.rating})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedOpp}
          onClick={() => selectedOpp && onQuick(selectedOpp.id)}
          className="game-panel mt-4 min-h-13 w-full bg-[var(--accent)] py-3 text-xl font-black italic text-white shadow-[0_6px_24px_rgba(0,217,95,0.4)] disabled:opacity-50"
        >
          ম্যাচ শুরু ▶
        </button>
        <p className="mt-2 text-center text-[11px] font-semibold text-[var(--dim)]">
          ম্যাচ খুললেই ফোন পাশে ঘুরিয়ে দুই হাতে ধরো
        </p>
      </section>

      {/* tournament */}
      <section className="game-panel mt-4 bg-[var(--surface)] p-4">
        <h3 className="font-black italic">🏆 টুর্নামেন্ট — ৮ দলের নকআউট</h3>
        {!tourney && (
          <>
            <p className="mt-0.5 text-sm font-semibold text-[var(--dim)]">
              কোয়ার্টার ফাইনাল থেকে ফাইনাল — চ্যাম্পিয়ন হলে মোটা কয়েন পুরস্কার।
            </p>
            <button
              type="button"
              onClick={onStartTournament}
              className="game-panel mt-4 min-h-12 w-full bg-[var(--gold)] py-3 text-lg font-black italic text-black"
            >
              নতুন টুর্নামেন্ট শুরু করো
            </button>
          </>
        )}
        {tourney && (
          <div>
            {tourney.champion && (
              <p className="game-panel mt-2 bg-[var(--gold)] p-3 text-center font-black italic text-black">
                🏆 চ্যাম্পিয়ন: {teamById.get(tourney.champion)?.name ?? tourney.champion}
                {tourney.champion === tourney.userTeamId ? " — তুমি জিতেছ!" : ""}
              </p>
            )}
            {userAlive && playStage && (
              <button
                type="button"
                onClick={() => onTournamentMatch(playStage)}
                className="game-panel mt-3 min-h-12 w-full bg-[var(--accent)] py-3 text-lg font-black italic text-white"
              >
                {playStage === "qf" ? "কোয়ার্টার ফাইনাল খেলো ▶" : playStage === "sf" ? "সেমিফাইনাল খেলো ▶" : "ফাইনাল খেলো ▶"}
              </button>
            )}
            {userEliminated && !tourney.champion && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-[var(--danger)]">
                  তুমি ছিটকে গেছ — বাকি টুর্নামেন্ট দেখে নাও
                </p>
                <button
                  type="button"
                  onClick={onSimRest}
                  className="game-panel mt-2 min-h-11 w-full bg-[var(--surface2)] py-2.5 font-black italic ring-1 ring-[var(--border)]"
                >
                  বাকি ম্যাচ সিমুলেট করো
                </button>
              </div>
            )}

            <h4 className="mt-4 text-sm font-black text-[var(--dim)]">কোয়ার্টার ফাইনাল</h4>
            <div className="mt-1.5 space-y-2">
              {tourney.qf.map((m, i) => (
                <BracketMatch key={i} m={m} teamById={teamById} userTeamId={tourney.userTeamId} />
              ))}
            </div>
            {tourney.sf.length > 0 && (
              <>
                <h4 className="mt-4 text-sm font-black text-[var(--dim)]">সেমিফাইনাল</h4>
                <div className="mt-1.5 space-y-2">
                  {tourney.sf.map((m, i) => (
                    <BracketMatch key={i} m={m} teamById={teamById} userTeamId={tourney.userTeamId} />
                  ))}
                </div>
              </>
            )}
            {tourney.f.length > 0 && (
              <>
                <h4 className="mt-4 text-sm font-black text-[var(--dim)]">ফাইনাল</h4>
                <div className="mt-1.5 space-y-2">
                  {tourney.f.map((m, i) => (
                    <BracketMatch key={i} m={m} teamById={teamById} userTeamId={tourney.userTeamId} />
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={onDropTournament}
              className="mt-4 min-h-10 w-full rounded-full text-sm font-bold text-[var(--danger)]"
            >
              টুর্নামেন্ট ছেড়ে দাও
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
