// Voice in the real UI with a fake speech engine and a fake recognizer (headless Chrome has neither): checks that dictation
// fills the box and sends, that answers are read aloud as plain text, and that the "Escuchar" button toggles.
// Needs the dev server on :3100 and uses the live model.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/";

const here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(here, "shots"), { recursive: true });
const READY = `(() => { const o = document.querySelector('[role="img"] > div[aria-hidden="true"]'); return !!o && getComputedStyle(o).opacity === '0'; })()`;
const clickLabel = (t) => `[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.textContent).includes(${JSON.stringify(t)}))?.click()`;

const FAKE = `
window.__spoken = [];
class U { constructor(t) { this.text = t; } }
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: U, configurable: true });
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
  getVoices: () => [{ name: 'Fake Elena Online (Natural)', lang: 'es-AR' }],
  cancel() { window.__spoken.push('[cancel]'); },
  speak(u) { window.__spoken.push(u.text); setTimeout(() => { for (let i = 0; i < 4; i++) setTimeout(() => u.onboundary && u.onboundary({}), i * 150); setTimeout(() => u.onend && u.onend({}), 800); }, 20); },
} });
const FakeRecognition = class {
  start() {
    setTimeout(() => this.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'cuánto es' } }] }), 200);
    setTimeout(() => { this.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'cuánto es dos más dos' } }] }); this.onend && this.onend(); }, 700);
  }
  stop() { this.onend && this.onend(); }
  abort() {}
};
window.SpeechRecognition = FakeRecognition;
window.webkitSpeechRecognition = FakeRecognition;
`;

const cdp = await launch();
try {
  await cdp.setup({ w: 1280, h: 800, dpr: 1, scheme: "light", reduced: false });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: FAKE });
  await cdp.goto(BASE);
  await cdp.waitFor(READY, 90000);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 400, y: 300 });
  await sleep(2000);
  console.log("botones:", await cdp.evalJs(`JSON.stringify({ voz: !!document.querySelector('[aria-label="Leer las respuestas en voz alta"]'), mic: !!document.querySelector('[aria-label="Dictar con la voz"]') })`));

  await cdp.evalJs(clickLabel("Leer las respuestas en voz alta"));
  await sleep(300);
  console.log("voz activada:", await cdp.evalJs(`document.querySelector('[aria-label="Leer las respuestas en voz alta"]').getAttribute('aria-pressed')`));
  await cdp.evalJs(clickLabel("Dictar con la voz"));
  await sleep(450);
  console.log("mientras escucha:", await cdp.evalJs(`JSON.stringify({ texto: document.querySelector('#msg').value, boton: document.querySelector('[aria-label="Dejar de escuchar"]') ? 'escuchando' : 'no' })`));
  await cdp.waitFor(`document.querySelectorAll('[role="log"] .msg').length >= 1 && !document.querySelector('[aria-label="Detener respuesta"]')`, 120000, 400);
  await sleep(500);
  console.log("el mensaje se envió solo:", await cdp.evalJs(`JSON.stringify([...document.querySelectorAll('[role="log"] > div')].map((d) => d.innerText.slice(0, 60)))`));
  await sleep(1500);
  console.log("leído en voz alta:", await cdp.evalJs(`JSON.stringify(window.__spoken)`));
  console.log("estado del robot mientras habla:", await cdp.evalJs(`document.querySelector('section[aria-label] span.text-sm.text-muted, header span.text-muted')?.textContent ?? 'n/a'`));

  await cdp.evalJs(`window.__spoken.length = 0`);
  await cdp.evalJs(clickLabel("Escuchar la respuesta"));
  await sleep(500);
  console.log("botón Escuchar:", await cdp.evalJs(`JSON.stringify({ hablado: window.__spoken, boton: document.querySelector('[aria-label="Detener la lectura"]') ? 'detener' : 'escuchar' })`));
  await cdp.screenshot(path.join(here, "shots", "voz.png"));
} catch (e) {
  console.log("FALLÓ:", e.message);
  await cdp.screenshot(path.join(here, "shots", "voz-fail.png")).catch(() => {});
} finally {
  const ex = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"));
  console.log("errores de consola:", ex.length ? ex.map((e) => JSON.stringify(e.params).slice(0, 200)) : "ninguno");
  cdp.close();
}
