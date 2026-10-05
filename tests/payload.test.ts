import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessage } from "ai";
import { fitPayload } from "../src/lib/payload";

const file = (name: string, kb: number): UIMessage["parts"][number] => ({
  type: "file",
  mediaType: "application/pdf",
  filename: name,
  url: `data:application/pdf;base64,${"A".repeat(kb * 1024)}`,
});
const user = (id: string, ...parts: UIMessage["parts"]): UIMessage => ({ id, role: "user", parts });

test("a conversation that fits is returned untouched", () => {
  const messages = [user("1", { type: "text", text: "hola" }, file("a.pdf", 10))];
  assert.equal(fitPayload(messages, 1024 * 1024), messages);
});

test("the oldest attachments are replaced by a note until it fits, the newest message keeps its files", () => {
  const messages = [
    user("1", { type: "text", text: "mirá" }, file("viejo.pdf", 600)),
    { id: "2", role: "assistant", parts: [{ type: "text", text: "listo" }] } as UIMessage,
    user("3", { type: "text", text: "y este" }, file("nuevo.pdf", 600)),
  ];
  const fitted = fitPayload(messages, 800 * 1024);
  assert.equal(fitted[0].parts.some((p) => p.type === "file"), false);
  assert.match(JSON.stringify(fitted[0].parts), /viejo\.pdf/);
  assert.equal(fitted[2].parts.some((p) => p.type === "file"), true);
  assert.equal(messages[0].parts.some((p) => p.type === "file"), true, "the input is not mutated");
});
