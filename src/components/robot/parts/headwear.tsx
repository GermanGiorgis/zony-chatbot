import * as THREE from "three";
import type { GlassesId, HatId } from "../catalog";
import {
  box,
  capsule,
  cloth,
  CONE,
  CYL,
  fixed,
  geo,
  HEMI,
  lathe,
  leather,
  lens,
  metal,
  plastic,
  plate,
  SPHERE,
  span,
  TORUS,
  tube,
  type Kit,
} from "../kit";
import type { HeadAnchors } from "./heads";

/**
 * Hats are modelled with the origin on top of the human head (crown), glasses with the origin at
 * the front of the face on the eye line. Robot.tsx places and scales them from each head's anchors.
 */
export type Wearable = ((p: Kit) => React.JSX.Element) | null;

/** Anchors of the human head the accessories were modelled on. */
export const BASE_ANCHORS: HeadAnchors = { top: 0.247, crownZ: 0.02, width: 0.079, eyeY: 0.103, faceZ: 0.112, eyeX: 0.032 };

/* ------------------------------------------------------------------ shapes */

const frustum = (top: number, bottom: number, h: number, seg = 32, open = false) =>
  geo(`frustum:${top}:${bottom}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(top, bottom, h, seg, 1, open));

/** Tapered horn that curls along +X as it rises. */
const horn = (curl: number) =>
  geo(`horn:${curl}`, () => {
    const g = new THREE.CylinderGeometry(0.0015, 0.022, 0.16, 16, 16);
    g.translate(0, 0.08, 0);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = v.y / 0.16;
      v.x += curl * t * t;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });

const halfDisc = () => geo("half-disc", () => new THREE.CylinderGeometry(0.1, 0.1, 0.006, 32, 1, false, -Math.PI / 2, Math.PI));

const hoodGeo = () =>
  geo("hood", () => new THREE.SphereGeometry(1, 40, 28, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0, Math.PI * 0.72));

const hudMat = () =>
  fixed("hud", () => new THREE.MeshBasicMaterial({ color: "#6ee7ff", transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));

/* -------------------------------------------------------------------- hats */

const felt = (c: string) => cloth(c, "#6a6470");

const HATS: Record<Exclude<HatId, "none">, (p: Kit) => React.JSX.Element> = {
  wizard: ({ M }) => (
    <group position={[0, -0.05, 0]} rotation={[-0.12, 0, 0]}>
      <mesh geometry={CYL} material={felt("#3b1f6e")} scale={[0.19, 0.006, 0.2]} />
      <mesh geometry={frustum(0.075, 0.1, 0.12)} material={felt("#3b1f6e")} position={[0, 0.06, 0]} />
      <mesh geometry={TORUS} material={metal("#d9b35a", 0.2)} position={[0, 0.018, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.097, 0.097, 0.12]} />
      <mesh geometry={SPHERE} material={M.glow} position={[0, 0.025, 0.098]} scale={[0.012, 0.012, 0.004]} />
      <group position={[0, 0.12, 0]} rotation={[-0.3, 0, 0]}>
        <mesh geometry={frustum(0.042, 0.075, 0.11)} material={felt("#3b1f6e")} position={[0, 0.055, 0]} />
        <group position={[0, 0.11, 0]} rotation={[-0.45, 0, 0]}>
          <mesh geometry={frustum(0.001, 0.042, 0.13)} material={felt("#3b1f6e")} position={[0, 0.065, 0]} />
        </group>
      </group>
    </group>
  ),
  helm: () => (
    <group>
      <mesh geometry={HEMI} material={metal("#a4acb6", 0.25)} position={[0, -0.105, 0]} scale={[0.093, 0.112, 0.113]} />
      <mesh geometry={TORUS} material={metal("#7c848e", 0.3)} position={[0, -0.105, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.094, 0.114, 0.1]} />
      <mesh geometry={box(0.016, 0.075, 0.012, 0.004)} material={metal("#a4acb6", 0.25)} position={[0, -0.13, 0.108]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.012, 0.08, 0.06, 0.006)} material={metal("#a4acb6", 0.25)} position={[s * 0.088, -0.15, 0.03]} rotation={[0.1, 0, s * 0.08]} />
      ))}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} geometry={CONE} material={cloth("#a11d2a", "#ff9aa6")} position={[i * 0.006, 0.02, -0.02 - Math.abs(i) * 0.004]} rotation={[-0.6 - Math.abs(i) * 0.1, 0, i * 0.18]} scale={[0.012, 0.13, 0.006]} />
      ))}
    </group>
  ),
  crown: () => (
    <group position={[0, -0.03, 0]}>
      <mesh geometry={frustum(0.09, 0.084, 0.04, 40, true)} material={metal("#e2b64e", 0.18)} scale={[1, 1, 1.18]} />
      {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a) => (
        <mesh key={a} geometry={CONE} material={metal("#e2b64e", 0.18)} position={[Math.sin(a) * 0.089, 0.036, Math.cos(a) * 0.105]} scale={[0.012, 0.035, 0.008]} rotation={[0, a, 0]} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a, i) => (
        <mesh key={a} geometry={SPHERE} material={plastic(i % 2 ? "#2b6cff" : "#e0223a", 0.1)} position={[Math.sin(a) * 0.089, 0.0, Math.cos(a) * 0.106]} scale={0.008} />
      ))}
    </group>
  ),
  viking: () => (
    <group>
      <mesh geometry={HEMI} material={metal("#9aa3ad", 0.3)} position={[0, -0.1, 0]} scale={[0.092, 0.108, 0.11]} />
      <mesh geometry={TORUS} material={metal("#8c5a2b", 0.35)} position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.094, 0.112, 0.12]} />
      <mesh geometry={box(0.012, 0.005, 0.22, 0.002)} material={metal("#8c5a2b", 0.35)} position={[0, 0.004, 0]} rotation={[0, 0, 0]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={horn(0.07)} material={plastic("#efe6d2", 0.4)} position={[s * 0.08, -0.06, 0]} rotation={[0, s > 0 ? 0 : Math.PI, -1.25]} scale={0.8} />
      ))}
    </group>
  ),
  hood: () => (
    <group position={[0, -0.1, -0.008]}>
      <mesh geometry={hoodGeo()} material={cloth("#23361f", "#9fc28f")} scale={[0.112, 0.135, 0.125]} />
      <mesh geometry={geo("hood-drape", () => lathe([[0.1, -0.08], [0.13, -0.16], [0.17, -0.22]], 48, 12))} material={cloth("#23361f", "#9fc28f")} scale={[1, 1, 0.8]} />
      <mesh geometry={CONE} material={cloth("#23361f", "#9fc28f")} position={[0, 0.13, 0.03]} rotation={[0.5, 0, 0]} scale={[0.03, 0.05, 0.03]} />
    </group>
  ),
  cap: () => (
    <group position={[0, -0.075, 0]}>
      <mesh geometry={HEMI} material={cloth("#c0392b", "#ffb3a8")} scale={[0.089, 0.082, 0.104]} />
      <mesh geometry={halfDisc()} material={cloth("#c0392b", "#ffb3a8")} position={[0, 0.004, 0.08]} rotation={[0.12, 0, 0]} scale={[0.9, 1, 1.05]} />
      <mesh geometry={SPHERE} material={cloth("#c0392b", "#ffb3a8")} position={[0, 0.082, 0]} scale={0.009} />
      <mesh geometry={SPHERE} material={cloth("#f4f4f2")} position={[0, 0.045, 0.085]} scale={[0.02, 0.016, 0.004]} rotation={[-0.6, 0, 0]} />
    </group>
  ),
  tricorn: () => (
    <group position={[0, -0.06, 0]}>
      <mesh geometry={HEMI} material={felt("#1d1b1f")} position={[0, -0.01, 0]} scale={[0.088, 0.075, 0.1]} />
      <mesh geometry={frustum(0.165, 0.1, 0.085, 3, true)} material={felt("#1d1b1f")} position={[0, 0.03, 0]} />
      <mesh geometry={geo("tricorn-trim", () => new THREE.TorusGeometry(0.165, 0.004, 6, 3))} material={metal("#d9b35a", 0.2)} position={[0, 0.072, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} />
      <mesh geometry={SPHERE} material={plastic("#f1ece0", 0.4)} position={[0, 0.025, 0.12]} scale={[0.014, 0.016, 0.006]} />
    </group>
  ),
  halo: ({ M }) => (
    <group position={[0, 0.06, -0.01]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
      <mesh geometry={TORUS} material={M.glow} scale={[0.085, 0.085, 0.05]} />
    </group>
  ),
  horns: () => (
    <>
      {[1, -1].map((s) => (
        <mesh key={s} geometry={horn(-0.05)} material={plastic("#2a0d12", 0.25)} position={[s * 0.05, -0.04, 0.05]} rotation={[-0.35, s > 0 ? 0 : Math.PI, -0.35]} />
      ))}
    </>
  ),
  headphones: ({ M }) => (
    <group position={[0, -0.12, 0]}>
      <mesh geometry={geo("headband", () => new THREE.TorusGeometry(0.104, 0.008, 10, 40, Math.PI))} material={plastic("#1c1d21", 0.3)} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.097, -0.035, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
          <mesh geometry={CYL} material={plastic("#1c1d21", 0.3)} scale={[0.036, 0.03, 0.04]} />
          <mesh geometry={TORUS} material={M.glowSoft} position={[0, -0.016 * s, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.03, 0.034, 0.05]} />
          <mesh geometry={CYL} material={cloth("#3a3b40")} position={[0, 0.02 * s, 0]} scale={[0.032, 0.012, 0.036]} />
        </group>
      ))}
    </group>
  ),
  beanie: () => (
    <group>
      <mesh geometry={geo("beanie", () => lathe([[0.001, 0.018], [0.05, 0.01], [0.08, -0.025], [0.093, -0.065], [0.095, -0.1]], 40, 16))} material={cloth("#d9a441", "#fff0c2")} scale={[1, 1, 1.18]} />
      <mesh geometry={TORUS} material={cloth("#c38f33", "#fff0c2")} position={[0, -0.093, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.097, 0.116, 0.16]} />
      <mesh geometry={SPHERE} material={cloth("#f1ece0")} position={[0, 0.04, 0]} scale={0.03} />
    </group>
  ),
  tophat: () => (
    <group position={[0, -0.055, 0]}>
      <mesh geometry={CYL} material={felt("#141316")} scale={[0.14, 0.006, 0.16]} />
      <mesh geometry={frustum(0.078, 0.074, 0.18)} material={felt("#141316")} position={[0, 0.09, 0]} scale={[1, 1, 1.15]} />
      <mesh geometry={frustum(0.0755, 0.0755, 0.03, 32, true)} material={cloth("#8b1e1e", "#ff9a9a")} position={[0, 0.02, 0]} scale={[1.01, 1, 1.16]} />
    </group>
  ),
  catears: ({ M }) => (
    <>
      <mesh geometry={geo("ear-band", () => new THREE.TorusGeometry(0.1, 0.005, 8, 40, Math.PI))} material={M.darkMetal} position={[0, -0.1, 0.02]} rotation={[0.2, 0, 0]} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.06, -0.018, 0.028]} rotation={[0.15, 0, -s * 0.38]} scale={1.3}>
          <mesh geometry={geo("ear", () => new THREE.ConeGeometry(1, 1, 4))} material={M.shell} scale={[0.034, 0.07, 0.016]} rotation={[0, Math.PI / 4, 0]} />
          <mesh geometry={geo("ear", () => new THREE.ConeGeometry(1, 1, 4))} material={plastic("#ff9fb2", 0.5)} position={[0, -0.006, 0.009]} scale={[0.02, 0.048, 0.006]} rotation={[0, Math.PI / 4, 0]} />
        </group>
      ))}
    </>
  ),
};

/* ----------------------------------------------------------------- glasses */

/** Temple arms from the frame back to the ears. */
function Temples({ material, x = 0.058, y = 0.004 }: { material: THREE.Material; x?: number; y?: number }) {
  return (
    <>
      {[1, -1].map((s) => {
        const p = span([s * x, y, 0.0], [s * 0.076, y + 0.004, -0.095]);
        return <mesh key={s} geometry={capsule(0.0022, p.length)} material={material} position={p.position} rotation={p.rotation} />;
      })}
    </>
  );
}

const LENS_DISC = () => geo("lens-disc", () => new THREE.CylinderGeometry(1, 1, 0.1, 32));

const GLASSES: Record<Exclude<GlassesId, "none">, (p: Kit) => React.JSX.Element> = {
  round: () => (
    <group position={[0, 0, 0.006]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.034, 0, 0]}>
          <mesh geometry={TORUS} material={metal("#d9b35a", 0.2)} scale={[0.023, 0.023, 0.018]} />
          <mesh geometry={LENS_DISC()} material={lens("#bfe3ff", 0.25)} rotation={[Math.PI / 2, 0, 0]} scale={[0.022, 0.02, 0.022]} />
        </group>
      ))}
      <mesh geometry={geo("bridge", () => new THREE.TorusGeometry(0.009, 0.0022, 6, 16, Math.PI))} material={metal("#d9b35a", 0.2)} position={[0, 0.004, 0.002]} />
      <Temples material={metal("#d9b35a", 0.2)} />
    </group>
  ),
  aviator: () => (
    <group position={[0, -0.004, 0.008]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.035, 0, 0]} rotation={[0, 0, s * 0.12]}>
          <mesh geometry={SPHERE} material={lens("#1b1b1f", 0.88)} scale={[0.027, 0.022, 0.005]} />
          <mesh geometry={TORUS} material={metal("#d9b35a", 0.18)} scale={[0.028, 0.023, 0.016]} />
        </group>
      ))}
      {[0.012, 0.02].map((y) => (
        <mesh key={y} geometry={capsule(0.0018, 0.016)} material={metal("#d9b35a", 0.18)} position={[0, y, 0.002]} rotation={[0, 0, Math.PI / 2]} />
      ))}
      <Temples material={metal("#d9b35a", 0.18)} x={0.062} y={0.012} />
    </group>
  ),
  visor: ({ M }) => (
    <group position={[0, 0.002, -0.09]} scale={[0.82, 1, 1]}>
      <mesh geometry={geo("cyber-visor", () => plate([[0.1, -0.013], [0.103, 0.0], [0.101, 0.016]], 0, 2.3, 48))} material={M.glowSoft} />
      <mesh geometry={geo("cyber-visor-rim", () => plate([[0.104, 0.016], [0.103, 0.022]], 0, 2.4, 48))} material={M.darkMetal} />
    </group>
  ),
  monocle: () => (
    <group position={[-0.034, 0, 0.008]}>
      <mesh geometry={TORUS} material={metal("#d9b35a", 0.18)} scale={[0.024, 0.024, 0.024]} />
      <mesh geometry={LENS_DISC()} material={lens("#dff2ff", 0.2)} rotation={[Math.PI / 2, 0, 0]} scale={[0.023, 0.02, 0.023]} />
      <mesh geometry={tube("monocle-chain", [[-0.02, -0.014, 0], [-0.03, -0.05, -0.005], [-0.035, -0.09, -0.02], [-0.03, -0.12, -0.03]], 0.0015)} material={metal("#d9b35a", 0.18)} />
    </group>
  ),
  goggles: () => (
    <group position={[0, 0.004, 0.0]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.035, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={frustum(0.026, 0.024, 0.024, 24, true)} material={metal("#b98b3e", 0.3)} />
          <mesh geometry={TORUS} material={metal("#8c5a2b", 0.35)} position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.026, 0.026, 0.05]} />
          <mesh geometry={LENS_DISC()} material={lens("#ffb347", 0.55)} position={[0, 0.01, 0]} scale={[0.024, 0.02, 0.024]} />
        </group>
      ))}
      <mesh geometry={TORUS} material={leather("#4a2e1a")} position={[0, 0, -0.095]} rotation={[Math.PI / 2, 0, 0]} scale={[0.08, 0.1, 0.14]} />
    </group>
  ),
  patch: () => (
    <>
      <mesh geometry={SPHERE} material={leather("#141414")} position={[0.034, 0, 0.004]} scale={[0.025, 0.021, 0.007]} />
      <mesh geometry={geo("strap", () => new THREE.TorusGeometry(1, 0.03, 6, 64))} material={leather("#141414")} position={[0, 0.012, -0.09]} rotation={[Math.PI / 2 - 0.3, 0.3, 0]} scale={[0.082, 0.104, 0.1]} />
    </>
  ),
  pixel: () => (
    <group position={[0, 0.002, 0.012]}>
      <mesh geometry={box(0.13, 0.008, 0.006, 0.001)} material={plastic("#0c0c0e", 0.3)} position={[0, 0.012, 0]} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.034, 0, 0]}>
          <mesh geometry={box(0.052, 0.016, 0.006, 0.001)} material={plastic("#0c0c0e", 0.3)} />
          <mesh geometry={box(0.036, 0.008, 0.006, 0.001)} material={plastic("#0c0c0e", 0.3)} position={[s * -0.004, -0.012, 0]} />
          <mesh geometry={box(0.008, 0.006, 0.007, 0.001)} material={plastic("#f4f4f2", 0.3)} position={[s * 0.01, 0.002, 0.001]} />
        </group>
      ))}
      <Temples material={plastic("#0c0c0e", 0.3)} x={0.064} y={0.012} />
    </group>
  ),
  hud: ({ M }) => (
    <group position={[-0.036, 0.004, 0.018]}>
      <mesh geometry={box(0.05, 0.034, 0.002, 0.004)} material={hudMat()} rotation={[0, 0.2, 0]} />
      {[0.008, 0.0, -0.008].map((y, i) => (
        <mesh key={y} geometry={box(0.03 - i * 0.008, 0.0015, 0.001, 0.0005)} material={M.glowSoft} position={[-0.004, y, 0.002]} rotation={[0, 0.2, 0]} />
      ))}
      <mesh geometry={box(0.012, 0.016, 0.03, 0.004)} material={M.darkMetal} position={[-0.036, 0, -0.02]} />
      <mesh geometry={SPHERE} material={M.glow} position={[-0.036, 0, -0.003]} scale={0.003} />
    </group>
  ),
  mask: () => (
    <group position={[0, 0, -0.092]} scale={[0.78, 1, 1]}>
      <mesh geometry={geo("ninja-mask", () => plate([[0.058, -0.108], [0.082, -0.06], [0.1, -0.02], [0.102, -0.006]], 0, 2.7, 48))} material={cloth("#17161b", "#6a6080")} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={capsule(0.006, 0.05)} material={cloth("#17161b", "#6a6080")} position={[s * 0.01, -0.05, -0.105]} rotation={[0.9, 0, s * 0.5]} />
      ))}
    </group>
  ),
};

export const HAT_VARIANTS: Record<HatId, Wearable> = { none: null, ...HATS };
export const GLASSES_VARIANTS: Record<GlassesId, Wearable> = { none: null, ...GLASSES };

