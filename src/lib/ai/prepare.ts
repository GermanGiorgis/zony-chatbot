import type { UIMessage } from "ai";
import { fileKind, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, SUPPORTED_LABEL, formatSize } from "../files";
import { decodeDataUrl, extractText, MAX_DOC_CHARS } from "./documents";

type Part = UIMessage["parts"][number];

/** Conversation window sent to the model; older turns are dropped to save tokens. */
const MAX_MESSAGES = 24;
/** Longest message the visitor can type (a pasted book is not what the context window is for). */
const MAX_TEXT_CHARS = 30_000;
/** Text taken from documents across the whole conversation: every follow-up question re-sends the earlier files, so this bounds the cost of each turn. */
const MAX_CONVERSATION_DOC_CHARS = 200_000;
/** Budget for files the model reads natively (base64 characters, ~ the request size). */
const MAX_INLINE_CHARS = 18 * 1024 * 1024;

const URL_RE = /https?:\/\/[^\s<>()"'`]+/gi;
const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/i;

const note = (text: string): Part => ({ type: "text", text });

export function textOf(message: UIMessage) {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n");
}

async function prepareUserParts(parts: UIMessage["parts"], budget: { left: number; docChars: number }) {
  const out: Part[] = [];
  let fileCount = 0;
  let totalBytes = 0;
  for (const part of parts) {
    if (part.type === "text") {
      out.push(
        part.text.length > MAX_TEXT_CHARS
          ? { ...part, text: `${part.text.slice(0, MAX_TEXT_CHARS)}\n\n[… mensaje recortado: se leyeron los primeros ${MAX_TEXT_CHARS.toLocaleString("es")} caracteres]` }
          : part,
      );
      continue;
    }
    if (part.type !== "file") continue;

    const name = part.filename?.slice(0, 120) || "archivo";
    // The client already enforces these, but the API is a public endpoint anyone can call directly.
    if (++fileCount > MAX_FILES) {
      out.push(note(`[Se omitió "${name}": podés adjuntar hasta ${MAX_FILES} archivos por mensaje.]`));
      continue;
    }

    // Only inline uploads: a remote URL here would make the server fetch arbitrary addresses.
    const bytes = part.url.startsWith("data:") ? decodeDataUrl(part.url) : null;
    if (!bytes) {
      out.push(note(`[No se pudo leer el archivo "${name}".]`));
      continue;
    }
    if (!bytes.length) {
      out.push(note(`[El archivo "${name}" está vacío.]`));
      continue;
    }
    if (bytes.length > MAX_FILE_BYTES) {
      out.push(note(`[Se omitió "${name}" (${formatSize(bytes.length)}): el máximo por archivo es ${formatSize(MAX_FILE_BYTES)}.]`));
      continue;
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      out.push(note(`[Se omitió "${name}": los adjuntos superan ${formatSize(MAX_TOTAL_BYTES)} en total.]`));
      continue;
    }

    const kind = fileKind(part.mediaType, name);
    if (kind === "unsupported") {
      out.push(note(`[El archivo "${name}" no tiene un formato compatible. Formatos que puedo leer: ${SUPPORTED_LABEL}.]`));
    } else if (kind === "native") {
      if (part.url.length > budget.left) {
        out.push(note(`[El archivo "${name}" se omitió para no superar el tamaño máximo de la conversación.]`));
      } else {
        budget.left -= part.url.length;
        out.push(note(`[Archivo adjunto: ${name}]`), part);
      }
    } else {
      if (budget.docChars <= 0) {
        out.push(note(`[Se omitió "${name}": ya hay demasiado texto de documentos en esta conversación. Empezá una conversación nueva para analizar más archivos.]`));
        continue;
      }
      try {
        const text = await extractText(kind, bytes, Math.min(MAX_DOC_CHARS, budget.docChars));
        budget.docChars -= text.length;
        out.push(note(`<documento nombre="${name.replace(/"/g, "'")}">\n${text || "(sin texto)"}\n</documento>`));
      } catch {
        out.push(note(`[No pude extraer el texto de "${name}". Puede estar dañado o protegido con contraseña.]`));
      }
    }
  }
  return out;
}

/**
 * Turns the client's UI messages into what the model should see: office documents become text,
 * oversized or unsafe attachments become short notes, and assistant turns keep only their text.
 */
export async function prepareMessages(messages: UIMessage[]) {
  let window = messages.slice(-MAX_MESSAGES);
  while (window.length && window[0].role !== "user") window = window.slice(1);

  const budget = { left: MAX_INLINE_CHARS, docChars: MAX_CONVERSATION_DOC_CHARS };
  const prepared: UIMessage[] = [];
  // Newest first, so the latest attachments win the size budget.
  for (let i = window.length - 1; i >= 0; i--) {
    const m = window[i];
    if (m.role === "user") {
      const parts = await prepareUserParts(m.parts, budget);
      const typed = m.parts.some((p) => p.type === "text" && p.text.trim());
      if (!typed) parts.push(note("Analizá los archivos adjuntos y contame lo más importante."));
      prepared.unshift({ ...m, parts });
    } else if (m.role === "assistant") {
      const parts = m.parts.filter((p) => p.type === "text");
      if (parts.length) prepared.unshift({ ...m, parts });
    }
  }
  return prepared;
}

/** Links in the latest user message: YouTube videos go to the model as video, the rest are read as web pages. */
export function linksIn(message: UIMessage | undefined) {
  const urls = message ? (textOf(message).match(URL_RE) ?? []) : [];
  let youtube: string | undefined;
  const web: string[] = [];
  for (const url of urls) {
    const id = YOUTUBE_RE.exec(url)?.[1];
    if (id) youtube ??= `https://www.youtube.com/watch?v=${id}`;
    else web.push(url);
  }
  return { youtube, web };
}
