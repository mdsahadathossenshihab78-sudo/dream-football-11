// Sound engine for Dream Football 11 — every effect is synthesized with
// WebAudio (no audio files): button clicks, kick-off and full-time
// whistles, goal celebration, coin chime, ball kicks, and a low looping
// stadium-pad background track. Audio starts on the first user tap
// (browser autoplay rules) and a mute choice is kept in localStorage.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let chordStep = 0;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem("df-muted") === "1";
  } catch {
    return false;
  }
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.14;
      musicGain.connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  dur: number,
  opts: {
    type?: OscillatorType;
    gain?: number;
    at?: number;
    slideTo?: number;
    dest?: AudioNode;
  } = {},
) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + dur);
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(opts.dest ?? master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur: number, opts: { gain?: number; at?: number; from?: number; to?: number } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(opts.from ?? 500, t0);
  bp.frequency.exponentialRampToValueAtTime(opts.to ?? 1600, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(t0);
}

function whistle(dur: number, at = 0) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  const vib = c.createOscillator();
  const vibGain = c.createGain();
  osc.type = "square";
  osc.frequency.value = 2350;
  vib.frequency.value = 28;
  vibGain.gain.value = 130;
  vib.connect(vibGain);
  vibGain.connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.03);
  g.gain.setValueAtTime(0.055, t0 + Math.max(0.03, dur - 0.05));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  vib.start(t0);
  osc.stop(t0 + dur + 0.05);
  vib.stop(t0 + dur + 0.05);
}

// Background track: slow synth pads cycling Am – F – C – G with a soft
// bass pulse, quiet enough to sit under the game.
const CHORDS: number[][] = [
  [110.0, 220.0, 261.63, 329.63], // Am
  [87.31, 174.61, 220.0, 261.63], // F
  [98.0, 196.0, 246.94, 329.63], // G
  [130.81, 196.0, 261.63, 392.0], // C
];

function playChord() {
  const c = ac();
  if (!c || !musicGain) return;
  const chord = CHORDS[chordStep % CHORDS.length];
  if (!chord) return;
  chordStep += 1;
  const t0 = c.currentTime;
  chord.forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = f;
    const peak = i === 0 ? 0.16 : 0.05;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.7);
    g.gain.setValueAtTime(peak, t0 + 3.1);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 4.1);
    osc.connect(g);
    g.connect(musicGain!);
    osc.start(t0);
    osc.stop(t0 + 4.2);
  });
}

export const sound = {
  /** Call from any user tap: unlocks audio and starts the background track. */
  unlock() {
    if (!ac()) return;
    if (musicTimer == null) {
      playChord();
      musicTimer = window.setInterval(playChord, 4000);
    }
  },
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try {
      window.localStorage.setItem("df-muted", m ? "1" : "0");
    } catch {
      // storage unavailable — mute lasts for this session only
    }
    if (master && ctx) {
      master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
    }
    if (!m) this.unlock();
  },
  click() {
    tone(660, 0.06, { type: "triangle", gain: 0.1, slideTo: 440 });
  },
  kick() {
    tone(130, 0.13, { type: "sine", gain: 0.28, slideTo: 42 });
  },
  kickoff() {
    whistle(0.55);
    noiseBurst(0.5, { gain: 0.05, from: 400, to: 900 });
  },
  goal(mine: boolean) {
    if (mine) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, 0.34, { type: "triangle", gain: 0.16, at: i * 0.09 }),
      );
      noiseBurst(1.4, { gain: 0.14, from: 500, to: 2400 });
      whistle(0.3, 0.15);
    } else {
      [392.0, 329.63, 261.63].forEach((f, i) =>
        tone(f, 0.3, { type: "triangle", gain: 0.12, at: i * 0.11 }),
      );
      noiseBurst(0.7, { gain: 0.06, from: 900, to: 400 });
    }
  },
  fulltime() {
    whistle(0.28);
    whistle(0.28, 0.38);
    whistle(0.7, 0.76);
  },
  buy() {
    tone(987.77, 0.1, { type: "sine", gain: 0.14 });
    tone(1318.5, 0.22, { type: "sine", gain: 0.14, at: 0.08 });
  },
  error() {
    tone(196, 0.16, { type: "sawtooth", gain: 0.06, slideTo: 147 });
  },
};
