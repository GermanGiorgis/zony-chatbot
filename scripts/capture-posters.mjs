/**
 * Regenerates the stage poster frames in public/zony/ from the real 3D scene (see src/components/chat/StagePoster.tsx).
 * Run it whenever the default look of Zony changes, otherwise the first paint shows a robot that no longer exists.
 *
 * Needs the dev server running (it drives window.__zony, which only exists in development) and a local Chrome or Edge:
 *
 *   npm run dev                       # one terminal
 *   npm run posters                   # another (http://localhost:3000)
 *   npm run posters -- http://localhost:3100
 *
 * Set CHROME_PATH if the browser is somewhere unusual.
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const URL = process.argv[2] ?? "http://localhost:3000/";
const OUT = path.join(process.cwd(), "public", "zony");
const PORT = 9333;

// The robot is a full-bleed background, so each poster is the live camera's default framing at a typical viewport
// (object-fit: cover crops it to any similar screen). "tall" = desktop/landscape (>= 1024px), "wide" = phones and tablets.
const VARIANTS = [
  { name: "tall-dark", w: 1456, h: 900, scheme: "dark", focus: null },
  { name: "tall-light", w: 1456, h: 900, scheme: "light", focus: null },
  { name: "wide-dark", w: 700, h: 1000, scheme: "dark", focus: null },
  { name: "wide-light", w: 700, h: 1000, scheme: "light", focus: null },
];

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) throw new Error("No Chrome/Edge found. Set CHROME_PATH to its executable.");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zony-posters-"));
const proc = spawn(
  chrome,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--mute-audio",
    "about:blank",
  ],
  { stdio: "ignore" },
);

function stop(ws) {
  try {
    ws?.close();
  } catch {}
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" });
    else proc.kill("SIGKILL");
  } catch {}
  setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 1500);
}

let ws;
try {
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      page = targets.find((t) => t.type === "page");
    } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error("The browser did not expose a debugging page.");

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (!d.id || !pending.has(d.id)) return;
    const { resolve, reject } = pending.get(d.id);
    pending.delete(d.id);
    if (d.error) reject(new Error(d.error.message));
    else resolve(d.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const run = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "page error");
    return r.result.value;
  };
  const waitFor = async (expression, timeout = 90000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        if (await run(expression)) return;
      } catch {}
      await sleep(250);
    }
    throw new Error(`Timed out waiting for the 3D stage (${URL}). Is the dev server running?`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  fs.mkdirSync(OUT, { recursive: true });

  for (const v of VARIANTS) {
    await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: false });
    await send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: v.scheme },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
    await send("Page.navigate", { url: URL });
    // The overlay on top of the canvas fades out once the scene has rendered its first frames.
    await waitFor(`(() => { const o = document.querySelector('[role="img"] > div[aria-hidden="true"]'); return !!o && getComputedStyle(o).opacity === '0'; })()`);
    await sleep(2500);
    if (v.focus) {
      if (!(await run("typeof window.__zony === 'object'"))) throw new Error("window.__zony is missing: run this against `npm run dev`.");
      await run(`window.__zony.focus(${JSON.stringify(v.focus)})`);
      await sleep(3500); // let the camera settle
    }
    // Zony blinks now and then and a poster with closed eyes looks broken: take a few frames and keep the one with the
    // most cyan eye glow in the head area (the top of the canvas; the floor disc in the tall dark scene is below it).
    const share = v.focus ? 0.45 : 0.6;
    let best = { blue: -1, url: "" };
    for (let i = 0; i < 8; i++) {
      const frame = await run(`new Promise((resolve) => requestAnimationFrame(() => {
        const c = document.querySelector('canvas');
        const url = c.toDataURL('image/webp', 0.86);
        const t = document.createElement('canvas');
        t.width = c.width;
        t.height = Math.floor(c.height * ${share});
        const ctx = t.getContext('2d');
        ctx.drawImage(c, 0, 0);
        const d = ctx.getImageData(0, 0, t.width, t.height).data;
        let blue = 0;
        for (let p = 0; p < d.length; p += 4) if (d[p + 2] > 140 && d[p + 2] > d[p] + 60) blue++;
        resolve({ url, blue });
      }))`);
      if (frame.blue > best.blue) best = frame;
      await sleep(350);
    }
    const file = path.join(OUT, `stage-${v.name}.webp`);
    fs.writeFileSync(file, Buffer.from(best.url.split(",")[1], "base64"));
    console.log(`${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB  (eye glow ${best.blue}px)`);
  }
} finally {
  stop(ws);
}
