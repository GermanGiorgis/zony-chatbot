"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { fitPayload } from "@/lib/payload";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearConversations,
  deleteConversation,
  getConversation,
  newConversationId,
  saveConversation,
  setActiveConversationId,
  useInitialConversationId,
  useStorageNotice,
} from "@/lib/conversations";
import { firstSentence, reactionFor } from "@/lib/emotion";
import { toAttachments, type Attachment } from "./chat/attachments";
import { isToolPart } from "./chat/ToolChip";
import { Composer } from "./chat/Composer";
import { setVoiceReplies, speak, stopSpeaking, useDictation, useSpeakingId, useSpeechSupported, useVoiceReplies } from "./chat/voice";
import { HistoryPanel } from "./chat/History";
import { Message } from "./chat/Message";
import { StagePoster } from "./chat/StagePoster";
import { CreatorPanel, CustomizeButton } from "./Customizer";
import { getRobotName, isDefaultLook, useAppearance, useReducedMotionPref } from "./robot/appearance";
import { robotGesture, setRobotAttention } from "./robot/bus";
import type { Mood } from "./robot/rig";
import { StageBoundary, webglAvailable } from "./robot/StageBoundary";

// The robot's name travels with every message so the model introduces itself with it.
const transport = new DefaultChatTransport({
  api: "/api/chat",
  body: () => ({ name: getRobotName() }),
  prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({ body: { ...body, id, messages: fitPayload(messages), trigger, messageId } }),
});
const EASE = [0.23, 1, 0.32, 1] as const;

/** Seconds without a first word before the chat says so (and the robot gets restless), and before it warns about a busy service. */
const SLOW_AFTER = 8;
const VERY_SLOW_AFTER = 20;

const WAIT_NOTICE = [
  "Preparando la respuesta…",
  "Está tardando más de lo normal. Sigo intentando…",
  "El servicio de IA está muy ocupado ahora. Podés esperar o detener y reintentar.",
];

const RobotStage = dynamic(() => import("./robot/RobotStage"), { ssr: false });

const plain = (m: { parts: { type: string; text?: string }[] } | undefined) =>
  m ? m.parts.map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("") : "";

const STATUS_LABEL: Record<Mood, string> = {
  idle: "En línea",
  thinking: "Pensando…",
  waiting: "Un momento…",
  talking: "Respondiendo…",
  error: "Algo falló",
};

/** Our API answers with human-readable Spanish; anything else (network, SDK internals) gets a generic line. */
function errorText(error: Error) {
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "No me pude conectar con el servidor. Revisá tu conexión y probá de nuevo.";
  }
  const msg = error.message.trim();
  return msg && msg.length < 300 && !msg.startsWith("{") && /[áéíóúñ¿]|asistente|clave|límite|archivo/i.test(msg)
    ? msg
    : "Algo salió mal al responder. Probá de nuevo.";
}

export function Chat() {
  // Each conversation is its own chat instance (keyed by id), so the messages on screen always belong to the active one.
  // The first id comes from this browser's storage, so it is empty during SSR/hydration (keeping the first render identical to the server's).
  const initialId = useInitialConversationId();
  const [chosenId, setActiveId] = useState<string | null>(null);
  const activeId = chosenId ?? initialId;
  const [historyOpen, setHistoryOpen] = useState(false);
  const restored = useMemo(() => (activeId ? getConversation(activeId)?.messages : undefined), [activeId]);
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    transport,
    id: activeId || undefined,
    messages: restored,
  });
  const appearance = useAppearance();
  const reduced = useReducedMotionPref(appearance.motion);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const storageNotice = useStorageNotice();
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stageMounted, setStageMounted] = useState(false);
  // No WebGL, or the GPU context was lost: the chat carries on with the still poster instead of the live robot.
  const [stageFailed, setStageFailed] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  const [creator, setCreator] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dragDepth = useRef(0);

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const lastAssistantEmpty =
    last?.role === "assistant" && !last.parts.some((p) => p.type === "text" && p.text);
  const showDots = status === "submitted" || (status === "streaming" && lastAssistantEmpty);

  // How long the first word is taking: 0 = normal, 1 = slow, 2 = the service is struggling.
  const [slow, setSlow] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (!showDots) return;
    const timers = [setTimeout(() => setSlow(1), SLOW_AFTER * 1000), setTimeout(() => setSlow(2), VERY_SLOW_AFTER * 1000)];
    return () => {
      timers.forEach(clearTimeout);
      setSlow(0);
    };
  }, [showDots]);
  const waitLevel = showDots ? slow : 0;

  const speakingId = useSpeakingId();
  const voiceReplies = useVoiceReplies();
  const speechOk = useSpeechSupported();
  const mood: Mood = error ? "error" : showDots ? (waitLevel ? "waiting" : "thinking") : status === "streaming" || speakingId ? "talking" : "idle";
  const empty = messages.length === 0;
  const name = appearance.name;
  // The poster frame shows the out-of-the-box Zony; a customised one would flash the wrong robot, so it gets a blank stage.
  const poster = isDefaultLook(appearance);

  useEffect(() => {
    const el = scrollRef.current;
    // Nothing to follow before the first message: scrolling here would open the empty state cut off.
    if (el && stickRef.current && !empty) el.scrollTo({ top: el.scrollHeight });
  }, [messages, showDots, error, empty]);

  // Dictation: the person talks, the interim words fill the box, and with "Voz" on the sentence is sent as soon as they stop.
  const dictation = useDictation({
    onText: setInput,
    onFinal: (text) => (voiceReplies ? send(text) : taRef.current?.focus()),
    onError: setNotice,
  });

  useEffect(() => {
    const typing = (focused && input.trim().length > 0) || dictation.listening;
    setRobotAttention(typing ? () => taRef.current?.getBoundingClientRect() ?? null : null);
  }, [focused, input, dictation.listening]);

  // With "Voz" on, an answer is read aloud as soon as it is complete (not when an old conversation is reopened).
  const wasBusy = useRef(false);
  useEffect(() => {
    const finished = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!finished || !voiceReplies || error || last?.role !== "assistant") return;
    const text = plain(last);
    if (text.trim()) speak(last.id, text);
  }, [busy, voiceReplies, error, last]);

  useEffect(() => {
    if (error) robotGesture("shrug");
  }, [error]);

  // The robot reacts to what the answer says as soon as its first sentence is written (greeting, good news, apology,
  // doubt…), once per answer, and only while it is being written, so reopening an old conversation stays quiet.
  const reactedTo = useRef<string | null>(null);
  // When a tool (calculator, clock, weather) brings its result back, the robot presents it, once per call.
  const presented = useRef(new Set<string>());
  useEffect(() => {
    if (status !== "streaming" || last?.role !== "assistant") return;
    for (const p of last.parts) {
      if (isToolPart(p) && p.state === "output-available" && !presented.current.has(p.toolCallId)) {
        presented.current.add(p.toolCallId);
        robotGesture("present");
      }
    }
  }, [status, last]);
  useEffect(() => {
    if (status !== "streaming" || last?.role !== "assistant" || reactedTo.current === last.id) return;
    const sentence = firstSentence(plain(last));
    if (!sentence) return;
    reactedTo.current = last.id;
    const gesture = reactionFor(sentence);
    if (gesture) robotGesture(gesture);
  }, [status, last]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    const mount = () => (webglAvailable() ? setStageMounted(true) : setStageFailed(true));
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(mount, { timeout: 700 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(mount, 300);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!stageReady) return;
    const id = setTimeout(() => robotGesture("wave"), 500);
    return () => clearTimeout(id);
  }, [stageReady]);

  const closeCreator = useCallback(() => setCreator(false), []);

  useEffect(() => {
    if (!activeId || !messages.length) return;
    // A streaming answer is saved once it is complete; the visitor's own message is saved right away.
    if (busy && last?.role === "assistant") return;
    const stored = getConversation(activeId);
    // Same last message id is not enough: "another answer" can reuse it with different text.
    if (stored && stored.messages.length === messages.length && stored.messages.at(-1)?.id === last?.id && plain(stored.messages.at(-1)) === plain(last)) return;
    saveConversation(activeId, messages);
    setActiveConversationId(activeId);
  }, [activeId, messages, busy, last]);

  // Leaving mid-answer (another conversation, a new one, closing the tab) keeps the words that had already arrived.
  const latest = useRef({ activeId, messages });
  useEffect(() => {
    latest.current = { activeId, messages };
  });
  const flush = useCallback(() => {
    const { activeId: id, messages: current } = latest.current;
    if (id && current.length) saveConversation(id, current);
  }, []);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [flush]);

  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  function resetChat(keepCurrent = true) {
    if (keepCurrent) flush();
    stop();
    stopSpeaking();
    const id = newConversationId();
    setActiveId(id);
    setActiveConversationId(id);
    setInput("");
    setAttachments([]);
    robotGesture("wave");
  }

  /** "Otra respuesta": asks the same question again; the robot gets ready like for a new message. */
  function regenerateAnswer() {
    stickRef.current = true;
    robotGesture("hold");
    regenerate();
  }

  function startConversation() {
    resetChat();
    setHistoryOpen(false);
  }

  function openConversation(id: string) {
    if (id !== activeId) {
      flush();
      stop();
      stopSpeaking();
      setActiveId(id);
      setActiveConversationId(id);
      setInput("");
      setAttachments([]);
      robotGesture("nod");
    }
    setHistoryOpen(false);
  }

  function removeConversation(id: string) {
    deleteConversation(id);
    if (id === activeId) resetChat(false);
  }

  function removeAllConversations() {
    clearConversations();
    resetChat(false);
  }

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setPreparing(true);
    const { added, errors } = await toAttachments(files, attachments);
    setPreparing(false);
    if (added.length) {
      setAttachments((prev) => [...prev, ...added]);
      robotGesture("admire");
    }
    setNotice(errors[0] ?? null);
    taRef.current?.focus();
  }

  function send(text: string) {
    const value = text.trim();
    if ((!value && !attachments.length) || busy || preparing) return;
    stickRef.current = true;
    stopSpeaking();
    robotGesture(reactionFor(value) === "wave" ? "wave" : "nod");
    robotGesture("hold"); // "one moment": the robot starts preparing the answer
    const files = attachments.map((a) => a.part);
    if (value) sendMessage({ text: value, files });
    else sendMessage({ files });
    setInput("");
    setAttachments([]);
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-dvh overflow-hidden bg-paper">
        {/* Full-bleed robot, behind everything else. */}
        {/* While customizing, the robot gets the space the panel leaves free (above it on a phone, beside it on desktop). */}
        <div
          className={`absolute transition-[bottom,right] duration-300 ease-out ${
            creator ? "inset-x-0 top-0 bottom-[52dvh] lg:bottom-0 lg:right-[420px]" : "inset-0"
          }`}
          aria-label={name}
          role="img"
        >
          {stageMounted && !stageFailed && (
            <StageBoundary onError={() => setStageFailed(true)}>
              <RobotStage mood={mood} reduced={reduced} onReady={() => setStageReady(true)} onLost={() => setStageFailed(true)} />
            </StageBoundary>
          )}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 transition-[opacity,filter] duration-400 ease-out ${
              stageReady && !stageFailed ? "opacity-0 blur-[3px]" : "opacity-100"
            }`}
          >
            {(poster || stageFailed) && <StagePoster />}
          </div>
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:gap-3 sm:p-4 ${
            creator ? "lg:right-[420px]" : ""
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface/85 py-1.5 pl-3 pr-4 backdrop-blur sm:gap-2.5">
              <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
                <span className="absolute inset-0 rounded-full" style={{ background: mood === "error" ? "#ff3b30" : appearance.glow }} />
                {mood !== "idle" && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full opacity-60"
                    style={{ background: mood === "error" ? "#ff3b30" : appearance.glow }}
                  />
                )}
              </span>
              <span className="truncate font-display font-bold tracking-tight">{name}</span>
              <span className="hidden shrink-0 text-sm text-muted sm:inline">{STATUS_LABEL[mood]}</span>
            </div>
            {!creator && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                aria-label="Abrir historial de conversaciones"
                title="Historial"
                className="pointer-events-auto flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface/85 px-3 text-sm backdrop-blur transition-[transform,border-color] duration-150 ease-out hover:border-ink active:scale-[0.97] sm:px-4"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />
                </svg>
                <span className="hidden sm:inline">Historial</span>
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!creator && !empty && (
              <button
                type="button"
                onClick={startConversation}
                aria-label="Nueva conversación"
                title="Nueva conversación"
                className="pointer-events-auto flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface/85 px-3 text-sm backdrop-blur transition-[transform,border-color] duration-150 ease-out hover:border-ink active:scale-[0.97] sm:px-4"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="hidden sm:inline">Nueva conversación</span>
              </button>
            )}
            {speechOk && !creator && (
              <button
                type="button"
                onClick={() => setVoiceReplies(!voiceReplies)}
                aria-pressed={voiceReplies}
                aria-label="Leer las respuestas en voz alta"
                title={voiceReplies ? "Voz activada: Zony lee sus respuestas y envía lo que dictás" : "Activar la voz: Zony lee sus respuestas en voz alta"}
                className={`pointer-events-auto flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm backdrop-blur transition-[transform,border-color,background-color,color] duration-150 ease-out active:scale-[0.97] sm:px-4 ${
                  voiceReplies ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface/85 hover:border-ink"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {voiceReplies ? <path d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /> : <path d="M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" />}
                </svg>
                <span className="hidden sm:inline">Voz</span>
              </button>
            )}
            <div className="pointer-events-auto shrink-0">
              <CustomizeButton open={creator} onToggle={() => setCreator((c) => !c)} />
            </div>
          </div>
        </div>

        {creator && (
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-x-0 bottom-0 z-20 flex h-[52dvh] flex-col rounded-t-3xl border-t border-line bg-surface shadow-2xl lg:inset-y-0 lg:left-auto lg:h-auto lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0"
          >
            <CreatorPanel onClose={closeCreator} />
          </motion.aside>
        )}

        <main
          className={`relative z-10 min-h-0 h-full flex-1 flex-col ${creator ? "hidden" : "flex"}`}
          onDragEnter={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            dragDepth.current++;
            setDragging(true);
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (!dragDepth.current) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            addFiles([...e.dataTransfer.files]);
          }}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            {/* Room for the floating top bar. */}
            <div aria-hidden="true" className="h-16 shrink-0 sm:h-[4.5rem]" />

            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="scroll-fade min-h-0 flex-1 overflow-y-auto px-4"
            >
              {empty ? (
                <div className="flex min-h-full flex-col justify-end py-4">
                  <div className="rise w-fit max-w-full space-y-2 rounded-3xl bg-paper/90 p-4 backdrop-blur-md sm:p-5">
                    <h1 className="text-balance break-words font-display text-3xl font-bold tracking-tight sm:text-4xl">Hola, soy {name}</h1>
                    <p className="text-[15px] leading-snug text-muted sm:text-base sm:leading-normal">
                      Preguntame lo que quieras. Puedo explicar, resolver problemas, programar y leer tus archivos: PDF,
                      Word, Excel, PowerPoint, imágenes, audio o un enlace.
                    </p>
                  </div>
                </div>
              ) : (
                <div role="log" aria-live="polite" aria-relevant="additions" aria-busy={busy} className="flex min-h-full flex-col justify-end gap-6 py-4">
                  {messages.map((m) => (
                    <Message
                      key={m.id}
                      message={m}
                      streaming={busy && m === last}
                      onRegenerate={m === last && m.role === "assistant" && !busy ? regenerateAnswer : undefined}
                      onListen={speechOk && m.role === "assistant" ? () => (speakingId === m.id ? stopSpeaking() : speak(m.id, plain(m))) : undefined}
                      speaking={speakingId === m.id}
                    />
                  ))}
                  {showDots && (
                    <div className="flex w-fit items-start gap-2.5 rounded-3xl bg-paper/80 px-4 py-2.5 text-sm text-muted backdrop-blur-md">
                      <span className="flex h-5 shrink-0 items-center gap-1.5" aria-hidden="true">
                        <span className="typing-dot size-2 rounded-full bg-muted" />
                        <span className="typing-dot size-2 rounded-full bg-muted" />
                        <span className="typing-dot size-2 rounded-full bg-muted" />
                      </span>
                      {/* Announced by the log region: the wording changes as the wait drags on. */}
                      <span key={waitLevel} className="rise leading-5">
                        {WAIT_NOTICE[waitLevel]}
                      </span>
                    </div>
                  )}
                  {error && (
                    <div role="alert" className="flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 text-sm backdrop-blur-md">
                      <span>{errorText(error)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          robotGesture("hold");
                          regenerate();
                        }}
                        className="ml-auto shrink-0 cursor-pointer rounded-full bg-ink px-3.5 py-1.5 text-paper transition-transform duration-150 ease-out active:scale-[0.97]"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Composer
              input={input}
              onInput={setInput}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
              mic={dictation.supported ? { listening: dictation.listening, onToggle: () => (dictation.listening ? dictation.stop() : dictation.start()) } : undefined}
              notice={notice ?? storageNotice}
              busy={busy}
              preparing={preparing}
              onSend={() => send(input)}
              onStop={() => stop()}
              onFocusChange={setFocused}
              textareaRef={taRef}
              name={name}
            />
          </div>

          {dragging && (
            <div className="pointer-events-none absolute inset-3 z-10 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-paper/85 backdrop-blur-sm">
              <p className="font-display text-xl font-bold">Soltá los archivos para que {name} los lea</p>
            </div>
          )}
        </main>

        <AnimatePresence>
          {historyOpen && (
            <HistoryPanel
              activeId={activeId}
              onClose={closeHistory}
              onSelect={openConversation}
              onNew={startConversation}
              onDelete={removeConversation}
              onClearAll={removeAllConversations}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
