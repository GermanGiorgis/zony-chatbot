"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { guessLang, pickVoice, splitForSpeech, toSpeakable } from "@/lib/speech";
import { pulseSpeech } from "../robot/bus";

/* ------------------------------------------------------------------ speaking (text to speech) */

const hasSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

let speakingId: string | null = null;
const speakingListeners = new Set<() => void>();
function setSpeaking(id: string | null) {
  speakingId = id;
  speakingListeners.forEach((l) => l());
}

/** Which message (if any) is being read aloud right now. */
export function useSpeakingId() {
  return useSyncExternalStore(
    (cb) => {
      speakingListeners.add(cb);
      return () => {
        speakingListeners.delete(cb);
      };
    },
    () => speakingId,
    () => null,
  );
}

/** Voices load asynchronously in Chrome: ask again when the list changes. */
function voices() {
  return window.speechSynthesis.getVoices();
}

export function stopSpeaking() {
  if (!hasSynthesis()) return;
  window.speechSynthesis.cancel();
  setSpeaking(null);
}

/**
 * Reads a Markdown answer aloud in sentence-sized pieces (browsers cut off long utterances), with a Spanish or English
 * voice depending on the text. The robot's mouth is pulsed on every word the engine reports, so it follows the voice.
 */
export function speak(id: string, markdown: string) {
  if (!hasSynthesis()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const text = toSpeakable(markdown);
  const chunks = splitForSpeech(text);
  if (!chunks.length) {
    setSpeaking(null);
    return;
  }
  const lang = guessLang(text);
  const voice = pickVoice(voices(), lang);
  setSpeaking(id);
  // Chrome ignores a speak() issued in the same tick as cancel(): give it a moment.
  setTimeout(() => {
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = voice?.lang ?? (lang === "es" ? "es-AR" : "en-US");
      if (voice) u.voice = voice;
      u.rate = 1.04;
      u.onboundary = () => pulseSpeech(0.55 + Math.random() * 0.45);
      u.onend = () => {
        if (i === chunks.length - 1 && speakingId === id) setSpeaking(null);
      };
      u.onerror = (e) => {
        // "canceled"/"interrupted" is just the next message replacing this one.
        if (e.error !== "canceled" && e.error !== "interrupted" && speakingId === id) setSpeaking(null);
      };
      synth.speak(u);
    });
  }, 60);
}

export const speechSupported = () => hasSynthesis();

/* ------------------------------------------------------------------ preference: read answers aloud */

const PREF_KEY = "zony-voice-replies";
const prefListeners = new Set<() => void>();
let pref: boolean | null = null;

function readPref() {
  if (pref === null) {
    try {
      pref = localStorage.getItem(PREF_KEY) === "1";
    } catch {
      pref = false;
    }
  }
  return pref;
}

export function setVoiceReplies(on: boolean) {
  pref = on;
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {}
  prefListeners.forEach((l) => l());
  if (!on) stopSpeaking();
}

/** "Read answers aloud" switch, remembered between visits. Off on the server so hydration matches. */
export function useVoiceReplies() {
  return useSyncExternalStore(
    (cb) => {
      prefListeners.add(cb);
      return () => {
        prefListeners.delete(cb);
      };
    },
    readPref,
    () => false,
  );
}

/** True where the browser can speak at all (false on the server and where there is no speech engine). */
export function useSpeechSupported() {
  return useSyncExternalStore(
    () => () => {},
    hasSynthesis,
    () => false,
  );
}

/* ------------------------------------------------------------------ listening (speech to text) */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  "not-allowed": "Permití el micrófono en el navegador para poder dictar.",
  "service-not-allowed": "Este navegador no permite el dictado en esta página.",
  "audio-capture": "No encontré un micrófono.",
  network: "El dictado necesita conexión a internet.",
};

/**
 * Dictation with the browser's own speech recognition (Chrome and Edge send the audio to their servers; Firefox has none,
 * and there the button simply does not appear). Interim words flow into `onText` as they are heard; when the person stops
 * talking, `onFinal` gets the whole sentence.
 */
export function useDictation({ onText, onFinal, onError }: { onText: (text: string) => void; onFinal: (text: string) => void; onError: (message: string) => void }) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => recognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const handlers = useRef({ onText, onFinal, onError });
  useEffect(() => {
    handlers.current = { onText, onFinal, onError };
  });

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    stopSpeaking(); // it must not hear the robot's own voice
    const r = new Ctor();
    r.lang = "es-AR";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let heard = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      heard = text.trim();
      handlers.current.onText(heard);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      handlers.current.onError(ERRORS[e.error] ?? "No pude escucharte. Probá de nuevo.");
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      if (heard) handlers.current.onFinal(heard);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, start, stop };
}
