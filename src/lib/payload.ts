import type { UIMessage } from "ai";

/**
 * Vercel Functions reject request bodies over 4.5 MB, and every turn re-sends the whole conversation, attachments (as
 * base64) included. Before sending, the oldest attachments are swapped for a short note until the body fits.
 */
export const MAX_REQUEST_BYTES = 4.2 * 1024 * 1024;

const sizeOf = (messages: UIMessage[]) => new Blob([JSON.stringify(messages)]).size;

export function fitPayload<T extends UIMessage>(messages: T[], maxBytes = MAX_REQUEST_BYTES): T[] {
  let size = sizeOf(messages);
  if (size <= maxBytes) return messages;
  const out = messages.map((m) => ({ ...m, parts: [...m.parts] })) as T[];
  // The newest message is the one being answered: its files are never dropped.
  for (let i = 0; i < out.length - 1 && size > maxBytes; i++) {
    out[i].parts = out[i].parts.map((part) => {
      if (part.type !== "file" || size <= maxBytes) return part;
      const note = { type: "text" as const, text: `[Archivo "${part.filename ?? "sin nombre"}" enviado antes: ya no se incluye porque la conversación pesa demasiado.]` };
      size -= part.url.length - note.text.length;
      return note;
    });
  }
  return out;
}
