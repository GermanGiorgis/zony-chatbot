"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { ACCEPT_ATTR, formatSize } from "@/lib/files";
import { type Attachment } from "./attachments";
import { FileChip } from "./Message";

/** The full placeholder wraps to two lines on a phone, so small screens get the short one. */
const WIDE = "(min-width: 640px)";
const subscribeWide = (cb: () => void) => {
  const mq = matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Props = {
  input: string;
  onInput: (value: string) => void;
  attachments: Attachment[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  notice: string | null;
  busy: boolean;
  preparing: boolean;
  onSend: () => void;
  onStop: () => void;
  onFocusChange: (focused: boolean) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** What the visitor called the robot. */
  name: string;
  /** Dictation: absent where the browser has no speech recognition. */
  mic?: { listening: boolean; onToggle: () => void };
};

export function Composer({
  input,
  onInput,
  attachments,
  onAddFiles,
  onRemove,
  notice,
  busy,
  preparing,
  onSend,
  onStop,
  onFocusChange,
  textareaRef,
  name,
  mic,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const wide = useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches, () => true);
  const canSend = (input.trim().length > 0 || attachments.length > 0) && !preparing;

  const fit = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [textareaRef]);

  useEffect(() => {
    fit();
  }, [input, fit]);

  useEffect(() => {
    document.fonts.ready.then(fit);
  }, [fit]);

  return (
    <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend();
        }}
        className="rounded-3xl border border-line bg-surface p-2 transition-colors duration-150 focus-within:border-ink"
      >
        <AnimatePresence initial={false}>
          {attachments.length > 0 && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex gap-2 overflow-x-auto px-1"
              aria-label="Archivos adjuntos"
            >
              {attachments.map((a) => (
                <li key={a.id} className="shrink-0 pb-2">
                  {a.part.mediaType.startsWith("image/") ? (
                    <span className="relative block size-11">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a data URL */}
                      <img src={a.part.url} alt={a.name} className="size-11 rounded-2xl border border-line object-cover" />
                      <button
                        type="button"
                        onClick={() => onRemove(a.id)}
                        aria-label={`Quitar ${a.name}`}
                        className="absolute -right-1.5 -top-1.5 grid size-5 cursor-pointer place-items-center rounded-full bg-ink text-paper"
                      >
                        <svg width="8" height="8" viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </span>
                  ) : (
                    <FileChip name={a.name} mediaType={a.part.mediaType} meta={formatSize(a.size)} onRemove={() => onRemove(a.id)} />
                  )}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAddFiles([...e.target.files]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Adjuntar archivos"
            title="Adjuntar PDF, Word, Excel, imágenes, audio…"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-[transform,color,background-color] duration-150 ease-out hover:bg-ink/5 hover:text-ink active:scale-[0.94]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <label htmlFor="msg" className="sr-only">
            Escribí tu mensaje
          </label>
          <textarea
            id="msg"
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                onAddFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend && !busy) onSend();
              }
            }}
            placeholder={
              mic?.listening
                ? "Escuchando… hablá ahora"
                : wide
                ? `Escribile a ${name} o adjuntá un archivo…`
                : name.length > 12
                  ? "Escribí tu mensaje…" // a long name would wrap the placeholder onto two lines
                  : `Escribile a ${name}…`
            }
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1.5 py-2.5 leading-snug outline-none placeholder:text-muted"
          />
          {mic && !busy && (
            <button
              type="button"
              onClick={mic.onToggle}
              aria-label={mic.listening ? "Dejar de escuchar" : "Dictar con la voz"}
              aria-pressed={mic.listening}
              title={mic.listening ? "Dejar de escuchar" : "Dictar con la voz (el navegador procesa el audio)"}
              className={`relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.94] ${
                mic.listening ? "bg-accent text-accent-fg" : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {mic.listening && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
              <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Detener respuesta"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-paper transition-transform duration-150 ease-out active:scale-[0.94]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <rect width="14" height="14" rx="3" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Enviar mensaje"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-accent-fg transition-[transform,opacity] duration-150 ease-out active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </form>
      <p className="mt-2 min-h-4 text-center text-xs" aria-live="polite">
        {notice ? (
          <span className="inline-block max-w-full rounded-2xl bg-paper/90 px-3 py-1 text-accent-text backdrop-blur-md">{notice}</span>
        ) : (
          <span className="inline-block max-w-full rounded-2xl bg-paper/90 px-3 py-1 text-muted backdrop-blur-md">
            {name} puede equivocarse. Tus mensajes y archivos se procesan con Gemini y Groq: no subas datos sensibles.{" "}
            <Link href="/creditos" className="underline underline-offset-2 transition-colors hover:text-ink">
              Créditos
            </Link>
          </span>
        )}
      </p>
    </div>
  );
}
