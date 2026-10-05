// Loads the page in Chrome with WebGL disabled: the chat must work and the poster must replace the 3D robot.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/";
const here = path.dirname(fileURLToPath(import.meta.url));
const cdp = await launch({ extraArgs: ["--disable-3d-apis", "--disable-gpu", "--disable-webgl"] });
try {
  await cdp.setup({ w: 1280, h: 800, dpr: 1, scheme: "light", reduced: true });
  await cdp.goto(BASE);
  await sleep(6000);
  console.log(await cdp.evalJs(`JSON.stringify({ h1: document.querySelector('h1')?.innerText, canvas: !!document.querySelector('canvas'), msg: !!document.querySelector('#msg'), poster: !!document.querySelector('picture img'), hasGl: (()=>{try{return !!document.createElement('canvas').getContext('webgl2')}catch{return false}})() })`));
  fs.mkdirSync(path.join(here, "shots"), { recursive: true });
  await cdp.screenshot(path.join(here, "shots", "nogl.png"));
  // chat still works?
  await cdp.evalJs(`document.querySelector('#msg').focus()`);
  await cdp.send("Input.insertText", { text: "hola" });
  console.log(await cdp.evalJs(`document.querySelector('#msg').value`));
} finally { cdp.close(); }
