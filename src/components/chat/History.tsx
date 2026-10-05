"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { renameConversation, useConversations, type Conversation } from "@/lib/conversations";

const EASE = [0.23, 1, 0.32, 1] as const;

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return d.toLocaleDateString("es", { weekday: "long" });
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

/** Groups (already sorted newest first) by the day label, keeping order. */
function grouped(list: Conversation[]) {
  const out: { label: string; items: Conversation[] }[] = [];
  for (const c of list) {
    const label = dayLabel(c.updatedAt);
    const last = out[out.length - 1];
    if (last?.label === label) last.items.push(c);
    else out.push({ label, items: [c] });
  }
  return out;
}

const iconBtn =
  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-[transform,color,background-color] duration-150 ease-out hover:bg-ink/10 hover:text-ink active:scale-[0.94]";

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Row({
  c,
  active,
  onSelect,
  onDelete,
}: {
  c: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.title);
  const [confirming, setConfirming] = useState(false);
  const skipCommit = useRef(false);

  function commit() {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    renameConversation(c.id, draft);
    setEditing(false);
  }

  if (confirming) {
    return (
      <li className="flex items-center gap-2 rounded-2xl border border-line bg-paper/60 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">¿Eliminar “{c.title}”?</span>
        <button type="button" onClick={onDelete} className="cursor-pointer rounded-full bg-ink px-3 py-1 text-paper transition-transform duration-150 ease-out active:scale-[0.96]">
          Eliminar
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="cursor-pointer rounded-full px-2.5 py-1 text-muted transition-colors duration-150 hover:text-ink">
          No
        </button>
      </li>
    );
  }

  return (
    <li className={`group flex items-center gap-1 rounded-2xl border pl-3 pr-1 transition-colors duration-150 ${active ? "border-ink bg-paper/60" : "border-transparent hover:bg-ink/5"}`}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          maxLength={60}
          aria-label="Nombre de la conversación"
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              skipCommit.current = true;
              setEditing(false);
            }
          }}
          className="my-1.5 min-w-0 flex-1 rounded-lg border border-ink bg-surface px-2 py-1 text-sm outline-none"
        />
      ) : (
        <button type="button" onClick={onSelect} aria-current={active ? "true" : undefined} className="min-w-0 flex-1 cursor-pointer py-2.5 text-left text-sm">
          <span className="block truncate">{c.title}</span>
        </button>
      )}
      {!editing && (
        <span className="flex shrink-0 items-center opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            aria-label={`Cambiar nombre de “${c.title}”`}
            title="Cambiar nombre"
            onClick={() => {
              setDraft(c.title);
              setEditing(true);
            }}
            className={iconBtn}
          >
            <Icon d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </button>
          <button type="button" aria-label={`Eliminar “${c.title}”`} title="Eliminar" onClick={() => setConfirming(true)} className={iconBtn}>
            <Icon d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
          </button>
        </span>
      )}
    </li>
  );
}

export function HistoryPanel({
  activeId,
  onClose,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
}: {
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}) {
  const list = useConversations();
  const [confirmAll, setConfirmAll] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 z-30 bg-paper/60 backdrop-blur-[2px]"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Historial de conversaciones"
        onKeyDown={(e) => {
          // Keep Tab inside the drawer while it is open.
          if (e.key !== "Tab") return;
          const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button, input, [href]")].filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
          if (!items.length) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.3, ease: EASE }}
        className="absolute inset-y-0 left-0 z-40 flex w-[min(21rem,88vw)] flex-col border-r border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h2 className="flex-1 font-display text-lg font-bold tracking-tight">Historial</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar historial" className={iconBtn}>
            <Icon d="M6 6l12 12M18 6L6 18" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-paper transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <Icon d="M12 5v14M5 12h14" />
            Nueva conversación
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {list.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted">Todavía no hay conversaciones. Las que tengas van a quedar guardadas acá, en este navegador.</p>
          ) : (
            grouped(list).map((g) => (
              <section key={g.label} className="mt-3 first:mt-1">
                <h3 className="px-3 pb-1 text-xs font-medium capitalize text-muted">{g.label}</h3>
                <ul className="space-y-0.5">
                  {g.items.map((c) => (
                    <Row key={c.id} c={c} active={c.id === activeId} onSelect={() => onSelect(c.id)} onDelete={() => onDelete(c.id)} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {list.length > 0 && (
          <div className="border-t border-line px-3 py-3">
            {confirmAll ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">¿Borrar todo el historial?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmAll(false);
                  }}
                  className="cursor-pointer rounded-full bg-ink px-3 py-1 text-paper transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  Borrar
                </button>
                <button type="button" onClick={() => setConfirmAll(false)} className="cursor-pointer rounded-full px-2.5 py-1 text-muted transition-colors duration-150 hover:text-ink">
                  No
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmAll(true)} className="cursor-pointer text-sm text-muted transition-colors duration-150 hover:text-ink">
                Borrar todo el historial
              </button>
            )}
          </div>
        )}
      </motion.aside>
    </>
  );
}
