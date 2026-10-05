// Edge cases in the real UI: switching conversation mid-answer (the partial answer must be saved), a failed request
// with Retry, and deleting the active conversation. Needs the dev server on :3100 and uses the live model.
// Real-UI walk through the chat in headless Chrome against the live API.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/";

const here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(here, "shots"), { recursive: true });
const shot = (n) => path.join(here, "shots", n);
const READY = `(() => { const o = document.querySelector('[role="img"] > div[aria-hidden="true"]'); return !!o && getComputedStyle(o).opacity === '0'; })()`;

const typeAndSend = async (cdp, text) => {
  await cdp.evalJs(`document.querySelector('#msg').focus()`);
  await cdp.send("Input.insertText", { text });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
};
const clickText = (t) => `[...document.querySelectorAll('button')].find((b) => (b.textContent + (b.getAttribute('aria-label')||'')).includes(${JSON.stringify(t)}))?.click()`;
const state = (cdp) =>
  cdp.evalJs(`(() => {
    const log = document.querySelector('[role="log"]');
    const msgs = [...(log?.querySelectorAll('.msg') ?? [])].map((m) => m.innerText.replace(/\\n+/g, ' ').slice(0, 90));
    return {
      msgs,
      stop: !!document.querySelector('[aria-label="Detener respuesta"]'),
      sendDisabled: document.querySelector('[aria-label="Enviar mensaje"]')?.disabled,
      overflowX: document.documentElement.scrollWidth > innerWidth,
      err: document.querySelector('[role="alert"]')?.innerText ?? null,
    };
  })()`);
const waitIdle = (cdp, t = 90000) => cdp.waitFor(`!document.querySelector('[aria-label="Detener respuesta"]') && document.querySelectorAll('[role="log"] .msg').length >= 1`, t, 400);


const dump = (cdp) => cdp.evalJs(`JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith("zony-conv")).map(([k, v]) => { try { const j = JSON.parse(v); return [k, Array.isArray(j) ? j.map((c) => ({ t: c.title, n: c.messages.length, roles: c.messages.map((m) => m.role[0] + ":" + (m.parts.find((p)=>p.type==="text")?.text ?? "").slice(0, 25)) })) : j]; } catch { return [k, v]; } })))`);
const cdp = await launch();
try {
  await cdp.setup({ w: 1280, h: 800, dpr: 1, scheme: "light", reduced: true });
  await cdp.goto(BASE);
  await cdp.waitFor(READY, 90000);
  await sleep(1500);

  // A: answer one quickly so there is an old conversation
  await typeAndSend(cdp, "Decime un número del 1 al 10, solo el número.");
  await waitIdle(cdp);
  await sleep(500);
  const firstStore = JSON.parse(await dump(cdp));
  console.log("A0 store", JSON.stringify(firstStore));

  // B: new conversation, start a long reply, switch to old conversation mid-stream
  await cdp.evalJs(clickText("Nueva conversación"));
  await sleep(400);
  await typeAndSend(cdp, "Escribí un poema largo de 30 versos sobre el mar.");
  await cdp.waitFor(`document.querySelector('[role="log"] .msg')?.innerText.length > 40`, 30000, 150);
  await cdp.evalJs(clickText("Historial"));
  await sleep(600);
  await cdp.evalJs(`(() => { const items = [...document.querySelectorAll('li')].filter(l => l.innerText.includes('número')); items[0]?.querySelector('button')?.click(); })()`);
  await sleep(1500);
  console.log("B tras cambiar", JSON.stringify(await state(cdp)));
  console.log("B store", await dump(cdp));
  await sleep(4000);
  console.log("B store +4s", await dump(cdp));

  // C: server error -> banner + retry
  await cdp.evalJs(`(() => { if (!window.__of) window.__of = window.fetch.bind(window); window.fetch = async (i, n) => { const u = typeof i === "string" ? i : i.url; if (u.includes("/api/chat")) throw new TypeError("Failed to fetch"); return window.__of(i, n); }; })()`);
  await typeAndSend(cdp, "Este mensaje va sin conexión");
  await sleep(2000);
  await cdp.screenshot(shot("ui-6-error.png"));
  console.log("C error", JSON.stringify(await state(cdp)), await cdp.evalJs(`[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).join(' / ')`));
  await cdp.evalJs(`window.fetch = window.__of`);
  await cdp.evalJs(clickText("Reintentar"));
  await sleep(500);
  await waitIdle(cdp, 60000).catch(() => {});
  await sleep(1000);
  console.log("C tras reintentar", JSON.stringify(await state(cdp)));
  console.log("C store", await dump(cdp));

  // D: delete the active conversation from the history: must not come back
  await cdp.evalJs(clickText("Historial"));
  await sleep(600);
  await cdp.evalJs(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.innerText.includes('número')); li?.querySelector('[aria-label*="liminar"]')?.click(); })()`);
  await sleep(300);
  await cdp.evalJs(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.innerText.includes('número')); [...li.querySelectorAll('button')].find(b => /liminar|orrar|Sí/.test(b.innerText + b.getAttribute('aria-label')))?.click(); })()`);
  await sleep(1200);
  console.log("D tras borrar activa", await dump(cdp), JSON.stringify(await state(cdp)));
} catch (e) {
  console.log("FALLÓ:", e.message);
  await cdp.screenshot(shot("ui-fail2.png")).catch(() => {});
} finally {
  const ex = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"));
  console.log("errores de consola:", ex.length ? ex.map((e) => JSON.stringify(e.params).slice(0, 300)) : "ninguno");
  cdp.close();
}
