import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type ToolSet,
} from "ai";
import { track } from "@/lib/analytics";
import { zonyTools } from "@/lib/ai/tools";
import { friendlyError } from "@/lib/ai/errors";
import { buildInstructions } from "@/lib/ai/instructions";
import { getBackend } from "@/lib/ai/model";
import { linksIn, prepareMessages } from "@/lib/ai/prepare";
import { cleanName, DEFAULT_NAME } from "@/lib/name";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

/** Whole request body. Vercel stops anything over 4.5 MB before it gets here; this protects other hosts (the client trims old attachments to fit, see lib/payload.ts). */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const reply = (status: number, message: string) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function POST(req: Request) {
  const backend = getBackend();
  const limit = rateLimit(clientKey(req));
  if (!limit.ok) {
    return reply(429, `Enviaste muchos mensajes seguidos. Esperá ${limit.retryAfter} ${limit.retryAfter === 1 ? "segundo" : "segundos"} y probá de nuevo.`);
  }

  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    return reply(413, "La conversación con sus archivos es demasiado grande. Empezá una conversación nueva.");
  }

  const body = (await req.json().catch(() => null)) as { messages?: unknown; name?: unknown } | null;
  const name = cleanName(body?.name);
  const validated = await safeValidateUIMessages({ messages: body?.messages });
  if (!validated.success) return reply(400, "El mensaje llegó con un formato inválido.");

  const messages = await prepareMessages(validated.data);
  const last = messages.findLast((m) => m.role === "user");
  if (!last) return reply(400, "No hay ningún mensaje para responder.");

  const isGoogle = backend.kind === "google";
  const webSearch = isGoogle && process.env.GEMINI_WEB_SEARCH === "true";
  const { youtube, web } = linksIn(last);
  if (youtube && isGoogle) last.parts.push({ type: "file", mediaType: "video/mp4", url: youtube });

  // Gemini does not mix its own tools (reading links, web search) with ours in one request: a message with a link or
  // with web search on uses the provider's tools, every other message gets the calculator, the clock and the weather.
  const tools: ToolSet = {};
  if (isGoogle && web.length) tools.url_context = google.tools.urlContext({});
  else if (webSearch) tools.google_search = google.tools.googleSearch({});
  else Object.assign(tools, zonyTools);
  const ownTools = tools.calculadora !== undefined;

  track("chat", {
    messages: messages.length,
    files: last.parts.filter((p) => p.type === "file").length,
    link: web.length > 0,
    youtube: !!youtube,
    renamed: name !== DEFAULT_NAME,
    backend: backend.kind,
  });

  const result = streamText({
    model: backend.model,
    instructions: buildInstructions({ webSearch, name, tools: ownTools }),
    messages: await convertToModelMessages(messages),
    tools,
    // After a tool answers, the model gets another step to explain the result (calculate, then answer).
    stopWhen: stepCountIs(4),
    maxOutputTokens: 8192,
    // The fallback chain already moves to another model on 429/5xx; retrying would only add latency.
    maxRetries: 0,
    abortSignal: req.signal,
    providerOptions: {
      google: {
        ...(youtube ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {}),
      } satisfies GoogleLanguageModelOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendSources: true,
      onError: (error) => friendlyError(error, name),
    }),
  });
}
