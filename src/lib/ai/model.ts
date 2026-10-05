import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import { createDemoModel } from "./demo-model";

/**
 * Free Gemini models, tried in order. Each one has its own daily quota on the free tier,
 * so falling back multiplies how many messages Zony can answer per day.
 * Ordered by measured time to first token (2026-09-28): 3.1 Flash-Lite answered in ~2s, 3.8 Flash in ~3s
 * (small daily quota), while 3.5 Flash-Lite queued for 14-35s, so it is the last resort. Override with GEMINI_MODELS.
 */
const DEFAULT_GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash-lite"];

/** Last-resort fallback once every Gemini model is out of quota or down for the day (different free tier, own key). */
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/** How long a model gets to start streaming before the next one is tried (free-tier queues can stall for 30s). */
const startTimeoutMs = () => Number(process.env.GEMINI_START_TIMEOUT_MS) || 8000;
/** Requests with images, PDFs, audio or tool calls (reading a link) legitimately take longer to produce the first token. */
const HEAVY_START_MS = 22_000;
type CallParams = { prompt: { content: unknown }[]; tools?: unknown[]; abortSignal?: AbortSignal };
const hasMedia = (params: CallParams) =>
  params.prompt.some((m) => Array.isArray(m.content) && m.content.some((part) => (part as { type?: string }).type === "file"));
/** The provider's own tools (reading a link, web search) only work on Gemini; our function tools (calculator, clock, weather) work on any model. */
const hasProviderTools = (params: CallParams) => (params.tools ?? []).some((t) => (t as { type?: string }).type === "provider");
const isHeavy = (params: CallParams) => hasProviderTools(params) || hasMedia(params);

const FALLBACK_STATUS = new Set([404, 408, 409, 429, 500, 502, 503, 504]);

class SlowStartError extends Error {
  statusCode = 408;
}

/** Runs one attempt with a signal that fires when the caller aborts or when the response takes more than `ms` to start. */
async function withStartTimeout<T>(abort: AbortSignal | undefined, ms: number, call: (signal: AbortSignal) => PromiseLike<T>) {
  const slow = new AbortController();
  const timer = setTimeout(() => slow.abort(), ms);
  try {
    return await call(abort ? AbortSignal.any([abort, slow.signal]) : slow.signal);
  } catch (error) {
    if (slow.signal.aborted && !abort?.aborted) throw new SlowStartError(`sin respuesta en ${ms} ms`);
    throw error;
  } finally {
    clearTimeout(timer); // once the stream has started, only the caller can abort it
  }
}

function shouldFallback(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return false;
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status !== "number" || FALLBACK_STATUS.has(status);
}

/** "High demand" 503s and stalls come in bursts, unlike a 429 (quota), which a pause will not fix. */
function isBusy(error: unknown) {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" && [408, 500, 502, 503, 504].includes(status);
}

/**
 * Models that just failed are skipped for a while, so a busy Gemini does not cost every message 8 s per model
 * before the one that works is reached. Quota (429) lasts far longer than a demand spike.
 */
const COOLDOWN_BUSY_MS = 30_000;
const COOLDOWN_QUOTA_MS = 120_000;
/** A per-day quota does not come back in two minutes: do not ask again every time. */
const COOLDOWN_DAILY_QUOTA_MS = 30 * 60_000;
const cooling = new Map<string, number>();
const isCooling = (id: string) => (cooling.get(id) ?? 0) > Date.now();
function cool(id: string, error: unknown) {
  const e = error as { statusCode?: unknown; message?: unknown; responseBody?: unknown } | null;
  const status = e?.statusCode;
  if (status === 429) {
    const daily = /per.?day|daily|exceeded your current quota/i.test(`${e?.message ?? ""} ${e?.responseBody ?? ""}`);
    cooling.set(id, Date.now() + (daily ? COOLDOWN_DAILY_QUOTA_MS : COOLDOWN_QUOTA_MS));
  }
  else if (isBusy(error)) cooling.set(id, Date.now() + COOLDOWN_BUSY_MS);
}

const isDemo = (model: { provider: string }) => model.provider === "zony-demo";

/** Groq's models here only read text and have no link reader, so requests with images, PDFs, audio or links must stay on Gemini. */
const isTextOnly = (model: { provider: string }) => model.provider.startsWith("groq");

const pause = (ms: number, abort?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    abort?.addEventListener("abort", () => (clearTimeout(id), resolve()), { once: true });
  });

/** After a full pass of "busy" answers, wait a moment and go through the chain once more (unless it is already too late). */
const LAPS = 2;
const LAP_PAUSE_MS = 2000;
const NO_MORE_LAPS_AFTER_MS = 25_000;

/** A model in the fallback chain: any Gemini model, or the Groq model appended as the final safety net. */
type ChainModel = ReturnType<ReturnType<typeof createGoogle>> | ReturnType<ReturnType<typeof createGroq>> | ReturnType<typeof createDemoModel>;

/** Retries the call on the next model when one is rate limited, overloaded, retired or too slow to start. */
function fallbackTo(models: ChainModel[]): LanguageModelMiddleware {
  /** `attempt(model, signal)` runs one try; `model` is undefined for the primary model. All but the last must start within `startMs`. */
  async function run<T>(
    primary: { modelId: string },
    request: { abort: AbortSignal | undefined; startMs: number; needsGemini: boolean },
    attempt: (model: ChainModel | undefined, signal: AbortSignal | undefined) => PromiseLike<T>,
  ) {
    const { abort, startMs, needsGemini } = request;
    const key = (m: ChainModel | undefined) => (m ?? primary).modelId;
    const usable = [undefined, ...models].filter((m) => !needsGemini || !m || !isTextOnly(m));
    // Models that failed recently go to the back instead of out of the chain: if everything else fails they still get a turn
    // (a quota that "should" last until tomorrow may have come back, and an empty chain would fail without even asking).
    const chain = [...usable.filter((m) => !isCooling(key(m))), ...usable.filter((m) => isCooling(key(m)))];
    // The demo has no AI and nothing to fail: it always comes last, whatever the cooldowns say.
    const real = chain.filter((m) => !m || !isDemo(m));
    const demo = chain.filter((m) => m && isDemo(m));
    chain.splice(0, chain.length, ...real, ...demo);
    const started = Date.now();
    let error: unknown;
    for (let lap = 0; lap < LAPS; lap++) {
      if (lap > 0) {
        if (abort?.aborted || !isBusy(error) || Date.now() - started > NO_MORE_LAPS_AFTER_MS) break;
        console.warn(`[zony] todos los modelos ocupados, reintento en ${LAP_PAUSE_MS / 1000} s`);
        await pause(LAP_PAUSE_MS, abort);
      }
      for (const [i, model] of chain.entries()) {
        if (lap > 0 || i > 0) {
          if (!shouldFallback(error)) throw error;
          console.warn(`[zony] cambiando a ${model?.modelId ?? "el modelo principal"}:`, (error as Error)?.message);
        }
        try {
          const patient = !startMs || i === chain.length - 1;
          const result = patient
            ? await attempt(model, abort)
            : await withStartTimeout(abort, startMs, (signal) => attempt(model, signal));
          cooling.delete(key(model));
          return result;
        } catch (e) {
          error = e;
          cool(key(model), e);
        }
      }
    }
    throw error;
  }
  return {
    wrapStream: ({ model, params }) =>
      run(
        model,
        { abort: params.abortSignal, startMs: isHeavy(params) ? Math.max(startTimeoutMs(), HEAVY_START_MS) : startTimeoutMs(), needsGemini: isHeavy(params) },
        (m, signal) => (m ?? model).doStream({ ...params, abortSignal: signal }),
      ),
    wrapGenerate: ({ model, params }) =>
      run(
        model,
        { abort: params.abortSignal, startMs: 0, needsGemini: isHeavy(params) },
        (m, signal) => (m ?? model).doGenerate({ ...params, abortSignal: signal }),
      ),
  };
}

export type ChatBackend =
  | { kind: "google"; model: LanguageModel }
  | { kind: "gateway"; model: LanguageModel }
  /** No key at all: Zony still answers, from the demo. */
  | { kind: "demo"; model: LanguageModel };

export function getBackend(): ChatBackend {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (googleKey) {
    const google = createGoogle({ apiKey: googleKey });
    const ids = (process.env.GEMINI_MODELS?.split(",") ?? DEFAULT_GEMINI_MODELS).map((s) => s.trim()).filter(Boolean);
    const [primary, ...rest] = ids.map((id) => google(id));

    // Own free tier, own daily quota: once every Gemini model is out for the day, Groq keeps Zony answering.
    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (groqKey) {
      const groq = createGroq({ apiKey: groqKey });
      rest.push(groq(process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL));
    }

    // And once even Groq is out, the demo answers instead of an error.
    rest.push(createDemoModel("quota"));

    return { kind: "google", model: wrapLanguageModel({ model: primary, middleware: fallbackTo(rest) }) };
  }
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return { kind: "gateway", model: process.env.CHAT_MODEL ?? "google/gemini-3.5-flash-lite" };
  }
  return { kind: "demo", model: createDemoModel("nokey") };
}
