/** Attachment rules shared by the chat UI (validation, picker) and the API route (parsing). */

export const MAX_FILES = 5;
// Vercel Functions accept at most 4.5 MB per request and base64 adds a third: 3 MB of files leaves room for the conversation.
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024;

/**
 * - native: the model reads it directly (PDF, images, audio)
 * - text / docx / xlsx / pptx: the server extracts the text first
 */
export type FileKind = "native" | "text" | "docx" | "xlsx" | "pptx" | "unsupported";

const NATIVE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

const OFFICE = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

const TEXT_TYPES = /^(text\/.+|application\/(json|x-ndjson|xml|yaml|x-yaml|toml|javascript|x-javascript|typescript|x-typescript|x-sh|sql|x-python|x-httpd-php|x-tex|rtf))$/;

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|mdx|csv|tsv|json|jsonl|xml|ya?ml|toml|ini|cfg|conf|log|html?|css|scss|less|js|jsx|mjs|cjs|ts|tsx|py|java|kt|kts|scala|c|h|cc|cpp|hpp|cs|go|rs|rb|php|swift|sql|sh|bash|zsh|bat|ps1|r|lua|dart|vue|svelte|astro|gradle|properties|tex|rtf|srt|vtt|svg)$/i;

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function fileKind(mediaType: string, filename = ""): FileKind {
  const type = mediaType.toLowerCase();
  const name = filename.toLowerCase();
  if (NATIVE_TYPES.has(type)) return "native";
  if (type === OFFICE.docx || name.endsWith(".docx")) return "docx";
  if (type === OFFICE.xlsx || name.endsWith(".xlsx")) return "xlsx";
  if (type === OFFICE.pptx || name.endsWith(".pptx")) return "pptx";
  if (TEXT_TYPES.test(type) || TEXT_EXTENSIONS.test(name)) return "text";
  return "unsupported";
}

/** Value for the file picker's `accept` attribute. */
export const ACCEPT_ATTR = [
  "application/pdf",
  "image/*",
  "audio/*",
  ".docx",
  ".xlsx",
  ".pptx",
  ".txt,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sql,.sh,.log",
].join(",");

export const SUPPORTED_LABEL = "PDF, Word, Excel, PowerPoint, imágenes, audio y archivos de texto o código";
