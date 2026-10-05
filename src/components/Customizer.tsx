"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DEFAULT_NAME, MAX_NAME_LENGTH, typedName } from "@/lib/name";
import { previewAppearance, updateAppearance, useAppearance } from "./robot/appearance";
import { robotGesture, setCameraFocus } from "./robot/bus";
import {
  DEFAULT_APPEARANCE,
  FINISHES,
  MOTIONS,
  PART_LISTS,
  PRESETS,
  SWATCHES,
  TAB_FOCUS,
  type Appearance,
  type Look,
  type Option,
  type PartKey,
  type TabId,
} from "./robot/catalog";

const EASE = [0.23, 1, 0.32, 1] as const;

/* -------------------------------------------------------------------- icons */

const I = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const ICONS: Record<TabId, ReactNode> = {
  styles: I(<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.5L12 15l-1.8-4.5L5.5 9l4.7-1.4L12 3zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />),
  head: I(<><path d="M12 3c-3.6 0-6 2.8-6 6.6 0 4.2 2.7 7.9 6 7.9s6-3.7 6-7.9C18 5.8 15.6 3 12 3z" /><path d="M9.5 10.5h.01M14.5 10.5h.01M10 14h4M10 21h4" /></>),
  torso: I(<path d="M8 4h8l3 3-1 7-2 1v5H8v-5l-2-1-1-7 3-3zM12 4v4" />),
  arms: I(<path d="M5 20l3-6 3-2 4-6 3 1-2 5-3 3-2 5M11 12l2 2" />),
  legs: I(<path d="M9 3h6l-1 8 1 7 2 3h-4l-1-3-1-7-1 7-1 3H6l2-3 1-7-1-8z" />),
  outfit: I(<path d="M8 3l4 3 4-3 5 4-3 3v11H6V10L3 7l5-4z" />),
  hat: I(<><path d="M12 3l5 11H7l5-11z" /><path d="M3 17c3-2 15-2 18 0-3 2-15 2-18 0z" /></>),
  glasses: I(<><circle cx="7" cy="14" r="3.5" /><circle cx="17" cy="14" r="3.5" /><path d="M10.5 14h3M3.5 13L2 9M20.5 13L22 9" /></>),
  background: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6M15.5 8.5h.01" /></>),
  colors: I(<><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.5a1.5 1.5 0 0 0-1 2.6A1.5 1.5 0 0 1 12 22z" /><path d="M7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01" /></>),
};

const TABS: { id: TabId; name: string }[] = [
  { id: "styles", name: "Estilos" },
  { id: "head", name: "Cabeza" },
  { id: "torso", name: "Torso" },
  { id: "arms", name: "Brazos" },
  { id: "legs", name: "Piernas" },
  { id: "outfit", name: "Ropa" },
  { id: "hat", name: "Gorro" },
  { id: "glasses", name: "Lentes" },
  { id: "background", name: "Fondo" },
  { id: "colors", name: "Colores" },
];

/* --------------------------------------------------------------- reactions */

let lastReaction = 0;
function react(kind: "part" | "big") {
  if (kind === "big") return robotGesture("flex");
  const now = performance.now();
  if (now - lastReaction < 2400) return;
  lastReaction = now;
  robotGesture("admire");
}

const pickRandom = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function randomLook(): Look {
  const id = (k: PartKey) => pickRandom(PART_LISTS[k] as readonly Option[]).id;
  return {
    head: id("head") as Look["head"],
    torso: id("torso") as Look["torso"],
    arms: id("arms") as Look["arms"],
    legs: id("legs") as Look["legs"],
    outfit: id("outfit") as Look["outfit"],
    hat: Math.random() < 0.6 ? (id("hat") as Look["hat"]) : "none",
    glasses: Math.random() < 0.4 ? (id("glasses") as Look["glasses"]) : "none",
    shell: pickRandom(SWATCHES.shell),
    muscle: pickRandom(SWATCHES.muscle),
    metal: pickRandom(SWATCHES.metal),
    glow: pickRandom(SWATCHES.glow),
    finish: pickRandom(FINISHES).id,
  };
}

const sameLook = (a: Appearance, b: Look) => (Object.keys(b) as (keyof Look)[]).every((k) => a[k] === b[k]);

/* ----------------------------------------------------------------- controls */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function ColorRow({ label, value, options, onPick }: { label: string; value: string; options: readonly string[]; onPick: (c: string) => void }) {
  const id = useId();
  const custom = !options.includes(value);
  return (
    <Section title={label}>
      <div className="flex flex-wrap gap-1">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label}: ${c}`}
            aria-pressed={value === c}
            onClick={() => onPick(c)}
            className="group grid size-10 cursor-pointer place-items-center rounded-full"
          >
            <span
              className="size-7 rounded-full border border-black/10 transition-[transform,box-shadow] duration-150 ease-out group-active:scale-90 group-aria-pressed:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)] dark:border-white/15"
              style={{ background: c }}
            />
          </button>
        ))}
        <label htmlFor={id} className="group relative grid size-10 cursor-pointer place-items-center rounded-full" title="Elegir otro color">
          <span
            className={`size-7 rounded-full border border-black/10 transition-[transform,box-shadow] duration-150 ease-out group-active:scale-90 dark:border-white/15 ${custom ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]" : ""}`}
            style={{ background: custom ? value : "conic-gradient(#ff5f5f, #ffd166, #5ef2b8, #3da5ff, #b983ff, #ff5f5f)" }}
          />
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => onPick(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label}: color personalizado`}
          />
        </label>
      </div>
    </Section>
  );
}

function Segmented<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: Option<T>[]; onPick: (v: T) => void }) {
  return (
    <Section title={label}>
      <div className="grid rounded-full bg-paper p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onPick(o.id)}
            className="relative min-h-10 cursor-pointer rounded-full px-2 text-sm text-muted transition-colors duration-150 aria-pressed:text-ink"
          >
            {value === o.id && (
              <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-full bg-surface shadow-sm" transition={{ type: "spring", duration: 0.35, bounce: 0.15 }} />
            )}
            <span className="relative">{o.name}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

const canHover = () => typeof window !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;

function OptionGrid({ part, value }: { part: PartKey; value: string }) {
  const list = PART_LISTS[part] as readonly Option[];
  const index = Math.max(0, list.findIndex((o) => o.id === value));
  const choose = (id: string) => {
    previewAppearance(null);
    if (id === value) return;
    updateAppearance({ [part]: id } as Partial<Appearance>);
    react(part === "outfit" ? "big" : "part");
  };
  const step = (d: number) => choose(list[(index + d + list.length) % list.length].id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl bg-paper p-1.5">
        <button type="button" onClick={() => step(-1)} aria-label="Anterior" className="grid size-10 cursor-pointer place-items-center rounded-xl text-muted transition-[transform,color,background-color] duration-150 ease-out hover:bg-surface hover:text-ink active:scale-90">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <p className="min-w-0 flex-1 text-center" aria-live="polite">
          <span className="font-display font-bold">{list[index].name}</span>
          <span className="ml-2 font-mono text-xs text-muted">
            {String(index + 1).padStart(2, "0")}/{String(list.length).padStart(2, "0")}
          </span>
        </p>
        <button type="button" onClick={() => step(1)} aria-label="Siguiente" className="grid size-10 cursor-pointer place-items-center rounded-xl text-muted transition-[transform,color,background-color] duration-150 ease-out hover:bg-surface hover:text-ink active:scale-90">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-2" onPointerLeave={() => previewAppearance(null)}>
        {list.map((o, i) => (
          <li key={o.id}>
            <button
              type="button"
              aria-pressed={o.id === value}
              onClick={() => choose(o.id)}
              onPointerEnter={() => part !== "background" && canHover() && o.id !== value && previewAppearance({ [part]: o.id } as Partial<Appearance>)}
              className="group relative flex h-full min-h-16 w-full cursor-pointer flex-col items-start gap-0.5 overflow-hidden rounded-2xl border border-line bg-paper px-3 py-2.5 text-left transition-[transform,border-color] duration-150 ease-out hover:border-muted active:scale-[0.97] aria-pressed:border-accent"
            >
              {part === "background" && (
                // eslint-disable-next-line @next/next/no-img-element -- tiny local thumbnail
                <img src={`/zony/scenes/${o.id}-thumb.webp`} alt="" width={320} height={192} loading="lazy" className="mb-1.5 aspect-[5/3] w-full rounded-lg border border-black/10 object-cover dark:border-white/10" />
              )}
              <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm font-semibold leading-tight">{o.name}</span>
              {o.hint && <span className="text-xs leading-snug text-muted">{o.hint}</span>}
              <span aria-hidden="true" className="absolute right-2.5 top-2.5 grid size-5 scale-50 place-items-center rounded-full bg-accent text-accent-fg opacity-0 transition-[transform,opacity] duration-200 ease-out group-aria-pressed:scale-100 group-aria-pressed:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Nombre:" and a box: whatever is typed becomes the robot's name everywhere, live. */
function NameField({ name }: { name: string }) {
  const id = useId();
  // While focused the field shows what is being typed (it can be empty for a moment); otherwise the saved name.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2.5 px-4 pb-3 lg:px-5">
      <label htmlFor={id} className="shrink-0 text-sm font-medium">
        Nombre:
      </label>
      <input
        id={id}
        value={draft ?? name}
        maxLength={MAX_NAME_LENGTH}
        placeholder={DEFAULT_NAME}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        onFocus={() => setDraft(name)}
        onChange={(e) => {
          const typed = typedName(e.target.value);
          setDraft(typed);
          // An empty box keeps the previous name until something is typed; on blur it shows the saved one again.
          if (typed.trim()) updateAppearance({ name: typed });
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-10 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-sm transition-colors duration-150 hover:border-muted"
      />
    </div>
  );
}

/* -------------------------------------------------------------------- panel */

export function CustomizeButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="zony-creator"
      aria-label={open ? "Terminar de personalizar" : "Personalizar"}
      onClick={onToggle}
      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface/85 px-4 text-sm backdrop-blur transition-[transform,border-color] duration-150 ease-out hover:border-ink active:scale-[0.97]"
    >
      {open ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
          Listo
        </>
      ) : (
        <>
          {ICONS.colors}
          <span className="hidden min-[430px]:inline">Personalizar</span>
        </>
      )}
    </button>
  );
}

export function CreatorPanel({ onClose }: { onClose: () => void }) {
  const a = useAppearance();
  const [tab, setTab] = useState<TabId>("styles");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCameraFocus(TAB_FOCUS[tab]);
    previewAppearance(null);
  }, [tab]);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      setCameraFocus(null);
      previewAppearance(null);
    };
  }, [onClose]);

  const pick = (patch: Partial<Appearance>, kind: "part" | "big" = "part") => {
    updateAppearance(patch);
    react(kind);
  };

  return (
    <motion.div
      id="zony-creator"
      ref={panel}
      role="region"
      aria-label={`Personalizar a ${a.name}`}
      tabIndex={-1}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      className="flex min-h-0 flex-1 flex-col outline-none"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
        <div className="min-w-0">
          <h2 className="break-words font-display text-xl font-bold tracking-tight">Personalizá a {a.name}</h2>
          <p className="text-xs text-muted">Elegí una opción y mirá cómo cambia {a.name}. En la compu, pasar el mouse la prueba sin guardarla.</p>
        </div>
        <button
          type="button"
          onClick={() => pick({ ...randomLook() }, "big")}
          className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line px-3.5 text-sm transition-[transform,border-color] duration-150 ease-out hover:border-ink active:scale-[0.96]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" strokeWidth="3" />
          </svg>
          Aleatorio
        </button>
      </div>

      <NameField name={a.name} />

      <div
        role="tablist"
        aria-label="Categorías"
        aria-orientation="horizontal"
        className="grid shrink-0 grid-cols-5 gap-1.5 px-4 pb-3 lg:px-5"
        onKeyDown={(e) => {
          const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          const edge = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : undefined;
          if (move === undefined && edge === undefined) return;
          e.preventDefault();
          const at = TABS.findIndex((t) => t.id === tab);
          const next = TABS[edge ?? (at + (move ?? 0) + TABS.length) % TABS.length].id;
          setTab(next);
          requestAnimationFrame(() => document.getElementById(`creator-tab-${next}`)?.focus());
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`creator-tab-${t.id}`}
            role="tab"
            type="button"
            tabIndex={tab === t.id ? 0 : -1}
            aria-selected={tab === t.id}
            aria-controls="zony-creator-panel"
            onClick={() => setTab(t.id)}
            className="relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium text-muted transition-[color,transform] duration-150 ease-out hover:text-ink active:scale-[0.95] aria-selected:text-accent-fg"
          >
            {tab === t.id && (
              <motion.span layoutId="creator-tab" className="absolute inset-0 rounded-2xl bg-accent" transition={{ type: "spring", duration: 0.35, bounce: 0.12 }} />
            )}
            <span className="relative">{ICONS[t.id]}</span>
            <span className="relative leading-none">{t.name}</span>
          </button>
        ))}
      </div>

      <div id="zony-creator-panel" role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:px-5">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}>
          {tab === "styles" && (
            <ul className="grid grid-cols-2 gap-2" onPointerLeave={() => previewAppearance(null)}>
              {PRESETS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={sameLook(a, p.look)}
                    onClick={() => {
                      previewAppearance(null);
                      pick(p.look, "big");
                    }}
                    onPointerEnter={() => canHover() && previewAppearance(p.look)}
                    className="flex min-h-20 w-full cursor-pointer flex-col items-start justify-between gap-2 rounded-2xl border border-line bg-paper px-3 py-2.5 text-left transition-[transform,border-color] duration-150 ease-out hover:border-muted active:scale-[0.97] aria-pressed:border-accent"
                  >
                    <span className="flex -space-x-1.5" aria-hidden="true">
                      {[p.look.shell, p.look.muscle, p.look.metal, p.look.glow].map((c, i) => (
                        <span key={i} className="size-5 rounded-full border border-black/10 dark:border-white/15" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="text-sm font-semibold">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tab !== "styles" && tab !== "colors" && <OptionGrid part={tab} value={a[tab]} />}

          {tab === "colors" && (
            <div className="space-y-6">
              <ColorRow label="Carcasa" value={a.shell} options={SWATCHES.shell} onPick={(shell) => pick({ shell })} />
              <ColorRow label="Músculos" value={a.muscle} options={SWATCHES.muscle} onPick={(muscle) => pick({ muscle })} />
              <ColorRow label="Metal" value={a.metal} options={SWATCHES.metal} onPick={(metal) => pick({ metal })} />
              <ColorRow label="Luz" value={a.glow} options={SWATCHES.glow} onPick={(glow) => pick({ glow })} />
              <Segmented label="Acabado" value={a.finish} options={FINISHES} onPick={(finish) => pick({ finish })} />
              <Segmented label="Movimiento" value={a.motion} options={MOTIONS} onPick={(motion) => updateAppearance({ motion })} />
              <button
                type="button"
                onClick={() => pick({ ...DEFAULT_APPEARANCE, background: a.background, name: a.name }, "big")}
                className="min-h-10 cursor-pointer text-sm text-muted underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline"
              >
                Restablecer todo
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

