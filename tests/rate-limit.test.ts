import assert from "node:assert/strict";
import { test } from "node:test";
import { clientKey, rateLimit } from "../src/lib/rate-limit";

test("lets 12 messages through per minute and then asks to wait", () => {
  const now = 1_000_000;
  for (let i = 0; i < 12; i++) assert.deepEqual(rateLimit("a", now + i), { ok: true });
  const blocked = rateLimit("a", now + 13);
  assert.equal(blocked.ok, false);
  assert.ok(!blocked.ok && blocked.retryAfter > 0 && blocked.retryAfter <= 60);
});

test("each visitor has their own window and it opens again after a minute", () => {
  const now = 5_000_000;
  for (let i = 0; i < 12; i++) rateLimit("b", now);
  assert.equal(rateLimit("b", now + 1).ok, false);
  assert.equal(rateLimit("c", now + 1).ok, true);
  assert.equal(rateLimit("b", now + 61_000).ok, true);
});

test("trusts the platform header before a forgeable x-forwarded-for", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/api/chat", { headers });
  assert.equal(clientKey(req({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "6.6.6.6" })), "1.1.1.1");
  assert.equal(clientKey(req({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "6.6.6.6" })), "2.2.2.2");
  assert.equal(clientKey(req({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" })), "3.3.3.3");
  assert.equal(clientKey(req({})), "local");
});
