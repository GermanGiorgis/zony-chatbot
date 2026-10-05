import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Appearance } from "./appearance";

/* ------------------------------------------------------------------ geometry */

export type V2 = [number, number];
export type V3 = [number, number, number];

/**
 * Geometries are built lazily once and shared for the page's lifetime. Part variants are swapped
 * (and hover-previewed) constantly, so rebuilding sculpted meshes on every mount would stutter.
 */
const geoCache = new Map<string, THREE.BufferGeometry>();
export function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const bump = (dx: number, dy: number) => Math.exp(-(dx * dx + dy * dy));

export const spline = (pts: V2[], n: number) =>
  new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(n);

/** Lathe from a smooth profile, then a per-vertex deform. Seam faces backwards (phiStart = PI). */
export function sculpt(pts: V2[], rows: number, seg: number, fn?: (v: THREE.Vector3) => void, phiStart = Math.PI, phiLength = Math.PI * 2) {
  const g = new THREE.LatheGeometry(spline(pts, rows), seg, phiStart, phiLength);
  if (fn) {
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      fn(v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

export const lathe = (pts: V2[], seg = 32, rows = 24) => new THREE.LatheGeometry(spline(pts, rows), seg);

/** A curved plate covering `width` radians around the Y axis, centred on `center` (0 = front, PI/2 = +X). */
export const plate = (pts: V2[], center: number, width: number, seg = 24) =>
  new THREE.LatheGeometry(spline(pts, 24), seg, center - width / 2, width);

export const capsule = (r: number, len: number) => geo(`cap:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 8, 20));

export const box = (w: number, h: number, d: number, r = 0.01) =>
  geo(`box:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));

export const tube = (key: string, pts: V3[], r: number, closed = false, seg = 32) =>
  geo(`tube:${key}`, () =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed), seg, r, 10, closed),
  );

export const SPHERE = geo("sphere", () => new THREE.SphereGeometry(1, 36, 24));
export const HEMI = geo("hemi", () => new THREE.SphereGeometry(1, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2));
export const CYL = geo("cyl", () => new THREE.CylinderGeometry(1, 1, 1, 28));
export const CONE = geo("cone", () => new THREE.ConeGeometry(1, 1, 28));
export const TORUS = geo("torus", () => new THREE.TorusGeometry(1, 0.14, 14, 48));
export const RING = geo("ring", () => new THREE.TorusGeometry(1, 0.04, 8, 64));
export const PLANE = geo("plane", () => new THREE.PlaneGeometry(1, 1));

/** Rotation that points a Y-aligned mesh along `dir`. */
export function alignY(dir: V3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

/** Position, rotation and length for a capsule/cylinder spanning a → b. */
export function span(a: V3, b: V3) {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return {
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as V3,
    rotation: alignY(d),
    length: Math.hypot(...d),
  };
}

/* ----------------------------------------------------------------- materials */

function stripeTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 4;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 64; i += 16) {
    const grad = g.createLinearGradient(i, 0, i + 16, 0);
    grad.addColorStop(0, "#3a3a3a");
    grad.addColorStop(0.2, "#ffffff");
    grad.addColorStop(0.75, "#cfcfcf");
    grad.addColorStop(1, "#3a3a3a");
    g.fillStyle = grad;
    g.fillRect(i, 0, 16, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Materials tied to the user's colors. Accessories use fixed palettes from `fixed()` instead. */
export function makeMaterials() {
  const stripes = stripeTexture();
  return {
    shell: new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, thickness: 0.35, ior: 1.45, envMapIntensity: 1.2 }),
    face: new THREE.MeshPhysicalMaterial({ thickness: 0.4, ior: 1.45, envMapIntensity: 1.2 }),
    muscle: new THREE.MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.08, envMapIntensity: 1.3 }),
    cables: new THREE.MeshStandardMaterial({ map: stripes, bumpMap: stripes, bumpScale: 2.5, metalness: 0.3, roughness: 0.45 }),
    chrome: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.07, side: THREE.DoubleSide, envMapIntensity: 1.6 }),
    darkMetal: new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide, envMapIntensity: 1.3 }),
    glass: new THREE.MeshPhysicalMaterial({ transmission: 1, roughness: 0.06, thickness: 0.25, ior: 1.45, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
    sclera: new THREE.MeshStandardMaterial({ color: "#eef2f6", roughness: 0.25 }),
    iris: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.2 }),
    glow: new THREE.MeshStandardMaterial({ color: "#000000", toneMapped: false }),
    glowSoft: new THREE.MeshStandardMaterial({ color: "#000000", toneMapped: false }),
    screen: new THREE.MeshStandardMaterial({ color: "#05080c", roughness: 0.2, metalness: 0.4 }),
    dark: new THREE.MeshBasicMaterial({ color: "#05070a" }),
  };
}
export type Mats = ReturnType<typeof makeMaterials>;
export type MatKey = keyof Mats;

export function applyAppearance(M: Mats, a: Appearance) {
  const frosted = a.finish === "frosted";
  for (const m of [M.shell, M.face]) {
    const transmission = frosted ? (m === M.shell ? 0.55 : 0.2) : 0;
    const was = m.transmission > 0;
    m.color.set(a.shell);
    m.transmission = transmission;
    m.metalness = a.finish === "chrome" ? 1 : 0.05;
    m.roughness = { pearl: 0.26, frosted: 0.4, matte: 0.72, chrome: 0.12 }[a.finish];
    m.clearcoat = a.finish === "matte" ? 0 : 1;
    m.clearcoatRoughness = a.finish === "pearl" ? 0.12 : 0.3;
    m.iridescence = a.finish === "pearl" ? 0.28 : 0;
    m.iridescenceIOR = 1.6;
    if (was !== transmission > 0) m.needsUpdate = true;
  }
  M.face.roughness = Math.max(M.face.roughness, 0.3);
  M.muscle.color.set(a.muscle);
  M.cables.color.set(a.muscle);
  M.chrome.color.set(a.metal);
  M.darkMetal.color.set(a.muscle).lerp(new THREE.Color(a.metal), 0.18);
  M.glass.color.set(a.shell).lerp(new THREE.Color("#ffffff"), 0.6);
}

/* Fixed-color materials for clothing and props, shared across the page. */
const fixedCache = new Map<string, THREE.Material>();
export function fixed(key: string, make: () => THREE.Material) {
  let m = fixedCache.get(key);
  if (!m) {
    m = make();
    fixedCache.set(key, m);
  }
  return m;
}

/** Subtle woven-fabric normal map: breaks up perfectly smooth cloth into a believable weave. */
function weaveNormalTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const g = c.getContext("2d")!;
  const img = g.createImageData(48, 48);
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const nx = Math.sin(x * 2.1) * 0.5 + (Math.sin(x * 0.7 + y * 0.3) - 0.5) * 0.25;
      const ny = Math.sin(y * 2.1) * 0.5 + (Math.sin(y * 0.7 + x * 0.3) - 0.5) * 0.25;
      const i = (y * 48 + x) * 4;
      img.data[i] = 128 + nx * 26;
      img.data[i + 1] = 128 + ny * 26;
      img.data[i + 2] = 246;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}
let weaveTex: THREE.Texture | null = null;
const weave = () => (weaveTex ??= weaveNormalTexture());

export const cloth = (color: string, sheen = "#ffffff") =>
  fixed(
    `cloth:${color}:${sheen}`,
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.78,
        sheen: 1,
        sheenColor: new THREE.Color(sheen),
        sheenRoughness: 0.45,
        normalMap: weave(),
        normalScale: new THREE.Vector2(0.22, 0.22),
        envMapIntensity: 0.6,
        side: THREE.DoubleSide,
      }),
  );
export const leather = (color: string) =>
  fixed(`leather:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.48, clearcoat: 0.4, clearcoatRoughness: 0.5, envMapIntensity: 0.9, side: THREE.DoubleSide }));
export const metal = (color: string, roughness = 0.22) =>
  fixed(`metal:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, envMapIntensity: 1.4, side: THREE.DoubleSide }));
export const plastic = (color: string, roughness = 0.35) =>
  fixed(`plastic:${color}:${roughness}`, () => new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.6, envMapIntensity: 1.1, side: THREE.DoubleSide }));
export const emissive = (color: string, intensity = 2) =>
  fixed(`emissive:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: "#000000", emissive: color, emissiveIntensity: intensity, toneMapped: false }));
export const lens = (color: string, opacity = 0.55) =>
  fixed(`lens:${color}:${opacity}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0.3, transparent: true, opacity, clearcoat: 1 }));

/* -------------------------------------------------------------------- props */

export type Reg = (name: string) => (o: THREE.Object3D | null) => void;
export type Side = "L" | "R";
export type Kit = { M: Mats; reg: Reg };
export type SideProps = Kit & { s: 1 | -1; side: Side };
