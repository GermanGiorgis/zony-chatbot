import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanName, DEFAULT_NAME, MAX_NAME_LENGTH } from "../src/lib/name";

test("falls back to Zony for empty or non-string names", () => {
  for (const raw of ["", "   ", undefined, null, 42, {}]) assert.equal(cleanName(raw), DEFAULT_NAME);
});

test("keeps letters, digits and emoji, and drops markup and control characters", () => {
  assert.equal(cleanName("  Bot 2 🤖 "), "Bot 2 🤖");
  assert.equal(cleanName("<script>alert(1)</script>"), "scriptalert1script");
  assert.ok(!/[\u0000-\u001f]/.test(cleanName("a\nb\u0000c")));
});

test("is capped so it cannot be used to smuggle a long instruction", () => {
  assert.ok([...cleanName("x".repeat(500))].length <= MAX_NAME_LENGTH);
});
