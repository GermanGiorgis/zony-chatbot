import type { FileUIPart } from "ai";
import { fileKind, formatSize, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, SUPPORTED_LABEL, type FileKind } from "@/lib/files";

export type Attachment = {
  id: string;
  name: string;
  kind: FileKind;
  size: number;
  part: FileUIPart;
};

const MAX_IMAGE_SIDE = 1600;
const OFFICE_TYPES: Partial<Record<FileKind, string>> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
/** Images the browser can decode but Gemini can't read: re-encoded to JPEG/PNG before sending. */
const CONVERTIBLE_IMAGE = /^image\/(gif|bmp|avif|x-icon|vnd\.microsoft\.icon|tiff)$/;

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Downscales big photos (phones send 4–8 MB) so they upload fast and cost fewer tokens. */
async function shrinkImage(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const convert = CONVERTIBLE_IMAGE.test(file.type);
    if (scale === 1 && !convert && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    return await new Promise((resolve) => canvas.toBlob(resolve, type, 0.86));
  } catch {
    return null;
  }
}

/** Validates and converts picked/dropped/pasted files into chat attachments. */
export async function toAttachments(files: File[], current: Attachment[]) {
  const errors: string[] = [];
  const added: Attachment[] = [];
  let total = current.reduce((sum, a) => sum + a.size, 0);

  for (const file of files) {
    if (current.length + added.length >= MAX_FILES) {
      errors.push(`Podés adjuntar hasta ${MAX_FILES} archivos por mensaje.`);
      break;
    }
    const isImage = file.type.startsWith("image/") && file.type !== "image/svg+xml";
    let kind = fileKind(file.type, file.name);
    if (kind === "unsupported" && !CONVERTIBLE_IMAGE.test(file.type)) {
      errors.push(`"${file.name}" no es compatible. Podés enviar ${SUPPORTED_LABEL}.`);
      continue;
    }

    let blob: Blob = file;
    let mediaType = file.type;
    if (isImage) {
      const shrunk = await shrinkImage(file);
      if (shrunk) {
        blob = shrunk;
        mediaType = shrunk.type;
      }
      kind = "native";
    } else if (kind === "text") {
      mediaType = file.type || "text/plain";
    } else if (OFFICE_TYPES[kind]) {
      mediaType = OFFICE_TYPES[kind]!;
    }

    if (blob.size > MAX_FILE_BYTES) {
      errors.push(`"${file.name}" pesa ${formatSize(blob.size)}; el máximo es ${formatSize(MAX_FILE_BYTES)}.`);
      continue;
    }
    if (total + blob.size > MAX_TOTAL_BYTES) {
      errors.push(`Los adjuntos superan ${formatSize(MAX_TOTAL_BYTES)} en total.`);
      continue;
    }
    total += blob.size;
    added.push({
      id: crypto.randomUUID(),
      name: file.name,
      kind,
      size: blob.size,
      part: { type: "file", mediaType, filename: file.name, url: await readAsDataUrl(blob) },
    });
  }
  return { added, errors };
}

/** Short label for a file chip, from its extension or kind. */
export function fileBadge(name: string, mediaType: string) {
  if (mediaType === "application/pdf") return "PDF";
  if (mediaType.startsWith("audio/")) return "AUDIO";
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1];
  return ext ? ext.toUpperCase() : "ARCHIVO";
}
