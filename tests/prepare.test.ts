import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessage } from "ai";
import { MAX_FILE_BYTES, MAX_FILES } from "../src/lib/files";
import { linksIn, prepareMessages, textOf } from "../src/lib/ai/prepare";

const dataUrl = (bytes: Buffer, type: string) => `data:${type};base64,${bytes.toString("base64")}`;
const user = (parts: UIMessage["parts"]): UIMessage => ({ id: crypto.randomUUID(), role: "user", parts });
const file = (name: string, bytes: Buffer, mediaType: string): UIMessage["parts"][number] => ({ type: "file", mediaType, filename: name, url: dataUrl(bytes, mediaType) });
const texts = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : `<${p.type}>`)).join("|");

test("turns text files into a <documento> block and keeps what the visitor typed", async () => {
  const [m] = await prepareMessages([user([file("nota.txt", Buffer.from("leche y pan"), "text/plain"), { type: "text", text: "¿qué compro?" }])]);
  assert.match(texts(m), /<documento nombre="nota.txt">\nleche y pan\n<\/documento>/);
  assert.match(texts(m), /¿qué compro\?/);
});

test("replaces unsupported, empty and oversized files with a short note instead of failing", async () => {
  const [m] = await prepareMessages([
    user([
      file("raro.exe", Buffer.from("MZ"), "application/x-msdownload"),
      file("vacio.png", Buffer.alloc(0), "image/png"),
      file("enorme.txt", Buffer.alloc(MAX_FILE_BYTES + 1), "text/plain"),
      { type: "text", text: "mirá" },
    ]),
  ]);
  const t = texts(m);
  assert.match(t, /raro\.exe.*no tiene un formato compatible/);
  assert.match(t, /vacio\.png.*vacío/);
  assert.match(t, /enorme\.txt.*máximo por archivo/);
  assert.ok(!t.includes("<file>"));
});

test("only the first MAX_FILES attachments of a message are read", async () => {
  const files = Array.from({ length: MAX_FILES + 2 }, (_, i) => file(`f${i}.txt`, Buffer.from(`contenido ${i}`), "text/plain"));
  const [m] = await prepareMessages([user([...files, { type: "text", text: "todos" }])]);
  assert.equal((texts(m).match(/<documento /g) ?? []).length, MAX_FILES);
  assert.match(texts(m), /podés adjuntar hasta 5 archivos/);
});

test("caps the text taken from documents across the whole conversation, newest first", async () => {
  const big = Buffer.from("palabra ".repeat(11_000)); // ~88k characters each
  const turn = () => user([file("libro.txt", big, "text/plain"), { type: "text", text: "resumí" }]);
  const prepared = await prepareMessages([turn(), turn(), turn(), turn()]);
  const read = prepared.filter((m) => texts(m).includes("<documento")).length;
  const skipped = prepared.filter((m) => texts(m).includes("demasiado texto de documentos")).length;
  assert.equal(read + skipped, 4);
  assert.ok(skipped >= 1, "the oldest documents are dropped once the budget is spent");
  assert.ok(texts(prepared[prepared.length - 1]).includes("<documento"), "the newest one is always read");
});

test("cuts an absurdly long message and says so", async () => {
  const [m] = await prepareMessages([user([{ type: "text", text: "a".repeat(100_000) }])]);
  assert.ok(textOf(m).length < 31_000);
  assert.match(textOf(m), /mensaje recortado/);
});

test("starts the window on a user turn and keeps only the text of assistant turns", async () => {
  const assistant: UIMessage = { id: "a", role: "assistant", parts: [{ type: "text", text: "hola" }, { type: "step-start" }] };
  const prepared = await prepareMessages([assistant, user([{ type: "text", text: "uno" }]), assistant, user([{ type: "text", text: "dos" }])]);
  assert.deepEqual(prepared.map((m) => m.role), ["user", "assistant", "user"]);
  assert.deepEqual(prepared[1].parts, [{ type: "text", text: "hola" }]);
});

test("separates YouTube links (sent as video) from web pages (read as text)", () => {
  const m = user([{ type: "text", text: "mirá https://youtu.be/dQw4w9WgXcQ y https://example.com/nota" }]);
  const { youtube, web } = linksIn(m);
  assert.equal(youtube, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.deepEqual(web, ["https://example.com/nota"]);
});
