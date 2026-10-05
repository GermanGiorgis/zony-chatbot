/**
 * Per-IP sliding window kept in memory. On serverless it is per instance, so it is a soft guard
 * that keeps one visitor from spending the whole free model quota — not a hard security control.
 */

const PER_MINUTE = 12;
const PER_DAY = 200;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const hits = new Map<string, number[]>();

export function rateLimit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < DAY);
  const lastMinute = recent.filter((t) => now - t < MINUTE);

  if (lastMinute.length >= PER_MINUTE) {
    return { ok: false, retryAfter: Math.ceil((lastMinute[0] + MINUTE - now) / 1000) };
  }
  if (recent.length >= PER_DAY) {
    return { ok: false, retryAfter: Math.ceil((recent[0] + DAY - now) / 1000) };
  }

  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, list] of hits) if (now - list[list.length - 1] > DAY) hits.delete(k);
  }
  return { ok: true };
}

/**
 * Who is calling. On Vercel the platform sets the first two headers itself (a visitor cannot forge them); a plain
 * x-forwarded-for is only trusted as a last resort, since anyone can send it when nothing in front rewrites it.
 */
export function clientKey(req: Request) {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}
