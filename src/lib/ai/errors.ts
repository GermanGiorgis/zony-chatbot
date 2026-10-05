/** Maps provider and SDK errors to messages the user can act on. The raw error is logged server-side. */

import { track } from "@/lib/analytics";
import { DEFAULT_NAME } from "@/lib/name";

/** What visitors see when the server itself is misconfigured: no key names or file paths (those stay in the dev message and the log). */
export const UNAVAILABLE_MESSAGE = "El asistente no está disponible en este momento. Probá de nuevo más tarde.";

const isDev = process.env.NODE_ENV === "development";

function unwrap(error: unknown): unknown {
  const e = error as { lastError?: unknown; cause?: unknown } | null;
  if (e?.lastError) return unwrap(e.lastError);
  if (e?.cause && !(e as { statusCode?: unknown }).statusCode) return unwrap(e.cause);
  return error;
}

/** `name` is what the visitor called the robot, so the message reads as if it came from it. */
export function friendlyError(error: unknown, name = DEFAULT_NAME): string {
  const e = unwrap(error) as { statusCode?: number; message?: string; responseBody?: string; url?: string } | null;
  // Not the whole error object: SDK errors carry the request body, which is the visitor's own text and files.
  console.error("[zony] error del modelo:", { status: e?.statusCode, message: e?.message?.slice(0, 300), url: e?.url });
  track("error", { status: e?.statusCode });
  const status = e?.statusCode;
  const text = `${e?.message ?? ""} ${e?.responseBody ?? ""}`.toLowerCase();

  if (status === 401 || status === 403 || /api[ _-]?key|permission_denied|unauthenticated/.test(text)) {
    return isDev
      ? "La clave de Gemini no es válida o no tiene permisos. Revisá GOOGLE_GENERATIVE_AI_API_KEY en .env.local."
      : UNAVAILABLE_MESSAGE;
  }
  if (status === 429 || /resource_exhausted|quota|rate limit/.test(text)) {
    return `${name} llegó al límite gratuito de uso por ahora. Esperá un minuto y probá de nuevo.`;
  }
  if (status === 413 || /too large|request payload size|exceeds the maximum/.test(text)) {
    return "Los archivos son demasiado grandes para procesarlos juntos. Probá con menos archivos o más livianos.";
  }
  if (/safety|blocked|prohibited_content/.test(text)) {
    return "No puedo responder a eso. Probá reformular la pregunta.";
  }
  if ((status && status >= 500) || /overloaded|unavailable|timeout|fetch failed|econnreset/.test(text)) {
    return "El servicio de IA está saturado en este momento. Probá de nuevo en unos segundos.";
  }
  if (status === 400) {
    return "No pude procesar este mensaje. Puede que algún archivo esté dañado o tenga un formato no compatible.";
  }
  return "Algo salió mal al responder. Probá de nuevo.";
}
