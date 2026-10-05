// Minimal Chrome DevTools Protocol driver (no dependencies): launches a headless Chrome with a throwaway profile.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && fs.existsSync(p));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, swiftshader = false, extraArgs = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zony-chrome-"));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--mute-audio",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "about:blank",
  ];
  args.splice(args.length - 1, 0, ...extraArgs);
  if (swiftshader) args.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader");
  if (!CHROME) throw new Error("No Chrome/Edge found. Set CHROME_PATH to its executable.");
  if (!CHROME) throw new Error("No Chrome/Edge found. Set CHROME_PATH to its executable.");
  const proc = spawn(CHROME, args, { stdio: "ignore" });

  let page;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      page = targets.find((t) => t.type === "page");
    } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error("Chrome did not expose a page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) rej(new Error(`${d.error.message}`));
      else res(d.result);
    } else if (d.method) events.push(d);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");

  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  /** Viewport + color scheme + reduced motion, like the resize_window presets but with a real device pixel ratio. */
  const setup = async ({ w, h, dpr = 1, scheme = "light", reduced = true, mobile = false }) => {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile });
    await send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: scheme },
        { name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" },
      ],
    });
    if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  };

  const goto = async (url) => {
    await send("Page.navigate", { url });
    for (let i = 0; i < 100; i++) {
      if ((await evalJs("document.readyState")) === "complete") return;
      await sleep(100);
    }
  };

  const waitFor = async (expression, timeout = 60000, every = 250) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try {
        if (await evalJs(expression)) return true;
      } catch {}
      await sleep(every);
    }
    throw new Error(`timeout waiting for: ${expression}`);
  };

  const screenshot = async (file, opts = {}) => {
    const r = await send("Page.captureScreenshot", { format: "png", ...opts });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    return file;
  };

  const close = () => {
    try {
      ws.close();
    } catch {}
    try {
      execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" });
    } catch {}
    setTimeout(() => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }, 1500);
  };

  return { send, evalJs, setup, goto, waitFor, screenshot, events, close };
}
