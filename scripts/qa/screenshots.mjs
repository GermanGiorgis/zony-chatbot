// Takes the pictures used in the README (docs/screenshots/*.webp) from the real app.
// Needs the dev server (BASE_URL, default http://localhost:3100/), Chrome, and a Gemini key: two of the shots are real answers.
//   node scripts/qa/screenshots.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/";
const OUT = path.join(process.cwd(), "docs", "screenshots");
const TMP = path.join(process.cwd(), "scripts", "qa", "shots");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const READY = `(() => { const o = document.querySelector('[role="img"] > div[aria-hidden="true"]'); return !o || getComputedStyle(o).opacity === '0'; })()`;
const IDLE = `!document.querySelector('[aria-label="Detener respuesta"]') && document.querySelectorAll('[role="log"] .msg').length >= 1`;
const clickText = (t) => `[...document.querySelectorAll('button')].find((b) => (b.textContent + (b.getAttribute('aria-label')||'')).includes(${JSON.stringify(t)}))?.click()`;
const APPEARANCE = "zony-appearance-v2";

const MAGE = { head: "brain", torso: "crystal", arms: "crystal", legs: "crystal", outfit: "mage", hat: "wizard", glasses: "round", shell: "#e6e0ff", muscle: "#1b1530", metal: "#b9a6ff", glow: "#b983ff", finish: "frosted" };

const cdp = await launch({ port: 9377 });

async function open({ w, h, dpr, scheme, mobile = false, appearance = null }) {
  await cdp.setup({ w, h, dpr, scheme, reduced: false, mobile });
  await cdp.goto(BASE);
  await cdp.evalJs(`localStorage.clear(); ${appearance ? `localStorage.setItem(${JSON.stringify(APPEARANCE)}, ${JSON.stringify(JSON.stringify(appearance))});` : ""}`);
  await cdp.goto(BASE);
  await cdp.waitFor(READY, 90000);
  await sleep(3500);
}

async function say(text) {
  await cdp.evalJs(`document.querySelector('#msg').focus()`);
  await cdp.send("Input.insertText", { text });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await sleep(1500);
  await cdp.waitFor(IDLE, 90000, 400);
  await sleep(2500);
}

async function shot(name, { quality = 84 } = {}) {
  const png = path.join(TMP, `${name}.png`);
  await cdp.screenshot(png);
  await sharp(png).webp({ quality, effort: 5 }).toFile(path.join(OUT, `${name}.webp`));
  console.log("ok", name);
  return png;
}

/** A phone picture with rounded corners. */
const phone = async (png) => {
  const { width, height } = await sharp(png).metadata();
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${Math.round(width * 0.09)}"/></svg>`);
  return sharp(png).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
};

try {
  const desktop = { w: 1456, h: 900, dpr: 1.5 };

  await open({ ...desktop, scheme: "dark" });
  await shot("inicio-oscuro");

  await open({ ...desktop, scheme: "light" });
  await shot("inicio-claro");

  await open({ ...desktop, scheme: "dark" });
  await say("Escribime en Python una función que invierta un texto, con una explicación de dos líneas nada más.");
  await shot("chat-codigo");

  await open({ ...desktop, scheme: "dark" });
  await say("¿Cuánto es el 18% de 3450 y qué clima hace hoy en Buenos Aires?");
  await shot("chat-herramientas");

  await open({ ...desktop, scheme: "dark", appearance: { background: "portal", ...MAGE } });
  await cdp.evalJs(clickText("Personalizar"));
  await sleep(2500);
  await shot("personalizador");

  // The six backgrounds, each with the robot standing in it.
  const tiles = [];
  for (const id of ["arcos", "hexagonos", "pasillo", "triangulo", "nucleo", "portal"]) {
    await open({ w: 1456, h: 900, dpr: 1, scheme: "dark", appearance: { background: id } });
    const png = path.join(TMP, `fondo-${id}.png`);
    await cdp.screenshot(png);
    tiles.push(await sharp(png).resize(640, 396).toBuffer());
  }
  await sharp({ create: { width: 1920 + 24, height: 792 + 12, channels: 3, background: "#0b0d12" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 3) * 652, top: Math.floor(i / 3) * 408 })))
    .webp({ quality: 84 })
    .toFile(path.join(OUT, "fondos.webp"));
  console.log("ok fondos");

  // Phone: the start screen and a conversation, side by side.
  const mobile = { w: 390, h: 844, dpr: 2, mobile: true, scheme: "dark" };
  await open(mobile);
  const a = await phone(await shot("movil-inicio"));
  await say("Hola! Decime en una línea qué es un algoritmo.");
  const b = await phone(await shot("movil-chat"));
  await sharp({ create: { width: 780 * 2 + 120, height: 1688 + 80, channels: 3, background: "#0b0d12" } })
    .composite([{ input: a, left: 40, top: 40 }, { input: b, left: 780 + 80, top: 40 }])
    .webp({ quality: 82 })
    .toFile(path.join(OUT, "movil.webp"));
  fs.rmSync(path.join(OUT, "movil-inicio.webp"));
  fs.rmSync(path.join(OUT, "movil-chat.webp"));
  console.log("ok movil");
} finally {
  cdp.close();
}
