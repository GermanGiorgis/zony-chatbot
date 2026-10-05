// Checks the conversation features in the real UI: the robot reacts to what is said, tool calls show up as chips,
// code is highlighted and "Otra respuesta" asks again. Needs the dev server on :3100 and uses the live model.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/";

const here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(here, "shots"), { recursive: true });
const shot = (n) => path.join(here, "shots", n);
const READY = `(() => { const o = document.querySelector('[role="img"] > div[aria-hidden="true"]'); return !!o && getComputedStyle(o).opacity === '0'; })()`;
const clickText = (t) => `[...document.querySelectorAll('button')].find((b) => (b.textContent + (b.getAttribute('aria-label')||'')).includes(${JSON.stringify(t)}))?.click()`;
const idle = (cdp) => cdp.waitFor(`!document.querySelector('[aria-label="Detener respuesta"]') && document.querySelectorAll('[role="log"] .msg').length >= 1`, 120000, 400);
const ask = async (cdp, text) => {
  await cdp.evalJs(`document.querySelector('#msg').focus()`);
  await cdp.send("Input.insertText", { text });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
};
const newChat = async (cdp) => { await cdp.evalJs(clickText("Nueva conversación")); await sleep(500); };
const gestures = (cdp) => cdp.evalJs(`JSON.stringify(window.__zony.log.slice())`);

const cdp = await launch();
try {
  await cdp.setup({ w: 1280, h: 800, dpr: 1, scheme: "light", reduced: false });
  await cdp.goto(BASE);
  await cdp.waitFor(READY, 90000);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 400, y: 300 });
  await sleep(2500);

  await ask(cdp, "Hola! ¿Cuánto es el 18% de 3450? Usá la calculadora.");
  await idle(cdp);
  await sleep(1500);
  console.log("herramienta:", await cdp.evalJs(`JSON.stringify([...document.querySelectorAll('[role="status"]')].map((e) => e.innerText))`));
  console.log("gestos:", await gestures(cdp));
  await cdp.screenshot(shot("f-1-herramienta.png"));

  await newChat(cdp);
  await ask(cdp, "Escribime una función en Python que sume dos números, solo el bloque de código y una línea.");
  await idle(cdp);
  await sleep(1200);
  console.log("código resaltado:", await cdp.evalJs(`JSON.stringify({ spans: document.querySelectorAll('.code-block [class*="hljs-"]').length, lang: document.querySelector('.code-head span')?.innerText })`));
  await cdp.screenshot(shot("f-2-codigo.png"));

  const before = await cdp.evalJs(`document.querySelector('[role="log"] .msg .md')?.innerText.slice(0, 80)`);
  await cdp.evalJs(clickText("Generar otra respuesta"));
  await sleep(800);
  await idle(cdp);
  await sleep(1200);
  const after = await cdp.evalJs(`document.querySelector('[role="log"] .msg .md')?.innerText.slice(0, 80)`);
  console.log("otra respuesta cambió el texto:", before !== after, "| mensajes:", await cdp.evalJs(`document.querySelectorAll('[role="log"] .msg').length`));
  console.log("botón regenerar solo en la última:", await cdp.evalJs(`document.querySelectorAll('[aria-label="Generar otra respuesta"]').length`));

  await newChat(cdp);
  await cdp.evalJs(`window.__zony.log.length = 0`);
  await ask(cdp, "Se me rompió la notebook y perdí todo mi trabajo :(");
  await idle(cdp);
  await sleep(800);
  console.log("respuesta:", await cdp.evalJs(`document.querySelector('[role="log"] .msg .md')?.innerText.slice(0, 90)`));
  console.log("gestos tras mensaje triste:", await gestures(cdp));
} catch (e) {
  console.log("FALLÓ:", e.message);
  await cdp.screenshot(shot("f-fail.png")).catch(() => {});
} finally {
  const ex = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"));
  console.log("errores de consola:", ex.length ? ex.map((e) => JSON.stringify(e.params).slice(0, 200)) : "ninguno");
  cdp.close();
}
