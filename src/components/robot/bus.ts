import type { Focus } from "./catalog";
import type { GestureName } from "./rig";

const listeners = new Set<(g: GestureName) => void>();

/** Gestures played so far; only exposed in development (window.__zony.log) so tests can check the robot reacted. */
const played: GestureName[] = [];

export function robotGesture(g: GestureName) {
  if (process.env.NODE_ENV === "development") played.push(g);
  listeners.forEach((l) => l(g));
}

export function onRobotGesture(l: (g: GestureName) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

let attention: (() => DOMRect | null) | null = null;

export function setRobotAttention(fn: (() => DOMRect | null) | null) {
  attention = fn;
}

export function getRobotAttention() {
  return attention?.() ?? null;
}

/** Camera framing requested by the customizer (null = default framing). Read every frame by the camera rig. */
export const camera: { focus: Focus | null } = { focus: null };

export function setCameraFocus(focus: Focus | null) {
  camera.focus = focus;
}

/**
 * How open the mouth should be because of the voice: every word the speech engine reports pulses it (see chat/voice.ts),
 * and the rig lets it decay, so the jaw follows the speech instead of just flapping on a timer.
 */
export const speech = { level: 0 };

export function pulseSpeech(strength = 1) {
  speech.level = Math.max(speech.level, Math.min(1, strength));
}

export const pointer = { x: 0, y: 0, t: -Infinity };

if (typeof window !== "undefined") {
  if (process.env.NODE_ENV === "development") {
    (window as unknown as { __zony: unknown }).__zony = { gesture: robotGesture, focus: setCameraFocus, log: played, speech, pulse: pulseSpeech };
  }
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.t = performance.now();
    },
    { passive: true },
  );
}
