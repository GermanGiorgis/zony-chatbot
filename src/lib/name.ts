/** The robot's name: "Zony" out of the box, anything the visitor types afterwards. Shared by the UI and the API route. */
export const DEFAULT_NAME = "Zony";
export const MAX_NAME_LENGTH = 24;

// Letters and digits of any script, emoji and a little punctuation. Markup, control characters and line breaks are dropped.
const DISALLOWED = new RegExp("[^\\p{L}\\p{N}\\p{Extended_Pictographic}\\u200D\\uFE0F .,'’!?&_-]", "gu");

/** Name field contents while typing: cleaned and capped, but a trailing space is kept so words can still be separated. */
export function typedName(raw: string): string {
  return [...raw.normalize("NFC").replace(DISALLOWED, "").replace(/\s+/g, " ").replace(/^ /, "")].slice(0, MAX_NAME_LENGTH).join("");
}

/** The name to store and send: the typed one, trimmed, or "Zony" when it is empty or not a string at all. */
export function cleanName(raw: unknown): string {
  return (typeof raw === "string" ? typedName(raw).trim() : "") || DEFAULT_NAME;
}
