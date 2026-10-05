import { speech } from "./bus";

type Side = "L" | "R";
type Axis = "rx" | "ry" | "rz" | "px" | "py" | "curl";
type CenterJoint = "hips" | "spine" | "chest" | "neck" | "head" | "eyes";
type SidedJoint =
  | "clav"
  | "arm"
  | "elbow"
  | "wrist"
  | "finger"
  | "index"
  | "thumb"
  | "thigh"
  | "knee"
  | "ankle";

export type Ch =
  | `${CenterJoint}.${Axis}`
  | `${SidedJoint}${Side}.${Axis}`
  | "blink"
  | "jaw"
  | "glow"
  | "alert";

export type Pose = Partial<Record<Ch, number>>;
export type Mood = "idle" | "thinking" | "waiting" | "talking" | "error";
export type GestureName =
  | "wave"
  | "hold"
  | "present"
  | "nod"
  | "shrug"
  | "admire"
  | "flex"
  | "flinch"
  | "cheer"
  | "droop";

const sided = (joint: SidedJoint, axes: Axis[]): Ch[] =>
  (["L", "R"] as const).flatMap((s) =>
    axes.map((a) => `${joint}${s}.${a}` as Ch),
  );

export const CHANNELS: Ch[] = [
  "hips.px",
  "hips.py",
  "hips.ry",
  "hips.rz",
  "spine.rx",
  "spine.ry",
  "spine.rz",
  "chest.rx",
  "chest.ry",
  "chest.rz",
  "neck.rx",
  "neck.ry",
  "neck.rz",
  "head.rx",
  "head.ry",
  "head.rz",
  "eyes.rx",
  "eyes.ry",
  "blink",
  "jaw",
  "glow",
  "alert",
  ...sided("clav", ["rz"]),
  ...sided("arm", ["rx", "ry", "rz"]),
  ...sided("elbow", ["rx"]),
  ...sided("wrist", ["rx", "ry", "rz"]),
  ...sided("finger", ["curl"]),
  ...sided("index", ["curl"]),
  ...sided("thumb", ["curl"]),
  ...sided("thigh", ["rx", "rz"]),
  ...sided("knee", ["rx"]),
  ...sided("ankle", ["rx", "rz"]),
];

const INDEX = new Map(CHANNELS.map((c, i) => [c, i]));
export const chIndex = (c: Ch) => INDEX.get(c)!;

// Poses are authored for the robot's left side (+x). Mirroring across the
// sagittal plane keeps x-rotations and flips y/z rotations.
export function toR(p: Pose): Pose {
  const out: Pose = {};
  for (const [k, v] of Object.entries(p) as [Ch, number][]) {
    const m = /^(\w+)L\.(\w+)$/.exec(k);
    if (!m) continue;
    const flip = m[2] === "ry" || m[2] === "rz";
    out[`${m[1]}R.${m[2]}` as Ch] = flip ? -v : v;
  }
  return out;
}
const both = (p: Pose): Pose => ({ ...p, ...toR(p) });

const REST_L: Pose = {
  "clavL.rz": 0,
  "armL.rx": -0.06,
  "armL.ry": 0.1,
  "armL.rz": 0.13,
  "elbowL.rx": -0.24,
  "wristL.rx": 0.06,
  "wristL.ry": -1.5,
  "wristL.rz": 0,
  "fingerL.curl": 0.42,
  "indexL.curl": 0.32,
  "thumbL.curl": 0.28,
  "thighL.rx": 0,
  "thighL.rz": 0.035,
  "kneeL.rx": 0.03,
  "ankleL.rx": -0.03,
  "ankleL.rz": -0.035,
};

export const REST: Float32Array = (() => {
  const a = new Float32Array(CHANNELS.length);
  const p: Pose = { ...both(REST_L), glow: 1 };
  for (const [k, v] of Object.entries(p) as [Ch, number][]) a[chIndex(k)] = v;
  return a;
})();

type Spring = { w: number; z: number };
const SPRING: [RegExp, Spring][] = [
  [/^eyes/, { w: 38, z: 1 }],
  [/^(finger|index|thumb)/, { w: 15, z: 0.82 }],
  [/^jaw/, { w: 26, z: 0.9 }],
  [/^wrist/, { w: 11, z: 0.72 }],
  [/^elbow/, { w: 9, z: 0.7 }],
  [/^(arm|clav)/, { w: 7.5, z: 0.72 }],
  [/^head/, { w: 9.5, z: 0.82 }],
  [/^neck/, { w: 7.5, z: 0.85 }],
  [/^chest/, { w: 5.5, z: 0.88 }],
  [/^(spine|hips)/, { w: 4.2, z: 0.92 }],
  [/^(thigh|knee|ankle)/, { w: 5, z: 0.95 }],
  [/./, { w: 6, z: 1 }],
];
const springOf = (c: Ch) => SPRING.find(([re]) => re.test(c))![1];

type Key = { t: number; p?: Pose };
type GestureDef = {
  dur: number;
  fadeIn: number;
  fadeOut: number;
  look: number;
  base: Pose;
  keys: Key[];
};

const smooth = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const WAVE_ARM: Pose = {
  "clavL.rz": 0.1,
  "armL.rz": 1.3,
  "armL.rx": -0.25,
  "armL.ry": 1.4,
  "elbowL.rx": -1.5,
  "wristL.rx": 0,
  "wristL.ry": 0,
  "wristL.rz": 0,
  "fingerL.curl": 0.06,
  "indexL.curl": 0.04,
  "thumbL.curl": 0.1,
};

// "One moment": the wave pose with every finger curled except the index.
const HOLD_ARM: Pose = { ...WAVE_ARM, "fingerL.curl": 1.3, "indexL.curl": 0, "thumbL.curl": 0.85 };

export const GESTURES: Record<GestureName, GestureDef> = {
  hold: {
    dur: 1.9,
    fadeIn: 0.28,
    fadeOut: 0.6,
    look: 0.8,
    base: { ...toR(HOLD_ARM), "head.rz": -0.05, "chest.rz": 0.03 },
    keys: [
      { t: 0 },
      { t: 0.5, p: toR({ "wristL.rz": 0.16 }) },
      { t: 0.85, p: toR({ "wristL.rz": -0.16 }) },
      { t: 1.2, p: toR({ "wristL.rz": 0.1 }) },
    ],
  },
  wave: {
    dur: 2.4,
    fadeIn: 0.3,
    fadeOut: 0.55,
    look: 1,
    base: { ...WAVE_ARM, "chest.rz": -0.045, "head.rz": 0.06 },
    keys: [
      { t: 0 },
      { t: 0.5, p: { "elbowL.rx": -1.85, "wristL.rz": 0.18 } },
      { t: 0.8, p: { "elbowL.rx": -1.2, "wristL.rz": -0.18 } },
      { t: 1.1, p: { "elbowL.rx": -1.85, "wristL.rz": 0.18 } },
      { t: 1.4, p: { "elbowL.rx": -1.2, "wristL.rz": -0.18 } },
      { t: 1.75, p: { "elbowL.rx": -1.55, "wristL.rz": 0 } },
    ],
  },
  present: {
    dur: 1.8,
    fadeIn: 0.28,
    fadeOut: 0.55,
    look: 0.5,
    base: {
      "armL.rz": 0.72,
      "armL.rx": -0.78,
      "armL.ry": -0.3,
      "elbowL.rx": -0.55,
      "wristL.rx": -0.2,
      "wristL.ry": 0.3,
      "fingerL.curl": 0.12,
      "indexL.curl": 0.08,
      "thumbL.curl": 0.05,
      "chest.ry": 0.1,
      "head.ry": 0.12,
    },
    keys: [
      { t: 0, p: { "head.rx": 0 } },
      { t: 0.35, p: { "head.rx": 0.14 } },
      { t: 0.7, p: { "head.rx": 0 } },
    ],
  },
  nod: {
    dur: 0.95,
    fadeIn: 0.08,
    fadeOut: 0.2,
    look: 1,
    base: {},
    keys: [
      { t: 0, p: { "head.rx": 0, "neck.rx": 0 } },
      { t: 0.18, p: { "head.rx": 0.2, "neck.rx": 0.05 } },
      { t: 0.42, p: { "head.rx": -0.03, "neck.rx": 0 } },
      { t: 0.62, p: { "head.rx": 0.1 } },
      { t: 0.85, p: { "head.rx": 0 } },
    ],
  },
  shrug: {
    dur: 2,
    fadeIn: 0.22,
    fadeOut: 0.6,
    look: 0.6,
    base: {
      ...both({
        "clavL.rz": 0.28,
        "armL.rz": 0.3,
        "armL.rx": -0.12,
        "armL.ry": 0.55,
        "elbowL.rx": -1.4,
        "wristL.rx": -0.25,
        "wristL.ry": 0,
        "fingerL.curl": 0.1,
        "indexL.curl": 0.1,
        "thumbL.curl": 0.05,
      }),
      "head.rz": 0.16,
      "head.rx": -0.04,
      "chest.rx": -0.03,
    },
    keys: [
      { t: 0 },
      { t: 0.35, p: { "clavL.rz": 0.34, "clavR.rz": -0.34 } },
      { t: 0.9, p: { "clavL.rz": 0.26, "clavR.rz": -0.26 } },
    ],
  },
  admire: {
    dur: 2.3,
    fadeIn: 0.3,
    fadeOut: 0.55,
    look: 0,
    base: {
      ...toR({
        "armL.rx": -1.0,
        "armL.rz": 0.3,
        "armL.ry": -0.6,
        "elbowL.rx": -1.7,
        "wristL.rx": 0,
        "wristL.ry": -1.2,
        "fingerL.curl": 0.3,
        "indexL.curl": 0.25,
        "thumbL.curl": 0.2,
      }),
      "head.ry": -0.35,
      "head.rx": 0.22,
      "neck.ry": -0.1,
      "eyes.rx": 0.1,
      "eyes.ry": -0.05,
    },
    keys: [
      { t: 0 },
      { t: 0.65, p: toR({ "wristL.ry": -0.2 }) },
      { t: 1.15, p: toR({ "wristL.ry": -1.55 }) },
      { t: 1.65, p: toR({ "wristL.ry": -0.6 }) },
    ],
  },
  flex: {
    dur: 1.9,
    fadeIn: 0.3,
    fadeOut: 0.55,
    look: 1,
    base: {
      ...both({
        "clavL.rz": 0.08,
        "armL.rz": 1.45,
        "armL.rx": -0.12,
        "armL.ry": 1.45,
        "elbowL.rx": -1.95,
        "wristL.rx": -0.2,
        "wristL.ry": -0.8,
        "fingerL.curl": 1.35,
        "indexL.curl": 1.35,
        "thumbL.curl": 1.0,
      }),
      "chest.rx": -0.06,
      "head.rx": -0.08,
    },
    keys: [
      { t: 0 },
      { t: 0.55, p: both({ "elbowL.rx": -2.15 }) },
      { t: 0.85, p: both({ "elbowL.rx": -1.85 }) },
      { t: 1.15, p: both({ "elbowL.rx": -2.1 }) },
    ],
  },
  // Arms up and a little bounce: good news, a joke that landed, "¡lo lograste!".
  cheer: {
    dur: 2.1,
    fadeIn: 0.22,
    fadeOut: 0.55,
    look: 0.5,
    base: {
      ...both({
        "clavL.rz": 0.14,
        "armL.rz": 2.4,
        "armL.rx": -0.12,
        "armL.ry": 0.25,
        "elbowL.rx": -0.3,
        "wristL.rx": 0,
        "wristL.ry": 0,
        "fingerL.curl": 0.08,
        "indexL.curl": 0.06,
        "thumbL.curl": 0.1,
      }),
      "head.rx": -0.14,
      "chest.rx": -0.06,
    },
    keys: [
      { t: 0 },
      { t: 0.32, p: { "hips.py": 0.03, ...both({ "armL.rz": 2.55, "elbowL.rx": -0.15 }) } },
      { t: 0.62, p: { "hips.py": 0, ...both({ "armL.rz": 2.35, "elbowL.rx": -0.4 }) } },
      { t: 0.94, p: { "hips.py": 0.03, ...both({ "armL.rz": 2.55, "elbowL.rx": -0.15 }) } },
      { t: 1.26, p: { "hips.py": 0, ...both({ "armL.rz": 2.4, "elbowL.rx": -0.3 }) } },
    ],
  },
  // Head down, shoulders low, arms hanging: an apology or bad news.
  droop: {
    dur: 2.6,
    fadeIn: 0.55,
    fadeOut: 0.8,
    look: 0,
    base: {
      ...both({ "clavL.rz": -0.14, "armL.rx": 0.12, "armL.rz": 0.08, "elbowL.rx": -0.1 }),
      "head.rx": 0.5,
      "neck.rx": 0.16,
      "chest.rx": 0.14,
      "spine.rx": 0.07,
      "hips.py": -0.014,
    },
    keys: [
      { t: 0 },
      { t: 1.1, p: { "head.rx": 0.58, "chest.rx": 0.16 } },
      { t: 1.8, p: { "head.rx": 0.52, "chest.rx": 0.14 } },
    ],
  },
  flinch: {
    dur: 0.95,
    fadeIn: 0.05,
    fadeOut: 0.4,
    look: 0.7,
    base: {
      ...both({
        "armL.rz": 0.35,
        "armL.rx": -0.25,
        "elbowL.rx": -0.7,
        "fingerL.curl": 0.05,
        "indexL.curl": 0.05,
        "thumbL.curl": 0,
      }),
      "chest.rx": -0.09,
      "spine.rx": -0.04,
      "head.rx": -0.12,
      "hips.py": -0.015,
    },
    keys: [
      { t: 0 },
      { t: 0.12 },
      { t: 0.5, p: { "chest.rx": -0.03, "head.rx": -0.02 } },
    ],
  },
};

type Compiled = {
  def: GestureDef;
  chans: number[];
  vals: Float32Array[];
  times: number[];
};

function compile(def: GestureDef): Compiled {
  const set = new Set<Ch>(Object.keys(def.base) as Ch[]);
  def.keys.forEach((k) => Object.keys(k.p ?? {}).forEach((c) => set.add(c as Ch)));
  const chans = [...set].map(chIndex);
  let prev: Pose = { ...def.base };
  const vals = def.keys.map((k) => {
    prev = { ...prev, ...k.p };
    return Float32Array.from(
      [...set].map((c) => prev[c] ?? REST[chIndex(c)]),
    );
  });
  return { def, chans, vals, times: def.keys.map((k) => k.t) };
}

const COMPILED = Object.fromEntries(
  Object.entries(GESTURES).map(([n, d]) => [n, compile(d)]),
) as Record<GestureName, Compiled>;

const wave = (t: number, f: number, ph = 0) => Math.sin(t * f + ph);

function moodPose(mood: Mood, t: number): { pose: Pose; look: number } {
  switch (mood) {
    case "waiting": {
      // Still the thinker, but restless: shoulders rise and fall in a sigh, the head sways and the finger taps faster.
      const sigh = Math.max(0, wave(t, 1.5));
      return {
        look: 0.3,
        pose: {
          ...moodPose("thinking", t).pose,
          "indexR.curl": 0.4 + 0.22 * Math.max(0, wave(t, 11)),
          "head.ry": 0.22 * wave(t, 1.1),
          "head.rx": -0.06 + 0.1 * sigh,
          "clavL.rz": 0.09 * sigh,
          "clavR.rz": -0.09 * sigh,
          "eyes.ry": 0.3 * wave(t, 1.4),
          glow: 1.15 + 0.35 * wave(t, 8),
        },
      };
    }
    case "thinking": {
      // The index finger taps the chin in short bursts instead of non-stop.
      const tap = Math.max(0, wave(t, 13)) * Math.min(1, Math.max(0, wave(t, 1.3) - 0.1) * 2.5);
      return {
        look: 0.25,
        pose: {
          ...toR({
            "armL.rx": -0.62,
            "armL.rz": 0.1,
            "armL.ry": -0.45,
            "elbowL.rx": -2.3,
            "wristL.rx": 0.15 + 0.05 * wave(t, 3),
            "wristL.ry": -0.9,
            "fingerL.curl": 0.95,
            "indexL.curl": 0.45 + 0.2 * tap,
            "thumbL.curl": 0.5,
          }),
          "armL.rx": -0.42,
          "armL.rz": 0.06,
          "armL.ry": -1.0,
          "elbowL.rx": -1.45,
          "wristL.ry": -1.4,
          "wristL.rx": 0,
          "fingerL.curl": 0.6,
          "indexL.curl": 0.5,
          "thumbL.curl": 0.3,
          "head.rz": 0.09,
          "head.rx": -0.06,
          "head.ry": 0.07 * wave(t, 0.5),
          "eyes.rx": -0.22,
          "eyes.ry": -0.18 + 0.1 * wave(t, 0.7),
          glow: 1.25 + 0.45 * wave(t, 5),
        },
      };
    }
    case "talking": {
      const b1 = 0.5 + 0.5 * wave(t, 4.1, Math.sin(t * 1.3) * 1.5);
      const b2 = 0.5 + 0.5 * wave(t, 3.3, 1.7 + Math.sin(t * 0.9));
      const arm = (b: number, c: number): Pose => ({
        "armL.rx": -0.35 - 0.08 * b,
        "armL.rz": 0.2,
        "armL.ry": -0.4,
        "elbowL.rx": -1.25 - 0.25 * b,
        "wristL.rx": -0.1,
        "wristL.ry": -0.6 + 0.3 * c,
        "fingerL.curl": 0.25 + 0.1 * c,
        "indexL.curl": 0.18,
        "thumbL.curl": 0.15,
      });
      return {
        look: 0.85,
        pose: {
          ...arm(b1, b2),
          ...toR(arm(b2, b1)),
          "head.rx": 0.03 * wave(t, 2.7),
          jaw: 0.2 + 0.8 * Math.abs(wave(t, 9) * wave(t, 3.3, 1)),
          glow: 1.15 + 0.15 * wave(t, 7),
        },
      };
    }
    case "error":
      return { look: 1, pose: { alert: 1, "head.rx": 0.04 } };
    default:
      return { look: 1, pose: {} };
  }
}

function idle(target: Float32Array, t: number, amp: number) {
  const add = (c: Ch, v: number) => (target[chIndex(c)] += v * amp);
  const breath = wave(t, (2 * Math.PI) / 4.2);
  add("chest.rx", -0.012 * breath);
  add("clavL.rz", 0.015 * breath);
  add("clavR.rz", -0.015 * breath);

  const shift = wave(t, (2 * Math.PI) / 9);
  const hipsPx = 0.012 * shift;
  const hipsRz = -0.018 * shift;
  add("hips.px", hipsPx);
  add("hips.rz", hipsRz);
  add("spine.rz", 0.02 * shift);
  add("chest.rz", 0.008 * wave(t, (2 * Math.PI) / 9, 0.8));
  const legComp = -(hipsPx / 0.88 + hipsRz);
  for (const s of ["L", "R"] as const) {
    add(`thigh${s}.rz`, legComp);
    add(`ankle${s}.rz`, -(legComp + hipsRz));
  }
  add("kneeL.rx", 0.04 * Math.max(0, shift));
  add("kneeR.rx", 0.04 * Math.max(0, -shift));

  add("head.rx", 0.02 * (wave(t, 0.61) + 0.5 * wave(t, 1.37, 2)));
  add("head.ry", 0.03 * (wave(t, 0.43, 1) + 0.4 * wave(t, 1.13)));
  add("head.rz", 0.015 * wave(t, 0.51, 3));
  add("armL.rx", 0.02 * wave(t, 0.9, 1));
  add("armR.rx", 0.02 * wave(t, 0.85, 2.1));
  add("fingerL.curl", 0.04 * wave(t, 0.5));
  add("fingerR.curl", 0.04 * wave(t, 0.47, 1.3));
}

const I = {
  eyesRx: chIndex("eyes.rx"),
  eyesRy: chIndex("eyes.ry"),
  blink: chIndex("blink"),
  yaw: (["hips.ry", "spine.ry", "chest.ry", "neck.ry", "head.ry"] as Ch[]).map(chIndex),
  pitch: (["spine.rx", "chest.rx", "neck.rx", "head.rx"] as Ch[]).map(chIndex),
};
const LOOK_YAW: [Ch, number][] = [
  ["spine.ry", 0.1],
  ["chest.ry", 0.2],
  ["neck.ry", 0.3],
  ["head.ry", 0.4],
];
const LOOK_PITCH: [Ch, number][] = [
  ["chest.rx", 0.1],
  ["neck.rx", 0.35],
  ["head.rx", 0.55],
];
const SPRINGS = CHANNELS.map(springOf);
const MOODS: Mood[] = ["thinking", "waiting", "talking", "error"];

export type LookInput = { yaw: number; pitch: number } | null;

export class RigBrain {
  x = Float32Array.from(REST);
  v = new Float32Array(CHANNELS.length);
  target = new Float32Array(CHANNELS.length);
  private t = 0;
  private moodW: Record<Mood, number> = { idle: 1, thinking: 0, waiting: 0, talking: 0, error: 0 };
  private active: { g: Compiled; t: number }[] = [];
  private nextBlink = 2;
  private blinkT = -1;

  play(name: GestureName) {
    this.active = this.active.filter((a) => a.g !== COMPILED[name]);
    this.active.push({ g: COMPILED[name], t: 0 });
  }

  step(dt: number, mood: Mood, look: LookInput, idleAmp: number) {
    this.t += dt;
    const t = this.t;
    const tg = this.target;
    tg.set(REST);
    idle(tg, t, idleAmp);

    let lookW = 1;
    const k = 1 - Math.exp(-dt * 5);
    for (const m of MOODS) {
      this.moodW[m] += ((m === mood ? 1 : 0) - this.moodW[m]) * k;
      const w = this.moodW[m];
      if (w < 0.002) continue;
      const { pose, look: lw } = moodPose(m, t);
      for (const [c, val] of Object.entries(pose) as [Ch, number][]) {
        const i = chIndex(c);
        tg[i] += (val - tg[i]) * w;
      }
      lookW *= 1 - w * (1 - lw);
    }

    this.active = this.active.filter((a) => (a.t += dt) < a.g.def.dur);
    for (const { g, t: gt } of this.active) {
      const { def, chans, vals, times } = g;
      const w =
        smooth(clamp01(gt / def.fadeIn)) *
        (1 - smooth(clamp01((gt - (def.dur - def.fadeOut)) / def.fadeOut)));
      let j = 0;
      while (j < times.length - 1 && gt >= times[j + 1]) j++;
      const a = vals[j];
      const b = vals[Math.min(j + 1, vals.length - 1)];
      const span = (times[j + 1] ?? times[j]) - times[j];
      const f = span > 0 ? smooth(clamp01((gt - times[j]) / span)) : 0;
      for (let n = 0; n < chans.length; n++) {
        const i = chans[n];
        const val = a[n] + (b[n] - a[n]) * f;
        tg[i] += (val - tg[i]) * w;
      }
      lookW *= 1 - w * (1 - def.look);
    }

    if (look) {
      for (const [c, f] of LOOK_YAW) tg[chIndex(c)] += look.yaw * f * lookW;
      for (const [c, f] of LOOK_PITCH) tg[chIndex(c)] += look.pitch * f * lookW;
      const yawNow = I.yaw.reduce((s, i) => s + this.x[i], 0);
      const pitchNow = I.pitch.reduce((s, i) => s + this.x[i], 0);
      tg[I.eyesRy] += Math.max(-0.42, Math.min(0.42, look.yaw - yawNow)) * lookW;
      tg[I.eyesRx] += Math.max(-0.3, Math.min(0.3, look.pitch - pitchNow)) * lookW;
    }

    // The voice drives the mouth: each word opens it wide and it closes between them.
    if (speech.level > 0.01) {
      const jaw = chIndex("jaw");
      tg[jaw] = Math.max(tg[jaw], speech.level);
      speech.level *= Math.exp(-dt * 7);
    } else {
      speech.level = 0;
    }

    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < this.x.length; i++) {
        const { w, z } = SPRINGS[i];
        const acc = w * w * (tg[i] - this.x[i]) - 2 * z * w * this.v[i];
        this.v[i] += acc * h;
        this.x[i] += this.v[i] * h;
      }
    }

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0;
      this.nextBlink = 2 + Math.random() * 4.5;
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      blink = Math.sin(Math.min(1, this.blinkT / 0.15) * Math.PI);
      if (this.blinkT >= 0.15) this.blinkT = -1;
    }
    this.x[I.blink] = Math.max(blink, tg[I.blink]);
  }
}
