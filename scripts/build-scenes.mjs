/**
 * Draws the six stage backgrounds in public/zony/scenes/ from code: no photographs, no third-party images.
 * Every scene is a small 3D description (neon frames, light strips, a hex floor...) projected with a pinhole camera into
 * an SVG, which sharp rasterises. For each scene it writes:
 *
 *   <id>.webp        2560x1440 picture the 3D stage puts behind the robot (see src/components/robot/Scene.tsx)
 *   <id>-thumb.webp  thumbnail for the customizer
 *   <id>-env.jpg     tiny equirectangular probe: what the robot's glossy parts reflect
 *
 *   npm run scenes
 *
 * Needs `sharp` (it ships with Next.js). The stage camera looks level from about waist height, so the horizon sits at 50%
 * and the floor below it, at a matching eye height, is where the robot stands (feet around 70% of the screen).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "zony", "scenes");
const W = 2560;
const H = 1440;
const F = 1500; // focal length in px
const CX = W / 2;
const CY = Math.round(H * 0.5); // horizon: the stage camera looks level, so it sits mid-screen
const EYE = 0.65; // camera height in world units (metres, roughly): the stage camera is about waist-high on the robot

const project = ([x, y, z]) => [CX + (F * x) / z, CY - (F * (y - EYE)) / z];
const r1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ element helpers */

/** A polyline in 3D (frames, rings, columns): constant stroke width, set in world units at the polyline's depth. */
const poly = (pts, color, core, w, closed = false) => ({ type: "poly", pts, color, core, w, closed });
/** A line running into the distance, drawn as a quad so it narrows with perspective. dir = which way it is thick. */
const lane = (a, b, color, core, w, dir) => ({ type: "lane", a, b, color, core, w, dir });
/** A frame at depth z: polygon in the XY plane. */
const frame = (z, pts, color, core, w, closed = false) => poly(pts.map(([x, y]) => [x, y, z]), color, core, w, closed);
const ring = (z, cy, radius, color, core, w, steps = 96) =>
  poly(Array.from({ length: steps + 1 }, (_, i) => [Math.cos((i / steps) * Math.PI * 2) * radius, cy + Math.sin((i / steps) * Math.PI * 2) * radius, z]), color, core, w);
const range = (from, to, step) => {
  const out = [];
  for (let v = from; v <= to + 1e-6; v += step) out.push(v);
  return out;
};
const geometric = (from, ratio, count) => Array.from({ length: count }, (_, i) => from * ratio ** i);

function runs(e, mirror) {
  const pts = e.closed ? [...e.pts, e.pts[0]] : e.pts;
  const out = [];
  let run = [];
  for (const [x, y, z] of pts) {
    if (y < -1e-6) {
      if (run.length > 1) out.push(run);
      run = [];
      continue;
    }
    run.push([x, mirror ? -y : y, z]);
  }
  if (run.length > 1) out.push(run);
  return out;
}

/** SVG for a list of elements. `core` draws the thin bright centre instead of the coloured body. */
function draw(elements, { core = false, mirror = false } = {}) {
  let svg = "";
  for (const e of elements) {
    const color = core ? e.core : e.color;
    const k = core ? 0.32 : 1;
    if (e.type === "poly") {
      for (const run of runs(e, mirror)) {
        const z = run.reduce((s, p) => s + p[2], 0) / run.length;
        const width = Math.max(core ? 1 : 1.6, e.w * k * (F / z));
        const d = run.map((p, i) => `${i ? "L" : "M"}${project(p).map(r1).join(" ")}`).join("");
        svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${r1(width)}" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
    } else {
      const a = mirror ? [e.a[0], -e.a[1], e.a[2]] : e.a;
      const b = mirror ? [e.b[0], -e.b[1], e.b[2]] : e.b;
      if (a[1] < -1e-6 || b[1] < -1e-6) continue;
      const pa = project(a);
      const pb = project(b);
      const ha = Math.max(core ? 0.5 : 0.8, (e.w * k * F) / a[2] / 2);
      const hb = Math.max(core ? 0.5 : 0.8, (e.w * k * F) / b[2] / 2);
      const [dx, dy] = e.dir === "x" ? [1, 0] : [0, 1];
      const q = [
        [pa[0] - dx * ha, pa[1] - dy * ha],
        [pa[0] + dx * ha, pa[1] + dy * ha],
        [pb[0] + dx * hb, pb[1] + dy * hb],
        [pb[0] - dx * hb, pb[1] - dy * hb],
      ];
      svg += `<polygon points="${q.map((p) => p.map(r1).join(",")).join(" ")}" fill="${color}"/>`;
    }
  }
  return svg;
}

/* ------------------------------------------------------------------ scenes */

const SCENES = {
  // Concentric neon arches over a dark glossy floor.
  arcos: () => {
    const shape = [[-3.7, 0], [-3.7, 2.9], [0, 4.3], [3.7, 2.9], [3.7, 0]];
    const arches = geometric(2.7, 1.55, 7).map((z) => frame(z, shape, "#2f66ff", "#b8d2ff", 0.09));
    const tiles = [
      ...range(-12, 12, 1.2).map((x) => lane([x, 0, 1.3], [x, 0, 60], "#2a4fb8", "#2a4fb8", 0.012, "x")),
      ...geometric(1.5, 1.28, 14).map((z) => poly([[-12, 0, z], [12, 0, z]], "#2a4fb8", "#2a4fb8", 0.012)),
    ];
    return {
      sky: ["#02030a", "#040a22"],
      floor: ["#060b1c", "#020408"],
      haze: ["#1f46d8", 0.32],
      faint: tiles,
      faintOpacity: 0.28,
      neon: arches,
    };
  },

  // Violet hex floor and pillars of light.
  hexagonos: () => {
    const s = 0.85;
    const hexes = [];
    for (let r = 0; r < 60; r++) {
      for (let q = -22; q <= 22; q++) {
        const cx = s * Math.sqrt(3) * (q + r / 2);
        const cz = 1.9 + s * 1.5 * r;
        if (Math.abs(cx) > 16) continue;
        const corners = range(0, 5, 1).map((i) => {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          return [cx + s * 0.94 * Math.cos(a), 0, cz + s * 0.94 * Math.sin(a)];
        });
        hexes.push(poly(corners, "#8a5cff", "#8a5cff", 0.03, true));
      }
    }
    const pillars = range(3, 40, 4.2).flatMap((z) => [-4.2, 4.2].map((x) => poly([[x, 0, z], [x, 5.4, z]], "#9a6bff", "#e4d6ff", 0.2)));
    const top = [-4.2, 4.2].map((x) => lane([x, 5.4, 1.4], [x, 5.4, 60], "#6c3bff", "#cdb8ff", 0.1, "y"));
    return {
      sky: ["#06020f", "#12062e"],
      floor: ["#12062c", "#05010d"],
      haze: ["#7a45ff", 0.42],
      faint: hexes,
      faintOpacity: 0.5,
      neon: [...pillars, ...top],
    };
  },

  // Ship corridor: orange and blue light strips along the walls.
  pasillo: () => {
    const half = 3.3;
    const neon = [];
    for (const side of [-1, 1]) {
      neon.push(lane([side * half, 0.35, 1.3], [side * half, 0.35, 60], "#ff8a2a", "#ffe0b8", 0.12, "y"));
      neon.push(lane([side * half, 2.7, 1.3], [side * half, 2.7, 60], "#3f8cff", "#d0e4ff", 0.08, "y"));
      for (const z of range(2.4, 44, 3.2)) neon.push(poly([[side * half, 0.5, z], [side * half, 2.5, z]], "#ff7a1a", "#ffd2a0", 0.09));
    }
    const faint = [
      ...range(-3, 3, 1.5).map((x) => lane([x, 0, 1.3], [x, 0, 60], "#3a4a7a", "#3a4a7a", 0.012, "x")),
      ...geometric(1.5, 1.3, 12).map((z) => poly([[-3.3, 0, z], [3.3, 0, z]], "#3a4a7a", "#3a4a7a", 0.012)),
    ];
    // Far end: a lit doorway.
    const door = frame(48, [[-1.3, 0], [-1.3, 2.4], [1.3, 2.4], [1.3, 0]], "#ff9a4d", "#fff0dc", 0.2);
    return { sky: ["#05070f", "#0d1226"], floor: ["#0b1020", "#03050b"], haze: ["#ff8a3a", 0.28], faint, faintOpacity: 0.4, neon: [...neon, door] };
  },

  // Grey tunnel of white triangles.
  triangulo: () => {
    const shape = [[-3.6, 0], [0, 5.8], [3.6, 0]];
    const inner = shape.map(([x, y]) => [x * 0.84, y * 0.84]);
    const tris = geometric(2.8, 1.5, 7).flatMap((z) => [frame(z, shape, "#dfe8ff", "#ffffff", 0.07), frame(z, inner, "#9db4ff", "#ffffff", 0.035)]);
    const faint = [
      ...range(-10, 10, 1.2).map((x) => lane([x, 0, 1.3], [x, 0, 60], "#8a93a8", "#8a93a8", 0.012, "x")),
      ...geometric(1.5, 1.28, 14).map((z) => poly([[-10, 0, z], [10, 0, z]], "#8a93a8", "#8a93a8", 0.012)),
    ];
    return { sky: ["#0a0b0e", "#1b1e25"], floor: ["#171a21", "#050608"], haze: ["#c8d4ff", 0.36], faint, faintOpacity: 0.32, neon: tris };
  },

  // Cyan and magenta square frames meeting in a bright core.
  nucleo: () => {
    const box = [[-3.1, 0], [-3.1, 4.4], [3.1, 4.4], [3.1, 0]];
    const frames = geometric(2.6, 1.42, 8).map((z, i) => frame(z, box, i % 2 ? "#ff3fd8" : "#2fe0ff", i % 2 ? "#ffd0f6" : "#d0f8ff", 0.08));
    const corners = [
      lane([-3.1, 0, 1.3], [-3.1, 0, 60], "#2fe0ff", "#d0f8ff", 0.08, "x"),
      lane([3.1, 0, 1.3], [3.1, 0, 60], "#ff3fd8", "#ffd0f6", 0.08, "x"),
      lane([-3.1, 4.4, 1.3], [-3.1, 4.4, 60], "#ff3fd8", "#ffd0f6", 0.08, "y"),
      lane([3.1, 4.4, 1.3], [3.1, 4.4, 60], "#2fe0ff", "#d0f8ff", 0.08, "y"),
    ];
    const cross = [poly([[-3.1, 2.2, 52], [3.1, 2.2, 52]], "#ffffff", "#ffffff", 0.2), poly([[0, 0, 52], [0, 4.4, 52]], "#ffffff", "#ffffff", 0.2)];
    return { sky: ["#05020e", "#0e0420"], floor: ["#0c0420", "#030108"], haze: ["#d84dff", 0.4], faint: [], faintOpacity: 0, neon: [...frames, ...corners, ...cross] };
  },

  // Glowing rings: a tunnel that burns at the end.
  portal: () => {
    const rings = geometric(2.7, 1.38, 9).flatMap((z, i) => [ring(z, 2.0, 3.1, i % 2 ? "#7fa8ff" : "#8a6bff", "#e4ecff", 0.075)]);
    const faint = [
      ...range(-10, 10, 1.3).map((x) => lane([x, 0, 1.3], [x, 0, 60], "#4a5fb8", "#4a5fb8", 0.012, "x")),
      ...geometric(1.5, 1.28, 14).map((z) => poly([[-10, 0, z], [10, 0, z]], "#4a5fb8", "#4a5fb8", 0.012)),
    ];
    return { sky: ["#03040e", "#0a0c28"], floor: ["#080a22", "#020309"], haze: ["#9cb4ff", 0.6], faint, faintOpacity: 0.26, neon: rings };
  },
};

/* ------------------------------------------------------------------ rendering */

function svgFor(scene) {
  const { sky, floor, haze, faint, faintOpacity, neon } = scene;
  const floorClip = `<clipPath id="floorClip"><rect x="0" y="${CY}" width="${W}" height="${H - CY}"/></clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${floor[0]}"/><stop offset="1" stop-color="${floor[1]}"/></linearGradient>
  <radialGradient id="haze" cx="${CX}" cy="${CY - 40}" r="${W * 0.42}" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CX} ${CY - 40}) scale(1 0.55) translate(${-CX} ${-(CY - 40)})">
    <stop offset="0" stop-color="${haze[0]}" stop-opacity="${haze[1]}"/><stop offset="0.35" stop-color="${haze[0]}" stop-opacity="${haze[1] * 0.35}"/><stop offset="1" stop-color="${haze[0]}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fadeFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/></linearGradient>
  <linearGradient id="vignette" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="0.28" stop-color="#000" stop-opacity="0"/><stop offset="0.72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient>
  <filter id="b40" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="40"/></filter>
  <filter id="b16" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="b5" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="b2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
  ${floorClip}
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect y="${CY}" width="${W}" height="${H - CY}" fill="url(#floor)"/>
<rect width="${W}" height="${H}" fill="url(#haze)"/>
<g opacity="${faintOpacity}" clip-path="url(#floorClip)" filter="url(#b2)">${draw(faint)}</g>
<g clip-path="url(#floorClip)" opacity="0.5" filter="url(#b16)">${draw(neon, { mirror: true })}</g>
<g clip-path="url(#floorClip)" opacity="0.4" filter="url(#b5)">${draw(neon, { mirror: true })}</g>
<rect y="${CY}" width="${W}" height="${H - CY}" fill="url(#fadeFloor)"/>
<g opacity="0.55" filter="url(#b40)">${draw(neon)}</g>
<g opacity="0.85" filter="url(#b16)">${draw(neon)}</g>
<g filter="url(#b2)">${draw(neon)}</g>
<g>${draw(neon, { core: true })}</g>
<rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;
}

/** Fine grain so the dark gradients do not band when they are compressed. */
async function grain(buffer) {
  const noise = await sharp({ create: { width: W, height: H, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 40 } } })
    .ensureAlpha(0.035)
    .png()
    .toBuffer();
  return sharp(buffer).composite([{ input: noise, blend: "over" }]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [id, make] of Object.entries(SCENES)) {
  const png = await sharp(Buffer.from(svgFor(make()))).png().toBuffer();
  const image = await grain(png);
  const flat = await image.png().toBuffer();
  await sharp(flat).webp({ quality: 82, effort: 5 }).toFile(path.join(OUT, `${id}.webp`));
  await sharp(flat).resize(320, 192, { fit: "cover" }).webp({ quality: 74 }).toFile(path.join(OUT, `${id}-thumb.webp`));
  // Lighting probe (equirect 256x128): the picture fills the front half (-Z at u = .25) and its mirror the back half
  // (+Z, behind the camera, where the same corridor continues); above and below, the picture's own edge colours, softened.
  const half = await sharp(flat).resize(128, 64, { fit: "fill" }).extend({ top: 32, bottom: 32, extendWith: "mirror" }).blur(2).toBuffer();
  const flop = await sharp(half).flop().toBuffer();
  await sharp({ create: { width: 256, height: 128, channels: 3, background: "#000" } })
    .composite([{ input: half, left: 0, top: 0 }, { input: flop, left: 128, top: 0 }])
    .blur(1.2)
    .jpeg({ quality: 84 })
    .toFile(path.join(OUT, `${id}-env.jpg`));
  console.log(id, (fs.statSync(path.join(OUT, `${id}.webp`)).size / 1024).toFixed(0) + " KB");
}
