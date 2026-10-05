import { useSyncExternalStore } from "react";
import { cleanName } from "@/lib/name";
import {
  DEFAULT_APPEARANCE,
  FINISHES,
  MOTIONS,
  PART_LISTS,
  type Appearance,
  type MotionPref,
} from "./catalog";

export type { Appearance, Finish, MotionPref } from "./catalog";
export { DEFAULT_APPEARANCE } from "./catalog";

const KEY = "zony-appearance-v2";
const HEX = /^#[0-9a-f]{6}$/i;

function sanitize(raw: unknown): Appearance {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_APPEARANCE;
  const pick = <K extends keyof Appearance>(key: K, valid: readonly unknown[]) =>
    (valid.includes(r[key]) ? r[key] : d[key]) as Appearance[K];
  const ids = (list: readonly { id: string }[]) => list.map((o) => o.id);
  const color = (key: "shell" | "muscle" | "metal" | "glow") =>
    typeof r[key] === "string" && HEX.test(r[key] as string) ? (r[key] as string) : d[key];
  return {
    head: pick("head", ids(PART_LISTS.head)),
    torso: pick("torso", ids(PART_LISTS.torso)),
    arms: pick("arms", ids(PART_LISTS.arms)),
    legs: pick("legs", ids(PART_LISTS.legs)),
    outfit: pick("outfit", ids(PART_LISTS.outfit)),
    hat: pick("hat", ids(PART_LISTS.hat)),
    glasses: pick("glasses", ids(PART_LISTS.glasses)),
    background: pick("background", ids(PART_LISTS.background)),
    shell: color("shell"),
    muscle: color("muscle"),
    metal: color("metal"),
    glow: color("glow"),
    finish: pick("finish", ids(FINISHES)),
    motion: pick("motion", ids(MOTIONS)),
    name: cleanName(r.name),
  };
}

function store<T>(initial: () => T) {
  let value: T | undefined;
  const subs = new Set<() => void>();
  return {
    get: () => (value ??= initial()),
    set(next: T) {
      value = next;
      subs.forEach((f) => f());
    },
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

const saved = store<Appearance>(() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
});

/** A temporary look shown while hovering an option in the customizer. */
const preview = store<Partial<Appearance> | null>(() => null);

export function updateAppearance(patch: Partial<Appearance>) {
  const next = sanitize({ ...saved.get(), ...patch });
  saved.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function previewAppearance(patch: Partial<Appearance> | null) {
  preview.set(patch);
}

/** The name the visitor gave the robot, for code outside React (the chat transport reads it on every send). */
export function getRobotName() {
  return saved.get().name;
}

/** True when nothing but the motion preference and the name differ from the out-of-the-box robot (the one the poster frame shows, scenery included). */
export function isDefaultLook(a: Appearance) {
  return (Object.keys(DEFAULT_APPEARANCE) as (keyof Appearance)[]).every(
    (k) => k === "motion" || k === "name" || a[k] === DEFAULT_APPEARANCE[k],
  );
}

export function useAppearance() {
  return useSyncExternalStore(saved.subscribe, saved.get, () => DEFAULT_APPEARANCE);
}

let renderedCache: { base: Appearance; patch: Partial<Appearance> | null; value: Appearance } | null = null;
function rendered() {
  const base = saved.get();
  const patch = preview.get();
  if (renderedCache?.base !== base || renderedCache.patch !== patch) {
    renderedCache = { base, patch, value: patch ? { ...base, ...patch } : base };
  }
  return renderedCache.value;
}
const subscribeBoth = (cb: () => void) => {
  const a = saved.subscribe(cb);
  const b = preview.subscribe(cb);
  return () => {
    a();
    b();
  };
};

/** What the 3D robot should show: the saved look plus any hover preview. */
export function useRenderedAppearance() {
  return useSyncExternalStore(subscribeBoth, rendered, () => DEFAULT_APPEARANCE);
}

function mediaStore(query: string) {
  return {
    subscribe(cb: () => void) {
      const mq = matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    get: () => matchMedia(query).matches,
  };
}

const reducedStore = mediaStore("(prefers-reduced-motion: reduce)");
const darkStore = mediaStore("(prefers-color-scheme: dark)");

export function useReducedMotionPref(pref: MotionPref) {
  const system = useSyncExternalStore(reducedStore.subscribe, reducedStore.get, () => false);
  return pref === "reduced" || (pref === "system" && system);
}

export function useDarkMode() {
  return useSyncExternalStore(darkStore.subscribe, darkStore.get, () => false);
}
