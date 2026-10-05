// Phone-sized walk through the real UI (390x844, touch): start screen, a message, the customizer and the history.
// Needs the dev server on :3100. Screenshots go to scripts/qa/shots (ignored by git).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/";

const here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(here, "shots"), { recursive: true });
const shot = (n) => path.join(here, "shots", n);
const READY = `(() => { const o = document.querySelector('[role="img"] > div[aria-hidden="true"]'); return !!o && getComputedStyle(o).opacity === '0'; })()`;
const W = Number(process.argv[2] ?? 390), H = Number(process.argv[3] ?? 844);
const clickText = (t) => `[...document.querySelectorAll('button')].find((b) => (b.textContent + (b.getAttribute('aria-label')||'')).includes(${JSON.stringify(t)}))?.click()`;
const metrics = (cdp) => cdp.evalJs(`JSON.stringify({ overflowX: document.documentElement.scrollWidth > innerWidth, canvas: !!document.querySelector('canvas'), card: (() => { const r = document.querySelector('h1')?.closest('div')?.getBoundingClientRect(); return r ? Math.round(r.top) + '-' + Math.round(r.bottom) : null })(), composerTop: Math.round(document.querySelector('#msg')?.getBoundingClientRect().top) })`);

const cdp = await launch();
try {
  await cdp.setup({ w: W, h: H, dpr: 2, scheme: "light", reduced: true, mobile: true });
  await cdp.goto(BASE);
  await cdp.waitFor(READY, 90000);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 300 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(3000);
  await cdp.screenshot(shot("m-1-inicio.png"));
  console.log("inicio", await metrics(cdp));

  await cdp.evalJs(`document.querySelector('#msg').focus()`);
  await cdp.send("Input.insertText", { text: "Hola! Decime en una línea qué es un algoritmo." });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await cdp.waitFor(`!document.querySelector('[aria-label="Detener respuesta"]') && document.querySelectorAll('[role="log"] .msg').length >= 1`, 90000, 400);
  await sleep(1500);
  await cdp.screenshot(shot("m-2-respuesta.png"));
  console.log("respuesta", await metrics(cdp));

  await cdp.evalJs(clickText("Personalizar"));
  await sleep(1500);
  await cdp.screenshot(shot("m-3-personalizar.png"));
  await cdp.evalJs(`document.getElementById('creator-tab-background')?.click()`);
  await sleep(2500);
  await cdp.screenshot(shot("m-4-fondos.png"));
  console.log("personalizar", await metrics(cdp));
  await cdp.evalJs(clickText("Listo"));
  await sleep(1200);

  await cdp.evalJs(clickText("Abrir historial"));
  await sleep(900);
  await cdp.screenshot(shot("m-5-historial.png"));
} finally {
  const ex = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"));
  console.log("errores de consola:", ex.length ? ex.map((e) => JSON.stringify(e.params).slice(0, 200)) : "ninguno");
  cdp.close();
}
