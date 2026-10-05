import type { GestureName } from "@/components/robot/rig";

/**
 * The robot's reaction to what is being said. A few cues in the first sentence are enough (and free: no extra
 * model call, no tokens): a greeting, good news, an apology, doubt, agreement, surprise or "let me explain".
 * Anything without a clear cue gets no gesture, so the ones that do fire mean something.
 */

/** A whole word, with Spanish letters counting as letters (JS `\b` only knows ASCII). */
const word = (pattern: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, "iu");
const start = (pattern: string) => new RegExp(`^[^\\p{L}\\p{N}]*(?:${pattern})(?![\\p{L}\\p{N}])`, "iu");

const RULES: { gesture: GestureName; test: (s: string) => boolean }[] = [
  // Bad news first: "lo siento, no pude" must not read as agreement.
  {
    gesture: "droop",
    test: (s) =>
      /[😢😔😞🙁😥😭]/u.test(s) ||
      word("lo siento|disculp\\w*|perd[oó]n|lamento|lamentablemente|desafortunadamente|no pude|no puedo (?:ayudar|hacer|acceder|ver|leer|abrir)|no tengo acceso").test(s),
  },
  {
    gesture: "cheer",
    test: (s) =>
      /[🎉🥳🙌🏆🎊]/u.test(s) ||
      word("felicitaciones|felicidades|genial|excelente|fant[aá]stico|buen[ií]simo|me alegra|qu[eé] bueno|bien hecho|lo lograste|perfecto").test(s),
  },
  { gesture: "wave", test: (s) => /👋/u.test(s) || start("hola|buenas|buen d[ií]a|buenos d[ií]as|buenas tardes|buenas noches|hey|qu[eé] tal").test(s) },
  { gesture: "flinch", test: (s) => /[😮😲🤯]/u.test(s) || word("wow|incre[ií]ble|sorprendente|uy|ups|vaya").test(s) },
  {
    gesture: "shrug",
    test: (s) => /[🤔🤷😅🙈]/u.test(s) || word("no estoy seguro|no lo s[eé]|no s[eé]|depende|quiz[aá]s?|tal vez|puede que|podr[ií]a ser").test(s),
  },
  { gesture: "nod", test: (s) => start("s[ií]|claro|por supuesto|exacto|correcto|as[ií] es|efectivamente|dale|desde luego").test(s) },
  { gesture: "present", test: (s) => word("paso a paso|te explico|veamos|a continuaci[oó]n|en resumen").test(s) },
];

/** The gesture that fits a piece of text, or null when nothing in it calls for one. */
export function reactionFor(text: string): GestureName | null {
  const s = text.trim();
  if (!s) return null;
  return RULES.find((r) => r.test(s))?.gesture ?? null;
}

/**
 * The first sentence of an answer that is still streaming: null until one has finished (or the text is long enough that
 * waiting further would make the reaction late), so the robot reacts while the answer is being written, not after it.
 */
export function firstSentence(text: string): string | null {
  const t = text.replace(/^\s+/, "");
  // A closing emoji belongs to the sentence ("¡Qué mal! 😔"): it is often the clearest cue.
  const end = /[.!?…:]+(?:\s*[\p{Extended_Pictographic}️‍]+)?(?=\s|$)|\n/u.exec(t.slice(3));
  if (end) return t.slice(0, 3 + end.index + end[0].length);
  return t.length >= 140 ? t.slice(0, 140) : null;
}
