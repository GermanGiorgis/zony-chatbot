// Walks the real chat UI in headless Chrome: send, answer, reload (restored), new conversation, history, stop.
// Needs the dev server on :3100 and uses the live model. Screenshots go to scripts/qa/shots (ignored by git).
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

const cdp = await launch();
const errors = [];
try {
  await cdp.setup({ w: 1280, h: 800, dpr: 1, scheme: "light", reduced: false });
  await cdp.goto(BASE);
  await cdp.waitFor(READY, 90000);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 400, y: 300 });
  await sleep(2500);
  await cdp.screenshot(shot("ui-1-inicio.png"));
  console.log("inicio", JSON.stringify(await state(cdp)));

  // 1. normal message
  await typeAndSend(cdp, "Hola! Decime en una línea qué es un algoritmo.");
  await sleep(1200);
  console.log("enviando", JSON.stringify(await state(cdp)));
  await waitIdle(cdp);
  await sleep(1500);
  await cdp.screenshot(shot("ui-2-respuesta.png"));
  console.log("respuesta", JSON.stringify(await state(cdp)));

  // 2. reload => restores
  await cdp.goto(BASE);
  await cdp.waitFor(READY, 90000);
  await sleep(1500);
  console.log("tras recargar", JSON.stringify(await state(cdp)));

  // 3. new conversation + second message with code
  await cdp.evalJs(clickText("Nueva conversación"));
  await sleep(600);
  console.log("nueva", JSON.stringify(await state(cdp)));
  await typeAndSend(cdp, "Dame un ejemplo mínimo de un for en JavaScript, con bloque de código.");
  await waitIdle(cdp);
  await sleep(1200);
  await cdp.screenshot(shot("ui-3-codigo.png"));
  console.log("codigo", JSON.stringify(await state(cdp)));

  // 4. history
  await cdp.evalJs(clickText("Historial"));
  await sleep(700);
  await cdp.screenshot(shot("ui-4-historial.png"));
  console.log("historial", await cdp.evalJs(`[...document.querySelectorAll('[role="dialog"] li, aside li')].map(l=>l.innerText.replace(/\\n+/g,' | ').slice(0,80))`));
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(500);

  // 5. stop button mid-stream
  await cdp.evalJs(clickText("Nueva conversación"));
  await sleep(500);
  await typeAndSend(cdp, "Escribí un cuento largo de 400 palabras sobre un robot.");
  await cdp.waitFor(`!!document.querySelector('[aria-label="Detener respuesta"]')`, 20000, 100);
  await sleep(2500);
  await cdp.evalJs(clickText("Detener respuesta"));
  await sleep(1500);
  console.log("tras detener", JSON.stringify(await state(cdp)));
  await cdp.screenshot(shot("ui-5-detenido.png"));
} catch (e) {
  console.log("FALLÓ:", e.message);
  await cdp.screenshot(shot("ui-fail.png")).catch(() => {});
} finally {
  const ex = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"));
  for (const e of ex) errors.push(JSON.stringify(e.params).slice(0, 300));
  console.log("errores de consola:", errors.length ? errors : "ninguno");
  cdp.close();
}
