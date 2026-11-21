// 2D 11v11 match engine for Dream Football 11.
// Simulation space is a portrait pitch: the user attacks the top goal
// (y = 0), the CPU attacks the bottom goal (y = 150). Pitch units:
// x 0..100, y 0..150. When the screen is landscape the pitch is drawn
// rotated 90° (user attacks the right goal) and joystick/keyboard input,
// which arrives in screen space, is rotated back into pitch space.

export type PosGroup = "GK" | "DEF" | "MID" | "FWD";

export interface EnginePlayerInfo {
  name: string;
  pos: string;
  group: PosGroup;
  rating: number;
  pace: number;
  shooting: number;
  passing: number;
  defense: number;
}

export interface EngineTeamInfo {
  name: string;
  short: string;
  color: string;
  color2: string;
}

export interface HudState {
  minute: number;
  userGoals: number;
  cpuGoals: number;
  userShort: string;
  cpuShort: string;
  carrierName: string | null;
}

export interface MatchCallbacks {
  onGoal: (scorer: "user" | "cpu", userGoals: number, cpuGoals: number) => void;
  onEnd: (userGoals: number, cpuGoals: number) => void;
  onHud: (hud: HudState) => void;
}

const W = 100;
const H = 150;
const GOAL_MIN = 38;
const GOAL_MAX = 62;

// Formation slots for the user team (attacking up). CPU homes are mirrored.
const SLOTS: { x: number; y: number }[] = [
  { x: 50, y: 140 }, // GK
  { x: 16, y: 116 }, { x: 38, y: 122 }, { x: 62, y: 122 }, { x: 84, y: 116 }, // DEF
  { x: 24, y: 88 }, { x: 50, y: 94 }, { x: 76, y: 88 }, // MID
  { x: 18, y: 58 }, { x: 50, y: 50 }, { x: 82, y: 58 }, // FWD
];

interface P {
  team: 0 | 1;
  info: EnginePlayerInfo;
  slot: number;
  x: number;
  y: number;
  hx: number;
  hy: number;
  faceX: number;
  faceY: number;
  stealCd: number;
  stumble: number;
  kickHold: number; // GK holding the ball, seconds left
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

export class MatchEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private lastTs = 0;
  private destroyed = false;

  private players: P[] = [];
  private ball = { x: 50, y: 75, vx: 0, vy: 0, owner: null as P | null, lastTouch: 0 as 0 | 1 };
  private userGoals = 0;
  private cpuGoals = 0;
  private elapsed = 0;
  private state: "play" | "goal" | "over" = "play";
  private goalTimer = 0;
  private hudTimer = 0;
  private switchTimer = 0;
  private cpuThink = 0;
  private ended = false;

  private moveX = 0;
  private moveY = 0;
  private landscape = false;
  controlled: P | null = null;

  private readonly duration: number;
  private readonly cb: MatchCallbacks;
  private readonly userTeam: EngineTeamInfo;
  private readonly cpuTeam: EngineTeamInfo;
  private readonly cpuSkill: number; // 0.85 .. 1.15 multiplier

  constructor(
    canvas: HTMLCanvasElement,
    opts: {
      userXI: EnginePlayerInfo[];
      cpuXI: EnginePlayerInfo[];
      userTeam: EngineTeamInfo;
      cpuTeam: EngineTeamInfo;
      durationSec: number;
      cpuRating: number;
      userRating: number;
      callbacks: MatchCallbacks;
    },
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    this.ctx = ctx;
    this.cb = opts.callbacks;
    this.duration = opts.durationSec;
    this.userTeam = opts.userTeam;
    this.cpuTeam = opts.cpuTeam;
    this.cpuSkill = clamp(1 + (opts.cpuRating - opts.userRating) * 0.006, 0.85, 1.15);

    const mk = (info: EnginePlayerInfo, team: 0 | 1, slot: number): P => {
      const s = SLOTS[slot] ?? { x: 50, y: 75 };
      const hx = s.x;
      const hy = team === 0 ? s.y : H - s.y;
      return {
        team,
        info,
        slot,
        x: hx,
        y: hy,
        hx,
        hy,
        faceX: 0,
        faceY: team === 0 ? -1 : 1,
        stealCd: 0,
        stumble: 0,
        kickHold: 0,
      };
    };
    opts.userXI.forEach((info, i) => this.players.push(mk(info, 0, i)));
    opts.cpuXI.forEach((info, i) => this.players.push(mk(info, 1, i)));
    this.kickoff(0);
  }

  start() {
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (this.destroyed) return;
      const dt = clamp((ts - this.lastTs) / 1000, 0, 0.033);
      this.lastTs = ts;
      this.step(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  setLandscape(v: boolean) {
    this.landscape = v;
  }

  /** Input arrives in screen space (x right, y down). In landscape the
   * pitch is rotated, so screen-right is pitch-up (attack) and
   * screen-down is pitch-right. */
  setMove(x: number, y: number) {
    if (this.landscape) {
      this.moveX = y;
      this.moveY = -x;
    } else {
      this.moveX = x;
      this.moveY = y;
    }
  }

  // ---- input actions -------------------------------------------------

  pressPass() {
    if (this.state !== "play") return;
    const owner = this.ball.owner;
    if (!owner || owner.team !== 0) {
      this.switchPlayer();
      return;
    }
    this.doPass(owner);
  }

  pressShoot() {
    if (this.state !== "play") return;
    const owner = this.ball.owner;
    if (!owner || owner.team !== 0) return;
    this.doShoot(owner);
  }

  pressTackle() {
    if (this.state !== "play") return;
    const owner = this.ball.owner;
    const me = this.controlled;
    if (!me) return;
    if (owner && owner.team === 1) {
      if (dist(me.x, me.y, owner.x, owner.y) < 3.6 && me.stealCd <= 0) {
        me.stealCd = 0.9;
        const chance = 0.35 + (me.info.defense - owner.info.pace) * 0.004;
        if (Math.random() < clamp(chance, 0.15, 0.7)) {
          this.ball.owner = me;
          this.ball.lastTouch = 0;
          owner.stumble = 0.5;
        } else {
          me.stumble = 0.45;
        }
      } else {
        this.switchPlayer();
      }
    } else if (!owner) {
      this.switchPlayer();
    }
  }

  private switchPlayer() {
    const mine = this.players.filter((pl) => pl.team === 0 && pl.info.group !== "GK");
    mine.sort((a, b) => dist(a.x, a.y, this.ball.x, this.ball.y) - dist(b.x, b.y, this.ball.x, this.ball.y));
    const nearest = mine[0];
    if (!nearest) return;
    if (this.controlled === nearest) {
      this.controlled = mine[1] ?? nearest;
    } else {
      this.controlled = nearest;
    }
  }

  // ---- core actions --------------------------------------------------

  private doPass(owner: P) {
    const mates = this.players.filter((pl) => pl.team === owner.team && pl !== owner);
    let target: P | null = null;
    let best = -Infinity;
    const aimX = this.moveX;
    const aimY = this.moveY;
    const hasAim = Math.hypot(aimX, aimY) > 0.3;
    for (const m of mates) {
      const dx = m.x - owner.x;
      const dy = m.y - owner.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) continue;
      let score = -d * 0.6;
      if (hasAim) {
        const dot = (dx / d) * aimX + (dy / d) * aimY;
        score += dot * 40;
      } else {
        // default: prefer forward progress for the attacking direction
        const fwd = owner.team === 0 ? -dy : dy;
        score += fwd * 0.9 - Math.abs(dx) * 0.2;
      }
      if (m.info.group === "GK") score -= 30;
      if (score > best) {
        best = score;
        target = m;
      }
    }
    if (!target) return;
    const dx = target.x - this.ball.x;
    const dy = target.y - this.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = clamp(d * 2.4 + 26, 34, 78) * (0.85 + owner.info.passing / 100 * 0.3);
    this.ball.owner = null;
    this.ball.vx = (dx / d) * speed;
    this.ball.vy = (dy / d) * speed;
    this.ball.lastTouch = owner.team;
  }

  private doShoot(owner: P) {
    const goalY = owner.team === 0 ? 0 : H;
    const aimX = 50 + (Math.random() * 16 - 8) + this.moveX * 6;
    const dx = aimX - this.ball.x;
    const dy = goalY - this.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const spread = (100 - owner.info.shooting) * 0.0035;
    const ang = Math.atan2(dy, dx) + (Math.random() * 2 - 1) * spread * Math.min(d / 30, 1.6);
    const power = clamp(62 + owner.info.shooting * 0.35, 70, 98);
    this.ball.owner = null;
    this.ball.vx = Math.cos(ang) * power;
    this.ball.vy = Math.sin(ang) * power;
    this.ball.lastTouch = owner.team;
  }

  private gkKick(gk: P) {
    const dirY = gk.team === 0 ? -1 : 1;
    const tx = 50 + (Math.random() * 40 - 20);
    const ty = gk.y + dirY * (38 + Math.random() * 18);
    const dx = tx - this.ball.x;
    const dy = ty - this.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    this.ball.owner = null;
    this.ball.vx = (dx / d) * 62;
    this.ball.vy = (dy / d) * 62;
    this.ball.lastTouch = gk.team;
  }

  private kickoff(kickTeam: 0 | 1) {
    for (const pl of this.players) {
      pl.x = pl.hx;
      pl.y = pl.hy;
      pl.stumble = 0;
      pl.kickHold = 0;
    }
    const cm = this.players.find((pl) => pl.team === kickTeam && pl.slot === 5);
    this.ball.x = 50;
    this.ball.y = 75;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.owner = cm ?? null;
    if (cm) {
      cm.x = 50;
      cm.y = kickTeam === 0 ? 78 : 72;
    }
    this.ball.lastTouch = kickTeam;
    this.pickControlled();
  }

  private pickControlled() {
    const owner = this.ball.owner;
    if (owner && owner.team === 0) {
      this.controlled = owner;
      return;
    }
    const mine = this.players.filter((pl) => pl.team === 0 && pl.info.group !== "GK");
    mine.sort((a, b) => dist(a.x, a.y, this.ball.x, this.ball.y) - dist(b.x, b.y, this.ball.x, this.ball.y));
    this.controlled = mine[0] ?? null;
  }

  // ---- simulation ----------------------------------------------------

  private step(dt: number) {
    if (this.state === "over") return;
    if (this.state === "goal") {
      this.goalTimer -= dt;
      if (this.goalTimer <= 0) {
        this.state = "play";
        this.kickoff(this.ball.lastTouch === 0 ? 1 : 0);
      }
      return;
    }
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.state = "over";
      if (!this.ended) {
        this.ended = true;
        this.cb.onEnd(this.userGoals, this.cpuGoals);
      }
      return;
    }

    this.switchTimer -= dt;
    if (this.switchTimer <= 0) {
      this.switchTimer = 0.25;
      if (!this.ball.owner || this.ball.owner.team !== 0) this.pickControlled();
      else this.controlled = this.ball.owner;
    }

    this.cpuThink -= dt;
    this.updatePlayers(dt);
    this.updateBall(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.15;
      this.cb.onHud({
        minute: Math.min(90, Math.floor((this.elapsed / this.duration) * 90)),
        userGoals: this.userGoals,
        cpuGoals: this.cpuGoals,
        userShort: this.userTeam.short,
        cpuShort: this.cpuTeam.short,
        carrierName: this.ball.owner?.info.name ?? null,
      });
    }
  }

  private speedOf(pl: P): number {
    let s = 19 + pl.info.pace * 0.17;
    if (pl.team === 1) s *= this.cpuSkill;
    if (this.ball.owner === pl) s *= 0.93;
    if (pl.stumble > 0) s *= 0.35;
    return s;
  }

  private moveToward(pl: P, tx: number, ty: number, dt: number, speedMul = 1) {
    const dx = tx - pl.x;
    const dy = ty - pl.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.4) return;
    const sp = this.speedOf(pl) * speedMul;
    const stepLen = Math.min(d, sp * dt);
    pl.x += (dx / d) * stepLen;
    pl.y += (dy / d) * stepLen;
    pl.faceX = dx / d;
    pl.faceY = dy / d;
  }

  private updatePlayers(dt: number) {
    const ball = this.ball;
    const owner = ball.owner;

    // nearest outfield chasers per team
    const chaser = (team: 0 | 1): P | null => {
      const list = this.players.filter((pl) => pl.team === team && pl.info.group !== "GK");
      list.sort((a, b) => dist(a.x, a.y, ball.x, ball.y) - dist(b.x, b.y, ball.x, ball.y));
      return list[0] ?? null;
    };
    const userChaser = chaser(0);
    const cpuChaser = chaser(1);

    for (const pl of this.players) {
      pl.stealCd = Math.max(0, pl.stealCd - dt);
      pl.stumble = Math.max(0, pl.stumble - dt);

      if (pl === this.controlled && pl.team === 0) {
        // human controlled
        const mag = Math.hypot(this.moveX, this.moveY);
        if (mag > 0.12) {
          const sprint = mag > 0.92 ? 1.22 : 1;
          const sp = this.speedOf(pl) * sprint * Math.min(1, mag);
          pl.x += (this.moveX / mag) * sp * dt;
          pl.y += (this.moveY / mag) * sp * dt;
          pl.faceX = this.moveX / mag;
          pl.faceY = this.moveY / mag;
        }
        pl.x = clamp(pl.x, 2, W - 2);
        pl.y = clamp(pl.y, 2, H - 2);
        continue;
      }

      if (pl.info.group === "GK") {
        const lineY = pl.team === 0 ? 141 : 9;
        const tx = clamp(ball.x, GOAL_MIN - 6, GOAL_MAX + 6);
        const ty = lineY + (pl.team === 0 ? -1 : 1) * clamp((pl.team === 0 ? H - ball.y : ball.y) < 34 ? 3.5 : 0, 0, 3.5);
        this.moveToward(pl, tx, ty, dt, 0.9);
        if (owner === pl) {
          pl.kickHold -= dt;
          if (pl.kickHold <= 0) this.gkKick(pl);
        }
        continue;
      }

      if (owner === pl) {
        if (pl.team === 1) this.cpuCarrier(pl, dt);
        else {
          // user AI carrier shouldn't happen (carrier is controlled), but drift forward
          this.moveToward(pl, 50, 20, dt, 0.8);
        }
        continue;
      }

      // off-ball movement: home shifted by ball position
      const shiftX = (ball.x - 50) * 0.28;
      const shiftY = (ball.y - 75) * 0.32;
      let tx = clamp(pl.hx + shiftX, 4, W - 4);
      let ty = clamp(pl.hy + shiftY, 4, H - 4);

      const myTeamHasBall = owner != null && owner.team === pl.team;
      const otherHasBall = owner != null && owner.team !== pl.team;

      if (!owner) {
        // loose ball: nearest chases, others hold shape
        if (pl === (pl.team === 0 ? userChaser : cpuChaser)) {
          tx = ball.x;
          ty = ball.y;
        }
      } else if (otherHasBall) {
        if (pl === (pl.team === 0 ? userChaser : cpuChaser)) {
          tx = owner.x;
          ty = owner.y;
          // CPU tackling
          if (pl.team === 1 && dist(pl.x, pl.y, owner.x, owner.y) < 2.8 && pl.stealCd <= 0) {
            pl.stealCd = 1.1;
            const chance = (0.3 + (pl.info.defense - owner.info.pace) * 0.004) * this.cpuSkill;
            if (Math.random() < clamp(chance, 0.1, 0.62)) {
              this.ball.owner = pl;
              this.ball.lastTouch = 1;
              owner.stumble = 0.5;
            }
          }
        }
      } else if (myTeamHasBall) {
        // support: forwards push toward the attacked goal
        const dirY = pl.team === 0 ? -1 : 1;
        if (pl.info.group === "FWD") ty = clamp(pl.hy + shiftY + dirY * 10, 4, H - 4);
        if (pl.info.group === "MID") ty = clamp(pl.hy + shiftY + dirY * 5, 4, H - 4);
      }

      const urgency = pl === (pl.team === 0 ? userChaser : cpuChaser) && (otherHasBall || !owner) ? 1.05 : 0.82;
      this.moveToward(pl, tx, ty, dt, urgency);
    }

    // separation so players don't stack
    for (let i = 0; i < this.players.length; i++) {
      const a = this.players[i];
      if (!a) continue;
      for (let j = i + 1; j < this.players.length; j++) {
        const b = this.players[j];
        if (!b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 2.6) {
          const push = ((2.6 - d) / 2) * 0.5;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
  }

  private cpuCarrier(pl: P, dt: number) {
    // dribble toward the user's goal (bottom), avoiding the nearest user player
    let tx = 50 + Math.sin(this.elapsed * 0.7 + pl.slot) * 14;
    let ty = H - 12;
    const foes = this.players.filter((o) => o.team === 0 && o.info.group !== "GK");
    foes.sort((a, b) => dist(a.x, a.y, pl.x, pl.y) - dist(b.x, b.y, pl.x, pl.y));
    const near = foes[0];
    if (near && dist(near.x, near.y, pl.x, pl.y) < 9) {
      tx = pl.x + (pl.x - near.x) * 1.4;
      ty = pl.y + 16;
    }
    this.moveToward(pl, tx, ty, dt, 0.98);

    if (this.cpuThink > 0) return;
    this.cpuThink = 0.45;
    const distGoal = H - pl.y;
    const inRange = distGoal < 46 && Math.abs(pl.x - 50) < 30;
    if (inRange && Math.random() < 0.55 * this.cpuSkill) {
      this.doShoot(pl);
      return;
    }
    const pressured = near != null && dist(near.x, near.y, pl.x, pl.y) < 6.5;
    if ((pressured && Math.random() < 0.65) || Math.random() < 0.16) {
      this.doPassCpu(pl);
    }
  }

  private doPassCpu(owner: P) {
    const mates = this.players.filter((pl) => pl.team === 1 && pl !== owner && pl.info.group !== "GK");
    mates.sort((a, b) => {
      const fa = (a.y - owner.y) * 1.2 - dist(a.x, a.y, owner.x, owner.y) * 0.4;
      const fb = (b.y - owner.y) * 1.2 - dist(b.x, b.y, owner.x, owner.y) * 0.4;
      return fb - fa;
    });
    const target = mates[Math.floor(Math.random() * Math.min(3, mates.length))];
    if (!target) return;
    const dx = target.x - this.ball.x;
    const dy = target.y - this.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = clamp(d * 2.4 + 26, 34, 80);
    this.ball.owner = null;
    this.ball.vx = (dx / d) * speed;
    this.ball.vy = (dy / d) * speed;
    this.ball.lastTouch = 1;
  }

  private updateBall(dt: number) {
    const ball = this.ball;
    if (ball.owner) {
      const o = ball.owner;
      ball.x = o.x + o.faceX * 2.3;
      ball.y = o.y + o.faceY * 2.3;
      ball.vx = 0;
      ball.vy = 0;
      return;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const decay = Math.exp(-1.15 * dt);
    ball.vx *= decay;
    ball.vy *= decay;
    const speed = Math.hypot(ball.vx, ball.vy);

    // goals
    if (ball.y <= 0.6 && ball.x >= GOAL_MIN && ball.x <= GOAL_MAX) {
      this.userGoals++;
      this.state = "goal";
      this.goalTimer = 1.9;
      ball.lastTouch = 0;
      this.cb.onGoal("user", this.userGoals, this.cpuGoals);
      return;
    }
    if (ball.y >= H - 0.6 && ball.x >= GOAL_MIN && ball.x <= GOAL_MAX) {
      this.cpuGoals++;
      this.state = "goal";
      this.goalTimer = 1.9;
      ball.lastTouch = 1;
      this.cb.onGoal("cpu", this.userGoals, this.cpuGoals);
      return;
    }

    // goal-line exits -> goal kick to the defending GK
    if (ball.y < 1 || ball.y > H - 1) {
      const gkTeam: 0 | 1 = ball.y < 1 ? 1 : 0;
      const gk = this.players.find((pl) => pl.team === gkTeam && pl.info.group === "GK");
      if (gk) {
        ball.owner = gk;
        gk.kickHold = 0.7;
        ball.x = gk.x;
        ball.y = gk.y;
        ball.vx = 0;
        ball.vy = 0;
        ball.lastTouch = gkTeam;
        return;
      }
    }
    // sidelines -> throw-in for the team that didn't touch last
    if (ball.x < 1 || ball.x > W - 1) {
      const team: 0 | 1 = ball.lastTouch === 0 ? 1 : 0;
      const list = this.players.filter((pl) => pl.team === team && pl.info.group !== "GK");
      list.sort((a, b) => dist(a.x, a.y, ball.x, ball.y) - dist(b.x, b.y, ball.x, ball.y));
      const taker = list[0];
      if (taker) {
        ball.x = clamp(ball.x, 2, W - 2);
        ball.y = clamp(ball.y, 6, H - 6);
        taker.x = ball.x;
        taker.y = ball.y;
        ball.owner = taker;
        ball.vx = 0;
        ball.vy = 0;
        ball.lastTouch = team;
        return;
      }
    }

    // interceptions / trapping / GK saves
    for (const pl of this.players) {
      const d = dist(pl.x, pl.y, ball.x, ball.y);
      if (pl.info.group === "GK") {
        const ownGoalY = pl.team === 0 ? H : 0;
        const towardGoal = Math.abs(ball.y - ownGoalY) < 16;
        if (towardGoal && d < 3.4 && speed > 12) {
          // save: strong shots sometimes beat the keeper
          const saveChance = clamp(0.55 + (pl.info.defense - 80) * 0.008 - (speed - 60) * 0.004, 0.3, 0.85);
          if (Math.random() < saveChance) {
            if (speed < 46 && Math.random() < 0.6) {
              ball.owner = pl;
              pl.kickHold = 0.8;
              ball.lastTouch = pl.team;
            } else {
              const dir = ball.x < pl.x ? -1 : 1;
              ball.vx = dir * (18 + Math.random() * 16);
              ball.vy = (pl.team === 0 ? -1 : 1) * (10 + Math.random() * 12);
              ball.x = pl.x + dir * 3;
              ball.y = pl.y + (pl.team === 0 ? -2.5 : 2.5);
              ball.lastTouch = pl.team;
            }
            return;
          }
        }
        if (d < 2.3 && speed <= 26) {
          ball.owner = pl;
          pl.kickHold = 0.8;
          ball.lastTouch = pl.team;
          return;
        }
        continue;
      }
      if (d < 2.35 && speed < 58) {
        ball.owner = pl;
        ball.lastTouch = pl.team;
        ball.vx = 0;
        ball.vy = 0;
        if (pl.team === 0) this.controlled = pl;
        return;
      }
      if (d < 1.7 && speed >= 58) {
        // deflection off a body
        ball.vx *= -0.25;
        ball.vy *= -0.25;
        ball.lastTouch = pl.team;
        return;
      }
    }
  }

  // ---- rendering -----------------------------------------------------

  private draw() {
    const canvas = this.canvas;
    const parent = canvas.parentElement;
    if (!parent) return;
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    if (pw <= 0 || ph <= 0) return;
    // Fit the pitch into the available box. Landscape draws the pitch
    // sideways (150 wide × 100 tall on screen); portrait keeps 100 × 150.
    const scale = this.landscape
      ? Math.min(pw / H, ph / W)
      : Math.min(pw / W, ph / H);
    const cssW = Math.max(1, Math.round((this.landscape ? H : W) * scale));
    const cssH = Math.max(1, Math.round((this.landscape ? W : H) * scale));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }
    const ctx = this.ctx;
    if (this.landscape) {
      // Pitch (x, y) -> screen ( (H - y) * s, x * s ): the user's goal
      // (y = 0) sits on the right edge, the CPU goal on the left.
      const s = canvas.width / H;
      ctx.setTransform(0, s, -s, 0, H * s, 0);
    } else {
      const s = canvas.width / W; // px per unit (x); y uses same via height ratio
      ctx.setTransform(s, 0, 0, s, 0, 0);
    }

    // pitch stripes (horizontal bands)
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#127a3d" : "#0e6e35";
      ctx.fillRect(0, (H / bands) * i, W, H / bands + 0.2);
    }
    // lines
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 0.35;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.beginPath();
    ctx.moveTo(3, H / 2);
    ctx.lineTo(W - 3, H / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(50, H / 2, 10, 0, Math.PI * 2);
    ctx.stroke();
    // boxes
    ctx.strokeRect(28, 3, 44, 16);
    ctx.strokeRect(39, 3, 22, 6.5);
    ctx.strokeRect(28, H - 19, 44, 16);
    ctx.strokeRect(39, H - 9.5, 22, 6.5);
    // goals
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(GOAL_MIN, 0.4, GOAL_MAX - GOAL_MIN, 2.4);
    ctx.fillRect(GOAL_MIN, H - 2.8, GOAL_MAX - GOAL_MIN, 2.4);

    // players
    for (const pl of this.players) {
      const teamInfo = pl.team === 0 ? this.userTeam : this.cpuTeam;
      const isGk = pl.info.group === "GK";
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(pl.x, pl.y + 1.6, 2.1, 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      // body — kit figure: jersey torso, shorts band, head on top
      ctx.fillStyle = isGk ? "#f59e0b" : teamInfo.color;
      ctx.strokeStyle = isGk ? "#111111" : teamInfo.color2;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, 2.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // shorts band across the lower body
      ctx.fillStyle = isGk ? "#111111" : teamInfo.color2;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y + 0.9, 1.7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.fill();
      // head — skin tone varies per player so the 22 on the pitch differ
      const SKINS = ["#ffdbac", "#f2c79b", "#e8b088", "#c68642", "#9c6642", "#6f4e2e"];
      ctx.fillStyle = SKINS[(pl.slot * 3 + pl.team * 2) % SKINS.length] ?? "#f2c79b";
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y - 0.5, 1.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // controlled ring
      if (pl === this.controlled && pl.team === 0) {
        ctx.strokeStyle = "#f5c518";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, 3.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#f5c518";
        ctx.beginPath();
        ctx.moveTo(pl.x, pl.y + 4.6);
        ctx.lineTo(pl.x - 1.1, pl.y + 6);
        ctx.lineTo(pl.x + 1.1, pl.y + 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ball
    const b = this.ball;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 0.9, 1.1, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}
