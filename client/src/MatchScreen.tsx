// Playable match screen — a full-screen landscape game view: the pitch
// fills the screen, a broadcast scorebug floats on top, the joystick sits
// under the left thumb and the action buttons under the right thumb, like
// a console football game held with two hands.

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { MatchEngine, type EnginePlayerInfo, type HudState } from "./engine";
import { FlagBadge, TeamLogo } from "./branding";

type TeamDef = ApiResponse<typeof api, "getCatalog">["teams"][number];

export interface MatchFinish {
  userGoals: number;
  cpuGoals: number;
  /** For tournament draws decided on penalties. */
  pensWinner: "user" | "cpu" | null;
}

interface Props {
  profileId: number;
  userTeam: TeamDef;
  cpuTeam: TeamDef;
  userXI: EnginePlayerInfo[];
  cpuXI: EnginePlayerInfo[];
  mode: "quick" | "tournament";
  stage: "qf" | "sf" | "f" | null;
  onFinish: (r: MatchFinish) => void;
  onRematch?: () => void;
  onQuit: () => void;
}

type Phase = "ready" | "playing" | "pens" | "ended";

export function MatchScreen(props: Props) {
  const { userTeam, cpuTeam } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyPointer = useRef<number | null>(null);
  const keysRef = useRef<Set<string>>(new Set());

  const [phase, setPhase] = useState<Phase>("ready");
  const [landscape, setLandscape] = useState<boolean>(
    () => window.innerWidth > window.innerHeight,
  );
  const fsEntered = useRef(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [goalFlash, setGoalFlash] = useState<{ text: string; mine: boolean; key: number } | null>(null);
  const [finalScore, setFinalScore] = useState<{ ug: number; cg: number } | null>(null);
  const [pensWinner, setPensWinner] = useState<"user" | "cpu" | null>(null);
  const [coinsEarned, setCoinsEarned] = useState<number | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const record = useMutation({
    mutationFn: (args: {
      result: "win" | "draw" | "loss";
      goalsFor: number;
      goalsAgainst: number;
    }) =>
      api.recordMatch({
        profileId: props.profileId,
        mode: props.mode,
        stage: props.mode === "tournament" ? props.stage : null,
        result: args.result,
        goalsFor: args.goalsFor,
        goalsAgainst: args.goalsAgainst,
      }),
    onSuccess: (res) => {
      setCoinsEarned(res.coinsEarned);
      setPhase("ended");
    },
    onError: () => {
      setRecordError("ফলাফল সেভ হয়নি — কয়েন যোগ নাও হতে পারে");
      setPhase("ended");
    },
  });

  const finishMatch = (ug: number, cg: number, result: "win" | "draw" | "loss") => {
    setFinalScore({ ug, cg });
    record.mutate({ result, goalsFor: ug, goalsAgainst: cg });
  };

  const handleEnd = (ug: number, cg: number) => {
    setFinalScore({ ug, cg });
    if (props.mode === "tournament" && ug === cg) {
      setPhase("pens");
      return;
    }
    finishMatch(ug, cg, ug > cg ? "win" : ug < cg ? "loss" : "draw");
  };

  const decidePens = () => {
    const winner: "user" | "cpu" = Math.random() < 0.5 ? "user" : "cpu";
    setPensWinner(winner);
    if (finalScore) {
      finishMatch(finalScore.ug, finalScore.cg, winner === "user" ? "win" : "loss");
    }
  };

  // Track device orientation: landscape rotates the pitch sideways.
  useEffect(() => {
    const onResize = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setLandscape(landscape);
  }, [landscape]);

  const startMatch = () => {
    const canvas = canvasRef.current;
    if (!canvas || engineRef.current) return;
    // Best effort: go fullscreen and lock landscape on phones, like a real
    // football game. Silently ignored where the frame forbids it — the
    // player can still rotate the phone manually.
    try {
      const req = document.documentElement.requestFullscreen?.();
      if (req) {
        void req
          .then(() => {
            fsEntered.current = true;
            const so = screen.orientation as ScreenOrientation & {
              lock?: (o: "landscape") => Promise<void>;
            };
            return so.lock?.("landscape");
          })
          .catch(() => {});
      }
    } catch {
      // fullscreen unavailable — play on without it
    }
    const userRating =
      props.userXI.reduce((s, pl) => s + pl.rating, 0) / Math.max(1, props.userXI.length);
    const engine = new MatchEngine(canvas, {
      userXI: props.userXI,
      cpuXI: props.cpuXI,
      userTeam: { name: userTeam.name, short: userTeam.short, color: userTeam.color, color2: userTeam.color2 },
      cpuTeam: { name: cpuTeam.name, short: cpuTeam.short, color: cpuTeam.color, color2: cpuTeam.color2 },
      durationSec: 120,
      cpuRating: cpuTeam.rating,
      userRating,
      callbacks: {
        onGoal: (scorer, ug, cg) => {
          setGoalFlash({
            text: scorer === "user" ? "গোল!" : "গোল খেয়ে গেলে!",
            mine: scorer === "user",
            key: Date.now(),
          });
          setHud((h) => (h ? { ...h, userGoals: ug, cpuGoals: cg } : h));
          window.setTimeout(() => setGoalFlash(null), 2100);
        },
        onEnd: handleEnd,
        onHud: setHud,
      },
    });
    engineRef.current = engine;
    engine.setLandscape(window.innerWidth > window.innerHeight);
    engine.start();
    setPhase("playing");
  };

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
      if (fsEntered.current && document.fullscreenElement) {
        fsEntered.current = false;
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // keyboard controls (desktop)
  useEffect(() => {
    if (phase !== "playing") return;
    const applyKeys = () => {
      const k = keysRef.current;
      let x = 0;
      let y = 0;
      if (k.has("arrowleft") || k.has("a")) x -= 1;
      if (k.has("arrowright") || k.has("d")) x += 1;
      if (k.has("arrowup") || k.has("w")) y -= 1;
      if (k.has("arrowdown") || k.has("s")) y += 1;
      engineRef.current?.setMove(x, y);
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) e.preventDefault();
      if (key === "j") engineRef.current?.pressPass();
      else if (key === "k") engineRef.current?.pressShoot();
      else if (key === "l") engineRef.current?.pressTackle();
      else {
        keysRef.current.add(key);
        applyKeys();
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      applyKeys();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase]);

  // joystick
  const joyMove = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    const knob = joyKnobRef.current;
    if (!base || !knob) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = rect.width / 2 - 6;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    engineRef.current?.setMove(dx / max, dy / max);
  };
  const joyReset = () => {
    const knob = joyKnobRef.current;
    if (knob) knob.style.transform = "translate(0px, 0px)";
    engineRef.current?.setMove(0, 0);
  };

  const resultText = (() => {
    if (!finalScore) return "";
    if (pensWinner) return pensWinner === "user" ? "পেনাল্টিতে জয়!" : "পেনাল্টিতে হার";
    if (finalScore.ug > finalScore.cg) return "তুমি জিতেছ!";
    if (finalScore.ug < finalScore.cg) return "হার — পরের ম্যাচে হবে";
    return "ড্র";
  })();

  const modeLabel =
    props.mode === "tournament"
      ? props.stage === "qf"
        ? "কোয়ার্টার ফাইনাল"
        : props.stage === "sf"
          ? "সেমিফাইনাল"
          : "ফাইনাল"
      : "কুইক ম্যাচ";

  const actionBtn =
    "pointer-events-auto flex shrink-0 flex-col items-center justify-center rounded-full font-black text-white shadow-[0_4px_18px_rgba(0,0,0,0.55)] ring-2 ring-white/35 backdrop-blur-sm active:scale-95";

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-black text-[var(--text)]">
      {/* pitch — fills the whole screen */}
      <div className="relative min-h-0 flex-1 bg-[#0a5c2c]">
        <div className="absolute inset-0 flex items-center justify-center">
          <canvas ref={canvasRef} className="match-pitch block" aria-label="ফুটবল মাঠ" />
        </div>

        {/* broadcast scorebug, top-left like a TV match */}
        <div className="absolute left-2 top-2 z-30 flex items-stretch overflow-hidden rounded-md shadow-lg sm:left-3 sm:top-3">
          <div className="flex items-center gap-1.5 bg-black/85 py-1 pl-2 pr-1.5">
            <TeamLogo team={userTeam} size={17} />
            {userTeam.kind === "national" && <FlagBadge teamId={userTeam.id} width={18} />}
            <span className="text-xs font-black tracking-wide">{userTeam.short}</span>
          </div>
          <div className="flex items-center bg-[var(--gold)] px-2 text-sm font-black tabular-nums text-black">
            {hud?.userGoals ?? 0}–{hud?.cpuGoals ?? 0}
          </div>
          <div className="flex items-center gap-1.5 bg-black/85 py-1 pl-1.5 pr-2">
            <span className="text-xs font-black tracking-wide">{cpuTeam.short}</span>
            {cpuTeam.kind === "national" && <FlagBadge teamId={cpuTeam.id} width={18} />}
            <TeamLogo team={cpuTeam} size={17} />
          </div>
          <div className="flex items-center bg-white px-2 text-xs font-black tabular-nums text-black">
            {phase === "ended" ? "FT" : `${hud?.minute ?? 0}'`}
          </div>
        </div>

        {/* mode + ball carrier, top center (hidden on narrow portrait —
            the scorebug already takes that corner) */}
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 hidden -translate-x-1/2 text-center min-[560px]:block sm:top-3">
          <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/85">
            {modeLabel}
          </span>
          {hud?.carrierName && phase === "playing" && (
            <p className="mt-1 hidden text-[11px] font-semibold text-white/80 landscape:block">
              বলে: {hud.carrierName}
            </p>
          )}
        </div>

        {/* quit, top-right */}
        <button
          type="button"
          onClick={props.onQuit}
          aria-label="ম্যাচ ছাড়ো"
          className="absolute right-2 top-2 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg font-black text-white ring-1 ring-white/30 sm:right-3 sm:top-3"
        >
          ✕
        </button>

        {goalFlash && (
          <div
            key={goalFlash.key}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <span
              className={`goal-pop -skew-x-6 px-8 py-3 text-5xl font-black italic tracking-tight shadow-2xl ${
                goalFlash.mine ? "bg-[var(--gold)] text-black" : "bg-[var(--danger)] text-white"
              }`}
              style={{ clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" }}
            >
              {goalFlash.text}
            </span>
          </div>
        )}

        {phase === "ready" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 px-6 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--gold)]">
              {modeLabel} • ১১ বনাম ১১
            </p>
            <div className="mt-3 flex items-center gap-4">
              <span className="flex flex-col items-center gap-1">
                <TeamLogo team={userTeam} size={54} />
                {userTeam.kind === "national" && <FlagBadge teamId={userTeam.id} width={26} />}
              </span>
              <span className="-skew-x-6 bg-[var(--gold)] px-2 py-0.5 text-base font-black italic text-black">VS</span>
              <span className="flex flex-col items-center gap-1">
                <TeamLogo team={cpuTeam} size={54} />
                {cpuTeam.kind === "national" && <FlagBadge teamId={cpuTeam.id} width={26} />}
              </span>
            </div>
            <p className="mt-2 text-2xl font-black italic sm:text-3xl">
              {userTeam.name} <span className="not-italic text-[var(--gold)]">VS</span> {cpuTeam.name}
            </p>
            {!landscape ? (
              <div className="mt-5 flex flex-col items-center">
                <div className="rotate-hint flex h-10 w-16 items-center justify-center rounded-lg border-[3px] border-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                </div>
                <p className="mt-3 max-w-64 text-sm font-bold text-white">
                  ফোনটা পাশে ঘোরাও — দুই হাতে ধরে খেলো
                </p>
                <p className="mt-1 max-w-64 text-xs text-white/60">
                  বাম হাতে জয়স্টিক, ডান হাতে পাস–শুট বাটন। ল্যান্ডস্কেপে মাঠ বড় হয়ে যাবে।
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/70">
                বামে জয়স্টিক দিয়ে দৌড়াও — ডানে পাস, শুট আর ট্যাকল
              </p>
            )}
            <button
              type="button"
              onClick={startMatch}
              className="game-panel mt-6 min-h-13 bg-[var(--accent)] px-10 py-3 text-xl font-black italic text-white shadow-[0_6px_24px_rgba(0,217,95,0.45)]"
            >
              কিক অফ ▶
            </button>
          </div>
        )}

        {phase === "pens" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 px-6 text-center">
            <p className="text-2xl font-black italic">ড্র! পেনাল্টি শুটআউট</p>
            <p className="mt-2 text-sm text-white/70">
              স্কোর {finalScore?.ug} — {finalScore?.cg}। নকআউট ম্যাচে বিজয়ী লাগবেই।
            </p>
            <button
              type="button"
              onClick={decidePens}
              className="game-panel mt-5 min-h-12 bg-[var(--gold)] px-8 py-3 text-lg font-black italic text-black"
            >
              পেনাল্টি দেখো
            </button>
          </div>
        )}

        {phase === "ended" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 px-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60">ম্যাচ শেষ • ফুল টাইম</p>
            <p className="mt-2 text-6xl font-black italic tabular-nums">
              {finalScore?.ug} <span className="text-[var(--gold)]">—</span> {finalScore?.cg}
            </p>
            <p className="mt-1 text-sm font-bold text-white/70">
              {userTeam.short} বনাম {cpuTeam.short}
            </p>
            <p className="mt-2 text-2xl font-black italic">{resultText}</p>
            {coinsEarned != null && (
              <p className="game-panel mt-3 bg-[var(--gold)] px-5 py-1.5 text-base font-black text-black">
                +{coinsEarned} কয়েন
              </p>
            )}
            {recordError && <p className="mt-2 text-xs text-[var(--danger)]">{recordError}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {props.onRematch && props.mode === "quick" && (
                <button
                  type="button"
                  onClick={props.onRematch}
                  className="game-panel min-h-11 bg-white/15 px-6 py-2.5 font-black italic text-white ring-1 ring-white/40"
                >
                  আবার খেলো
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  finalScore &&
                  props.onFinish({
                    userGoals: finalScore.ug,
                    cpuGoals: finalScore.cg,
                    pensWinner,
                  })
                }
                className="game-panel min-h-11 bg-[var(--accent)] px-6 py-2.5 font-black italic text-white"
              >
                ফিরে যাও
              </button>
            </div>
          </div>
        )}

        {/* two-thumb controls, overlaid on the pitch corners */}
        {phase === "playing" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
            {/* left thumb: joystick */}
            <div
              ref={joyBaseRef}
              role="application"
              aria-label="জয়স্টিক — খেলোয়াড় নাড়াও"
              className="pointer-events-auto relative h-32 w-32 shrink-0 rounded-full border-2 border-white/30 bg-black/35 backdrop-blur-[2px] landscape:h-36 landscape:w-36"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => {
                joyPointer.current = e.pointerId;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                joyMove(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (joyPointer.current === e.pointerId) joyMove(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                joyPointer.current = null;
                joyReset();
              }}
              onPointerCancel={() => {
                joyPointer.current = null;
                joyReset();
              }}
            >
              <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] text-white/50">▲</span>
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white/50">▼</span>
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-white/50">◀</span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/50">▶</span>
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  ref={joyKnobRef}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/25 shadow-lg ring-2 ring-white/50 landscape:h-[4.5rem] landscape:w-[4.5rem]"
                >
                  <span className="h-6 w-6 rounded-full bg-white/40" />
                </div>
              </div>
            </div>

            {/* right thumb: action cluster, shoot biggest and lowest */}
            <div className="pointer-events-none relative h-36 w-44 shrink-0 landscape:h-40 landscape:w-48">
              <button
                type="button"
                aria-label="শুট করো"
                onPointerDown={() => engineRef.current?.pressShoot()}
                className={`${actionBtn} absolute bottom-0 right-0 h-20 w-20 bg-[#e63946]/85 text-base landscape:h-24 landscape:w-24`}
              >
                <span className="text-xl leading-none">⚽</span>
                শুট
              </button>
              <button
                type="button"
                aria-label="পাস দাও"
                onPointerDown={() => engineRef.current?.pressPass()}
                className={`${actionBtn} absolute bottom-1 right-[5.5rem] h-16 w-16 bg-[#2563eb]/85 text-sm landscape:right-28 landscape:h-[4.5rem] landscape:w-[4.5rem]`}
              >
                <span className="text-base leading-none">➤</span>
                পাস
              </button>
              <button
                type="button"
                aria-label="ট্যাকল করো বা খেলোয়াড় বদলাও"
                onPointerDown={() => engineRef.current?.pressTackle()}
                className={`${actionBtn} absolute right-6 top-0 h-14 w-14 bg-slate-700/85 text-[11px] landscape:h-16 landscape:w-16`}
              >
                <span className="text-sm leading-none">🛡</span>
                ট্যাকল
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="hidden shrink-0 bg-black py-1 text-center text-[11px] text-white/40 landscape:hidden">
        কিবোর্ড: WASD/তীর চিহ্ন, J পাস, K শুট, L ট্যাকল
      </p>
    </div>
  );
}
