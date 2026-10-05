import type { LanguageModel } from "ai";
import { DEFAULT_NAME } from "@/lib/name";
import { demoAnswer, type DemoReason } from "./demo";

type DemoModel = Extract<LanguageModel, { specificationVersion: "v4" }>;

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
} as const;
const FINISH = { unified: "stop", raw: "stop" } as const;

type PromptMessage = { role: string; content: unknown };

const textOf = (content: unknown) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((p: { type?: string; text?: string }) => (p.type === "text" ? (p.text ?? "") : "")).join("")
      : "";

/** What the visitor last wrote, and the name they gave the robot (it is in the system instructions). */
function readPrompt(prompt: PromptMessage[]) {
  const text = textOf(prompt.findLast((m) => m.role === "user")?.content);
  const system = textOf(prompt.find((m) => m.role === "system")?.content);
  const name = system.match(/Tu nombre es "([^"\n]{1,40})"/)?.[1] ?? DEFAULT_NAME;
  return { text, name };
}

const pause = (ms: number, abort?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    abort?.addEventListener("abort", () => (clearTimeout(id), resolve()), { once: true });
  });

/**
 * A "language model" with no AI in it: it answers from `demoAnswer` and streams the text a few words at a time so the
 * chat behaves exactly like it does with a real model (typing effect, robot reactions, voice).
 */
export function createDemoModel(reason: DemoReason): DemoModel {
  const answer = (prompt: PromptMessage[]) => {
    const { text, name } = readPrompt(prompt);
    return demoAnswer(text, { name, reason });
  };
  return {
    specificationVersion: "v4",
    provider: "zony-demo",
    modelId: "demo",
    supportedUrls: {},
    async doGenerate({ prompt }) {
      const text = await answer(prompt as PromptMessage[]);
      return { content: [{ type: "text", text }], finishReason: FINISH, usage: USAGE, warnings: [] };
    },
    async doStream({ prompt, abortSignal }) {
      const text = await answer(prompt as PromptMessage[]);
      const chunks = text.match(/\S+\s*|\s+/g) ?? [text];
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "demo" });
          for (let i = 0; i < chunks.length; i += 2) {
            if (abortSignal?.aborted) break;
            controller.enqueue({ type: "text-delta", id: "demo", delta: chunks.slice(i, i + 2).join("") });
            await pause(22, abortSignal);
          }
          controller.enqueue({ type: "text-end", id: "demo" });
          controller.enqueue({ type: "finish", finishReason: FINISH, usage: USAGE });
          controller.close();
        },
      });
      return { stream };
    },
  };
}
