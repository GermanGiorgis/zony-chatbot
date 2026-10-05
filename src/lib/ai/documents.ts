import JSZip from "jszip";
import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/node";
import type { FileKind } from "../files";

/** Roughly 30k tokens per document — plenty for most files, bounded for the free tier. */
export const MAX_DOC_CHARS = 120_000;
/** Office files are zips: refuse the ones that would unpack into something absurd (a zip bomb) before any parser touches them. */
const MAX_UNZIPPED_BYTES = 120 * 1024 * 1024;

async function assertReasonableZip(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  let total = 0;
  zip.forEach((_path, entry) => {
    total += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (total > MAX_UNZIPPED_BYTES) throw new Error("archivo comprimido demasiado grande");
}

export function decodeDataUrl(url: string): Buffer | null {
  const match = /^data:[^,]*?(;base64)?,([\s\S]*)$/.exec(url);
  if (!match) return null;
  try {
    return match[1] ? Buffer.from(match[2], "base64") : Buffer.from(decodeURIComponent(match[2]), "utf8");
  } catch {
    return null;
  }
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(parseInt(e.slice(e[1] === "x" ? 2 : 1), e[1] === "x" ? 16 : 10))
      : (XML_ENTITIES[e] ?? m),
  );

async function pptxText(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const slideNo = (name: string) => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNo(a) - slideNo(b));
  const out: string[] = [];
  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    const lines = xml
      .split("</a:p>")
      .map((p) => [...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""))
      .filter((line) => line.trim());
    out.push(`## Diapositiva ${slideNo(name)}\n${lines.join("\n")}`);
  }
  return out.join("\n\n");
}

async function xlsxText(bytes: Buffer) {
  const sheets = await readXlsxFile(bytes);
  const cell = (v: unknown) =>
    v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s+/g, " ");
  return sheets
    .map(({ sheet, data }) => `## Hoja: ${sheet}\n${data.map((row) => row.map(cell).join("\t")).join("\n")}`)
    .join("\n\n");
}

export async function extractText(kind: Exclude<FileKind, "native" | "unsupported">, bytes: Buffer, maxChars = MAX_DOC_CHARS) {
  if (kind === "docx" || kind === "xlsx" || kind === "pptx") await assertReasonableZip(bytes);
  const text =
    kind === "docx"
      ? (await mammoth.extractRawText({ buffer: bytes })).value
      : kind === "xlsx"
        ? await xlsxText(bytes)
        : kind === "pptx"
          ? await pptxText(bytes)
          : bytes.toString("utf8");
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > maxChars
    ? `${clean.slice(0, maxChars)}\n\n[… documento recortado: se leyeron los primeros ${maxChars.toLocaleString("es")} caracteres]`
    : clean;
}
