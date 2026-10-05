// Screenshots the robot standing in each background (dark and light), to eyeball lighting and framing.
// Needs the dev server (default http://localhost:3100) and Chrome; output goes to scripts/qa/shots/scene-<id>-<scheme>.png.
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/";
const IDS = ["arcos", "hexagonos", "pasillo", "triangulo", "nucleo", "portal"];
const cdp = await launch({ port: 9344 });
try {
  for (const scheme of ["dark", "light"]) {
    await cdp.setup({ w: 1456, h: 900, dpr: 1, scheme });
    for (const id of IDS) {
      await cdp.goto(BASE);
      await cdp.evalJs(`localStorage.setItem("zony-appearance-v2", JSON.stringify({ background: "${id}" }))`);
      await cdp.goto(BASE);
      await cdp.waitFor(`(() => { const o = document.querySelector('[role="img"] > div[aria-hidden="true"]'); return !o || getComputedStyle(o).opacity === '0'; })()`);
      await sleep(2500);
      await cdp.screenshot(`scripts/qa/shots/scene-${id}-${scheme}.png`);
      console.log("ok", id, scheme);
    }
  }
} finally {
  cdp.close();
}
