/**
 * Usage events as one JSON line each in the server log (Vercel keeps and filters them), with no message text, file names
 * or anything else a visitor wrote: only counts and kinds. Enough to know whether anyone tries the chat, attaches files or
 * hits the limits, without a database or a third-party script.
 *
 *   {"zony":"chat","t":"2026-10-01T12:00:00.000Z","messages":3,"files":1,"link":false,"renamed":true}
 */
export function track(event: string, props: Record<string, string | number | boolean | undefined> = {}) {
  console.log(JSON.stringify({ zony: event, t: new Date().toISOString(), ...props }));
}
