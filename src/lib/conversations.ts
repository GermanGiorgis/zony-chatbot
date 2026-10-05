import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";

/** Saved conversations live in this browser only (localStorage): there are no accounts. */
export type Conversation = {
  id: string;
  title: string;
  messages: UIMessage[];
  updatedAt: number;
  /** The visitor renamed it, so new messages must not overwrite the title. */
  custom: boolean;
};

const LIST_KEY = "zony-conversations-v1";
const ACTIVE_KEY = "zony-active-conversation";
const MAX_CONVERSATIONS = 60;
const MAX_TITLE = 60;

const listeners = new Set<() => void>();
let state: Conversation[] | null = null;
const emit = () => listeners.forEach((l) => l());

/** Set when the browser could not keep everything (storage full or blocked); shown once under the composer. */
let storageNotice: string | null = null;
const noticeListeners = new Set<() => void>();
function setStorageNotice(next: string | null) {
  if (storageNotice === next) return;
  storageNotice = next;
  noticeListeners.forEach((l) => l());
}

// Another tab saved something: forget the cached list so this tab neither shows stale data nor overwrites the other's changes.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== LIST_KEY && e.key !== null) return;
    state = null;
    emit();
  });
}

function isConversation(c: unknown): c is Conversation {
  const x = c as Partial<Conversation> | null;
  return !!x && typeof x.id === "string" && typeof x.title === "string" && Array.isArray(x.messages) && typeof x.updatedAt === "number";
}

function read(): Conversation[] {
  if (state) return state;
  try {
    const raw = localStorage.getItem(LIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    state = Array.isArray(parsed) ? parsed.filter(isConversation).map((c) => ({ ...c, custom: !!c.custom })) : [];
  } catch {
    state = [];
  }
  return state;
}

/** Reads what is really in storage right now (another tab may have written since this tab last looked). */
function readFresh(): Conversation[] {
  state = null;
  return read();
}

function write(next: Conversation[]) {
  const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
  state = sorted;
  emit();
  // If the browser's quota is full, drop the oldest conversations until it fits instead of losing the newest one.
  for (let keep = sorted.length; keep > 0; keep = Math.floor(keep * 0.7)) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(sorted.slice(0, keep)));
      setStorageNotice(keep < sorted.length ? "El navegador se quedó sin espacio: se borraron las conversaciones más viejas." : null);
      return;
    } catch {}
  }
  if (sorted.length) setStorageNotice("No pude guardar la conversación en este navegador (¿modo privado o sin espacio?). Se pierde al recargar.");
}

/** Attachments carry their whole file as a data URL: too heavy to keep, so history stores a note instead. */
function lightweight(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.map((p) => (p.type === "file" ? { type: "text" as const, text: `📎 ${p.filename ?? "archivo adjunto"}` } : p)),
  }));
}

function titleFrom(messages: UIMessage[]) {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "Conversación nueva";
  return text.length > 48 ? `${text.slice(0, 47).trimEnd()}…` : text;
}

export const newConversationId = () => crypto.randomUUID();

export function saveConversation(id: string, messages: UIMessage[]) {
  // An answer that had not produced a word yet is not worth keeping (it would restore as an empty bubble).
  const tail = messages.at(-1);
  if (tail?.role === "assistant" && !tail.parts.some((p) => p.type === "text" && p.text)) messages = messages.slice(0, -1);
  if (!messages.length) return;
  const list = readFresh();
  const existing = list.find((c) => c.id === id);
  const next: Conversation = {
    id,
    title: existing?.custom ? existing.title : titleFrom(messages),
    custom: existing?.custom ?? false,
    messages: lightweight(messages),
    updatedAt: Date.now(),
  };
  write([next, ...list.filter((c) => c.id !== id)]);
}

export function renameConversation(id: string, title: string) {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
  if (!clean) return;
  write(readFresh().map((c) => (c.id === id ? { ...c, title: clean, custom: true } : c)));
}

export function deleteConversation(id: string) {
  write(readFresh().filter((c) => c.id !== id));
}

export function clearConversations() {
  write([]);
}

export const getConversation = (id: string) => read().find((c) => c.id === id);

export function getActiveConversationId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveConversationId(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
}

let initialId: string | null = null;
function getInitialId() {
  if (initialId === null) {
    const saved = getActiveConversationId();
    initialId = saved && getConversation(saved) ? saved : newConversationId();
  }
  return initialId;
}

/** The conversation to open on page load: the last active one, or a fresh id. Empty during SSR and hydration. */
export function useInitialConversationId() {
  return useSyncExternalStore(
    () => () => {},
    getInitialId,
    () => "",
  );
}

const EMPTY: Conversation[] = [];

/** A warning about saving (or null), for the composer's footer. */
export function useStorageNotice() {
  return useSyncExternalStore(
    (cb) => {
      noticeListeners.add(cb);
      return () => {
        noticeListeners.delete(cb);
      };
    },
    () => storageNotice,
    () => null,
  );
}

export function useConversations() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    read,
    () => EMPTY,
  );
}
