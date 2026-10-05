/**
 * Pure helpers for reading answers aloud: the browser's voice should hear sentences, not Markdown. Kept free of any
 * browser API so they can be tested (the voice itself lives in components/chat/voice.ts).
 */

/** An answer in Markdown as plain, speakable text: code and tables are summarised, links and emoji dropped. */
export function toSpeakable(markdown: string): string {
  const s = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, "\nBloque de código.\n")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "un enlace")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "")
    .replace(/^[ \t]*\d+[.)][ \t]+/gm, "")
    .replace(/^[ \t:|-]{3,}$/gm, "")
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_row, cells: string) =>
      cells
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .join(", "),
    )
    .replace(/\|/g, ", ")
    .replace(/[*_~]+/g, "")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "");
  return s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => (/[.!?…:;]$/.test(line) ? line : `${line}.`))
    .join(" ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** Sentences grouped in chunks of at most `max` characters: browsers cut off very long utterances. */
export function splitForSpeech(text: string, max = 180): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const pieces: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) {
      pieces.push(sentence);
      continue;
    }
    // A very long sentence: cut it at commas, then at spaces.
    let rest = sentence;
    while (rest.length > max) {
      const at = Math.max(rest.lastIndexOf(", ", max), rest.lastIndexOf(" ", max));
      const cut = at > max / 3 ? at + 1 : max;
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) pieces.push(rest);
  }
  const chunks: string[] = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && last.length + p.length + 1 <= max) chunks[chunks.length - 1] = `${last} ${p}`;
    else chunks.push(p);
  }
  return chunks;
}

const ES = new Set("el la los las de que y en un una es por con para no se su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas".split(" "));
const EN = new Set("the of and to in is you that it he was for on are as with his they at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part".split(" "));

/** "es" or "en": enough to pick a voice that will not read English with a Spanish accent. */
export function guessLang(text: string): "es" | "en" {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let es = 0;
  let en = 0;
  for (const w of words.slice(0, 200)) {
    if (ES.has(w)) es++;
    if (EN.has(w)) en++;
  }
  return en >= 4 && en > es * 1.3 ? "en" : "es";
}

type VoiceInfo = { lang: string; name: string; localService?: boolean };

const REGION_RANK: Record<string, number> = { "es-ar": 0, "es-419": 1, "es-mx": 2, "es-us": 3, "es-co": 3, "es-cl": 3, "es-uy": 3, "es-es": 5 };
const QUALITY = /natural|online|neural|google|premium|enhanced/i;

/** The best installed voice for a language: Latin American Spanish first, and the higher-quality engines over the basic ones. */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[], lang: "es" | "en"): T | undefined {
  const mine = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lang));
  const score = (v: T) => {
    const code = v.lang.toLowerCase().replace("_", "-");
    const region = lang === "es" ? (REGION_RANK[code] ?? 6) : code === "en-us" ? 0 : 2;
    return region - (QUALITY.test(v.name) ? 1.5 : 0);
  };
  return [...mine].sort((a, b) => score(a) - score(b))[0];
}
