"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { OutfitId } from "../catalog";
import {
  box,
  bump,
  capsule,
  cloth,
  CONE,
  CYL,
  geo,
  HEMI,
  leather,
  metal,
  plastic,
  plate,
  sculpt,
  SPHERE,
  TORUS,
  tube,
  type Kit,
  type SideProps,
  type V2,
  type V3,
} from "../kit";
import { shoeGeo } from "./legs";
import { shellR, widen } from "./torsos";

/** Clothing is rigid and rides on the bones; each slot uses the same bone space as the body parts. */
export type OutfitVariant = {
  Chest?: (p: Kit & { fit: V3 }) => React.JSX.Element;
  Hips?: (p: Kit) => React.JSX.Element;
  Neck?: (p: Kit) => React.JSX.Element;
  Upper?: (p: SideProps) => React.JSX.Element;
  Fore?: (p: SideProps) => React.JSX.Element;
  Thigh?: (p: SideProps) => React.JSX.Element;
  Shin?: (p: SideProps) => React.JSX.Element;
  Foot?: (p: SideProps) => React.JSX.Element;
};

/* ------------------------------------------------------------------ shapes */

/**
 * Garment around the classic chest shell between y0 and y1 (chest space), `grow` times larger.
 * `gap` leaves the front open (radians), for coats and jackets.
 */
const wrap = (key: string, y0: number, y1: number, grow: number, gap = 0) =>
  geo(`wrap:${key}`, () => {
    const pts: V2[] = [];
    for (let i = 0; i <= 14; i++) {
      const y = y0 + ((y1 - y0) * i) / 14;
      pts.push([Math.max(0.055, shellR(y) * grow * (y > 0.34 ? 0.92 : 1)), y]);
    }
    return sculpt(
      pts,
      40,
      64,
      (v) => {
        v.x *= widen(v.y);
        v.z *= 0.7;
        if (v.z > 0) v.z += 0.014 * bump((Math.abs(v.x) - 0.075) / 0.05, (v.y - 0.235) / 0.05);
      },
      gap ? gap / 2 : Math.PI,
      Math.PI * 2 - gap,
    );
  });

/** Skirt, robe or coat tails hanging from the waist (hips space), elliptical in section. */
const skirt = (key: string, profile: V2[], gap = 0, hem = 0) =>
  geo(`skirt:${key}`, () =>
    sculpt(
      profile,
      40,
      72,
      (v) => {
        v.z *= 0.74;
        if (hem) {
          const a = Math.atan2(v.x, v.z);
          const low = profile[profile.length - 1][1];
          const t = Math.max(0, (profile[0][1] - v.y) / (profile[0][1] - low));
          v.y -= hem * t ** 3 * (0.5 + 0.5 * Math.sin(a * 9) * Math.sin(a * 4 + 1));
        }
      },
      gap ? gap / 2 : Math.PI,
      Math.PI * 2 - gap,
    ),
  );

/** Cloth sleeves/trousers get gentle longitudinal creases instead of a perfectly smooth tube. */
const sleeve = (key: string, profile: V2[]) =>
  geo(`sleeve:${key}`, () =>
    sculpt(profile, 26, 28, (v) => {
      const r = Math.hypot(v.x, v.z);
      if (r < 1e-5) return;
      const a = Math.atan2(v.z, v.x);
      const fold = 1 + 0.028 * Math.sin(a * 5 + v.y * 3) + 0.014 * Math.sin(a * 9 - v.y * 5);
      v.x *= fold;
      v.z *= fold;
    }),
  );

/** Closed under-layer from the waist to the crotch, so the bare spine and pelvis never show through an open hem or between the legs. */
const TRUNKS: V2[] = [[0.12, 0.17], [0.135, 0.1], [0.145, -0.07], [0.115, -0.108], [0.055, -0.13], [0.001, -0.135]];
const trunks = (material: THREE.Material) => <mesh geometry={skirt("trunks", TRUNKS)} material={material} />;

const UPPER_SLEEVE: V2[] = [[0.054, 0.025], [0.057, -0.03], [0.052, -0.14], [0.048, -0.27]];
const FORE_SLEEVE: V2[] = [[0.047, 0.02], [0.046, -0.08], [0.043, -0.18], [0.04, -0.235]];
const BELL_SLEEVE: V2[] = [[0.047, 0.02], [0.052, -0.07], [0.07, -0.17], [0.092, -0.25]];
const PANT_THIGH: V2[] = [[0.068, 0.035], [0.069, -0.1], [0.062, -0.3], [0.054, -0.455]];
const PANT_SHIN: V2[] = [[0.052, 0.03], [0.049, -0.14], [0.046, -0.3], [0.045, -0.395]];

/** Rigid half-dome shoulder armour with two lames. */
function Pauldron({ s, material, trim, size = 1 }: { s: 1 | -1; material: THREE.Material; trim: THREE.Material; size?: number }) {
  return (
    <group rotation={[0, 0, -s * 0.38]} scale={size}>
      <mesh geometry={HEMI} material={material} position={[s * 0.012, 0.004, 0]} scale={[0.082, 0.07, 0.078]} />
      <mesh geometry={TORUS} material={trim} position={[s * 0.012, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.082, 0.078, 0.1]} />
      {[0, 1].map((i) => (
        <mesh
          key={i}
          geometry={geo(`pauldron-lame${i}`, () => plate([[0.08 - i * 0.004, -0.045 - i * 0.03], [0.078 - i * 0.004, -0.015 - i * 0.03]], Math.PI / 2, 3.4))}
          material={i ? trim : material}
          scale={[s, 1, 1]}
        />
      ))}
    </group>
  );
}

function Belt({ strap, buckle, y = 0.07, r = 0.128 }: { strap: THREE.Material; buckle: THREE.Material; y?: number; r?: number }) {
  return (
    <>
      <mesh geometry={CYL} material={strap} position={[0, y, 0]} scale={[r, 0.03, r * 0.74]} />
      <mesh geometry={box(0.04, 0.034, 0.012, 0.004)} material={buckle} position={[0, y, r * 0.74 + 0.004]} />
    </>
  );
}

/* -------------------------------------------------------------------- cape */

/** Cloth that sways gently; vertices are animated on the CPU (a few hundred of them). */
class CapeSim {
  geometry: THREE.PlaneGeometry;
  private base: Float32Array;
  constructor(
    private width: number,
    private length: number,
    private tatter: number,
  ) {
    this.geometry = new THREE.PlaneGeometry(width, length, 12, 26);
    this.geometry.translate(0, -length / 2, 0);
    this.base = Float32Array.from(this.geometry.attributes.position.array as Float32Array);
    this.update(0);
  }
  update(t: number) {
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const b = this.base;
    const half = this.width / 2;
    for (let i = 0; i < pos.count; i++) {
      const x0 = b[i * 3];
      const y0 = b[i * 3 + 1];
      const v = -y0 / this.length;
      const u = x0 / half;
      const ragged = this.tatter * v ** 4 * Math.abs(Math.sin(u * 11 + 2)) * 0.12;
      const sway = 0.018 * v * v * (1 + Math.sin(t * 1.3 + u * 2.5 + v * 3));
      pos.setXYZ(i, x0 * (1 + 0.28 * v), y0 + ragged, -0.06 * (1 - u * u) * (1 - v * 0.7) - v * 0.07 - sway);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
  dispose() {
    this.geometry.dispose();
  }
}

function Cape({ material, top = 0.33, length = 1.02, width = 0.4, tatter = 0 }: { material: THREE.Material; top?: number; length?: number; width?: number; tatter?: number }) {
  const sim = useMemo(() => new CapeSim(width, length, tatter), [width, length, tatter]);
  useEffect(() => () => sim.dispose(), [sim]);
  useFrame(({ clock }) => sim.update(clock.elapsedTime));
  return <mesh geometry={sim.geometry} material={material} position={[0, top, -0.06]} />;
}

/* ---------------------------------------------------------------- palettes */

const C = {
  steel: () => metal("#a4acb6", 0.25),
  gold: () => metal("#d9b35a", 0.2),
  brass: () => metal("#b98b3e", 0.3),
  bronze: () => metal("#8c5a2b", 0.35),
  leather: () => leather("#5a3a22"),
  darkLeather: () => leather("#2a2420"),
  red: () => cloth("#8b1e1e", "#ff9a9a"),
  wine: () => cloth("#6e1a2a", "#ff9ab0"),
  purple: () => cloth("#3b1f6e", "#b99bff"),
  blue: () => cloth("#1f3f8f", "#9ab8ff"),
  green: () => cloth("#2f5a2f", "#a8e0a0"),
  forest: () => cloth("#23361f", "#9fc28f"),
  black: () => cloth("#15131a", "#6a6080"),
  white: () => cloth("#ecebe6", "#ffffff"),
  grey: () => cloth("#5e636b", "#c9ced6"),
  charcoal: () => cloth("#2b2f36", "#7a8190"),
  navy: () => cloth("#1c2a44", "#8aa2d0"),
  sand: () => cloth("#c9b48a", "#fff3d6"),
  lacquer: () => leather("#8b1c1c"),
  enamel: () => plastic("#ece6d8", 0.22),
};

/* ----------------------------------------------------------------- outfits */

const NONE: OutfitVariant = {};

const Warrior: OutfitVariant = {
  Chest: ({ fit }) => (
    <group scale={fit}>
      <mesh geometry={wrap("warrior", 0.02, 0.35, 1.08)} material={C.steel()} />
      <mesh geometry={wrap("warrior-mail", -0.07, 0.03, 1.1)} material={C.grey()} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={tube(`warrior-strap${s}`, [[s * 0.1, 0.34, 0.1], [s * 0.2, 0.2, 0.06], [s * 0.16, 0.05, 0.02]], 0.01)} material={C.leather()} />
      ))}
      <mesh geometry={SPHERE} material={C.gold()} position={[0, 0.22, 0.155]} scale={[0.028, 0.028, 0.01]} />
    </group>
  ),
  Upper: ({ s }) => <Pauldron s={s} material={C.steel()} trim={C.leather()} size={1.12} />,
  Fore: () => (
    <>
      <mesh geometry={sleeve("bracer", [[0.048, -0.1], [0.046, -0.17], [0.043, -0.235]])} material={C.leather()} />
      {[-0.13, -0.19].map((y) => (
        <mesh key={y} geometry={TORUS} material={C.steel()} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.047, 0.047, 0.05]} />
      ))}
    </>
  ),
  Hips: () => (
    <>
      {trunks(C.charcoal())}
      <Belt strap={C.leather()} buckle={C.gold()} />
      <mesh geometry={skirt("warrior-mail", [[0.135, 0.07], [0.145, 0.0], [0.16, -0.12], [0.17, -0.2]])} material={C.grey()} />
      <mesh geometry={box(0.1, 0.22, 0.01, 0.004)} material={C.red()} position={[0, -0.06, 0.112]} rotation={[0.1, 0, 0]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.09, 0.12, 0.012, 0.01)} material={C.steel()} position={[s * 0.1, -0.02, 0.085]} rotation={[0.15, s * 0.5, s * 0.1]} />
      ))}
    </>
  ),
  Shin: () => <mesh geometry={geo("greave-plate", () => plate([[0.042, -0.36], [0.047, -0.2], [0.046, -0.06]], 0, 2.4))} material={C.steel()} />,
};

const Mage: OutfitVariant = {
  Chest: ({ M, fit }) => (
    <group scale={fit}>
      <mesh geometry={wrap("mage", -0.08, 0.36, 1.07)} material={C.purple()} />
      <mesh geometry={geo("mage-collar", () => plate([[0.075, 0.33], [0.09, 0.4], [0.1, 0.45]], Math.PI, 3.6))} material={C.purple()} />
      <mesh geometry={geo("mage-collar-trim", () => plate([[0.101, 0.448], [0.102, 0.456]], Math.PI, 3.7))} material={C.gold()} />
      <mesh geometry={box(0.03, 0.4, 0.01, 0.004)} material={C.gold()} position={[0, 0.14, 0.142]} rotation={[-0.08, 0, 0]} />
      {[0.26, 0.16, 0.06].map((y) => (
        <mesh key={y} geometry={SPHERE} material={M.glowSoft} position={[0, y, 0.15]} scale={0.009} />
      ))}
    </group>
  ),
  Upper: () => <mesh geometry={sleeve("mage-upper", UPPER_SLEEVE)} material={C.purple()} />,
  Fore: () => (
    <>
      <mesh geometry={sleeve("mage-bell", BELL_SLEEVE)} material={C.purple()} />
      <mesh geometry={TORUS} material={C.gold()} position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.092, 0.092, 0.05]} />
    </>
  ),
  Hips: ({ M }) => (
    <>
      <mesh geometry={skirt("mage-robe", [[0.14, 0.25], [0.135, 0.1], [0.145, 0.0], [0.175, -0.25], [0.2, -0.55], [0.225, -0.86]])} material={C.purple()} />
      <mesh geometry={TORUS} material={C.gold()} position={[0, -0.86, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.225, 0.166, 0.05]} />
      <mesh geometry={CYL} material={C.gold()} position={[0, 0.08, 0]} scale={[0.142, 0.03, 0.106]} />
      <mesh geometry={SPHERE} material={M.glow} position={[0, 0.08, 0.108]} scale={[0.014, 0.014, 0.006]} />
    </>
  ),
};

const Rogue: OutfitVariant = {
  Chest: ({ fit }) => (
    <group scale={fit}>
      <mesh geometry={wrap("rogue", -0.07, 0.34, 1.06)} material={C.darkLeather()} />
      <mesh geometry={tube("rogue-band", [[0.15, 0.3, 0.07], [0.05, 0.2, 0.14], [-0.08, 0.08, 0.13], [-0.15, -0.02, 0.06]], 0.013)} material={C.leather()} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={CONE} material={metal("#c9ced6", 0.2)} position={[0.07 - i * 0.05, 0.17 - i * 0.045, 0.15]} rotation={[0, 0, 0.9]} scale={[0.008, 0.06, 0.004]} />
      ))}
    </group>
  ),
  Neck: () => (
    <>
      <mesh geometry={TORUS} material={C.wine()} position={[0, 0.015, 0.005]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[0.058, 0.052, 0.22]} />
      <mesh geometry={box(0.04, 0.16, 0.01, 0.005)} material={C.wine()} position={[0.035, -0.06, 0.07]} rotation={[0.25, 0, -0.2]} />
    </>
  ),
  Fore: () => (
    <>
      {[-0.1, -0.14, -0.18, -0.22].map((y, i) => (
        <mesh key={y} geometry={TORUS} material={C.black()} position={[0, y, 0]} rotation={[Math.PI / 2 + (i % 2 ? 0.2 : -0.2), 0, 0]} scale={[0.044, 0.044, 0.14]} />
      ))}
    </>
  ),
  Hips: () => (
    <>
      {trunks(C.black())}
      <Belt strap={C.leather()} buckle={C.brass()} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.05, 0.05, 0.03, 0.008)} material={C.leather()} position={[s * 0.12, 0.04, 0.05]} rotation={[0, s * 0.6, 0]} />
      ))}
      <mesh geometry={skirt("rogue-flaps", [[0.132, 0.06], [0.14, -0.02], [0.15, -0.12]])} material={C.darkLeather()} />
    </>
  ),
  Shin: () => <mesh geometry={sleeve("rogue-boot", [[0.047, -0.2], [0.046, -0.3], [0.044, -0.4]])} material={C.darkLeather()} />,
};

const Paladin: OutfitVariant = {
  Chest: ({ M, fit }) => (
    <>
      <group scale={fit}>
        <mesh geometry={wrap("paladin", -0.02, 0.35, 1.08)} material={C.enamel()} />
        <mesh geometry={wrap("paladin-trim", -0.03, -0.015, 1.09)} material={C.gold()} />
        <group position={[0, 0.22, 0.156]}>
          <mesh geometry={CYL} material={C.gold()} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, 0.008, 0.04]} />
          <mesh geometry={SPHERE} material={M.glow} scale={[0.016, 0.016, 0.006]} position={[0, 0, 0.004]} />
          {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a) => (
            <mesh key={a} geometry={CONE} material={C.gold()} position={[Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0]} rotation={[0, 0, a - Math.PI / 2]} scale={[0.008, 0.024, 0.004]} />
          ))}
        </group>
      </group>
      <Cape material={C.blue()} />
    </>
  ),
  Upper: ({ s }) => <Pauldron s={s} material={C.gold()} trim={C.enamel()} size={1.18} />,
  Fore: () => <mesh geometry={sleeve("paladin-cuff", [[0.05, -0.16], [0.052, -0.2], [0.048, -0.24]])} material={C.gold()} />,
  Hips: () => (
    <>
      {trunks(C.navy())}
      <Belt strap={C.gold()} buckle={C.enamel()} />
      <mesh geometry={box(0.11, 0.3, 0.01, 0.004)} material={C.blue()} position={[0, -0.09, 0.114]} rotation={[0.08, 0, 0]} />
      <mesh geometry={box(0.112, 0.012, 0.012, 0.003)} material={C.gold()} position={[0, -0.24, 0.126]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.09, 0.13, 0.012, 0.01)} material={C.enamel()} position={[s * 0.11, -0.02, 0.07]} rotation={[0.15, s * 0.7, s * 0.12]} />
      ))}
    </>
  ),
};

const Ranger: OutfitVariant = {
  Chest: ({ fit }) => (
    <group scale={fit}>
      <mesh geometry={wrap("ranger", -0.08, 0.35, 1.06)} material={C.green()} />
      <mesh geometry={tube("ranger-strap", [[-0.15, 0.3, 0.06], [-0.04, 0.2, 0.14], [0.09, 0.07, 0.13], [0.16, -0.03, 0.05]], 0.012)} material={C.leather()} />
      <group position={[0.06, 0.16, -0.14]} rotation={[0.25, 0, -0.35]}>
        <mesh geometry={CYL} material={C.leather()} scale={[0.036, 0.3, 0.036]} />
        {[-0.015, 0, 0.015, 0.008].map((x, i) => (
          <group key={i} position={[x, 0.2, (i - 1.5) * 0.01]}>
            <mesh geometry={CYL} material={leather("#7a5a3a")} scale={[0.003, 0.14, 0.003]} />
            <mesh geometry={CONE} material={cloth("#e8e4da")} position={[0, 0.07, 0]} scale={[0.01, 0.03, 0.002]} />
          </group>
        ))}
      </group>
    </group>
  ),
  Neck: () => <mesh geometry={geo("cowl", () => plate([[0.16, -0.02], [0.12, 0.02], [0.07, 0.05]], 0, Math.PI * 2, 48))} material={C.forest()} scale={[1, 1, 0.72]} />,
  Fore: ({ s }) =>
    s > 0 ? (
      <mesh geometry={sleeve("ranger-bracer", [[0.047, -0.07], [0.048, -0.15], [0.045, -0.23]])} material={C.leather()} />
    ) : (
      <mesh geometry={TORUS} material={C.leather()} position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, 0.04, 0.12]} />
    ),
  Hips: () => (
    <>
      <Belt strap={C.leather()} buckle={C.brass()} />
      <mesh geometry={skirt("ranger-tunic", [[0.14, 0.24], [0.135, 0.1], [0.148, 0.0], [0.168, -0.15], [0.18, -0.26]], 0, 0.03)} material={C.green()} />
    </>
  ),
  Shin: () => <mesh geometry={sleeve("ranger-boot", [[0.047, -0.16], [0.046, -0.3], [0.044, -0.4]])} material={C.leather()} />,
};

const Necro: OutfitVariant = {
  Chest: ({ M, fit }) => (
    <>
      <group scale={fit}>
        <mesh geometry={wrap("necro", -0.08, 0.36, 1.07)} material={C.black()} />
        {[0.28, 0.2, 0.12, 0.04].map((y, i) => (
          <mesh key={y} geometry={box(0.012, 0.03, 0.006, 0.002)} material={M.glowSoft} position={[i % 2 ? 0.03 : -0.03, y, 0.15]} rotation={[0, 0, i * 0.7]} />
        ))}
        {[1, -1].map((s) => (
          <mesh key={s} geometry={tube(`necro-chain${s}`, [[s * 0.12, 0.3, 0.08], [s * 0.05, 0.22, 0.14], [-s * 0.02, 0.2, 0.15]], 0.004)} material={C.steel()} />
        ))}
      </group>
      <Cape material={C.black()} tatter={1} length={1.15} />
    </>
  ),
  Upper: ({ M, s }) => (
    <group position={[s * 0.03, 0.045, 0]}>
      <mesh geometry={SPHERE} material={cloth("#d8d2c0")} scale={[0.04, 0.042, 0.042]} />
      {[1, -1].map((e) => (
        <mesh key={e} geometry={SPHERE} material={M.glow} position={[e * 0.014, 0.004, 0.036]} scale={0.007} />
      ))}
      <mesh geometry={box(0.03, 0.012, 0.02, 0.004)} material={cloth("#d8d2c0")} position={[0, -0.03, 0.022]} />
      {[0, 1].map((i) => (
        <mesh key={i} geometry={CONE} material={cloth("#d8d2c0")} position={[s * 0.02, 0.03 + i * 0.01, -0.02 + i * 0.03]} rotation={[0, 0, -s * (0.4 + i * 0.3)]} scale={[0.008, 0.05, 0.008]} />
      ))}
    </group>
  ),
  Fore: () => <mesh geometry={sleeve("necro-bell", BELL_SLEEVE)} material={C.black()} />,
  Hips: ({ M }) => (
    <>
      <mesh geometry={skirt("necro-robe", [[0.14, 0.25], [0.135, 0.1], [0.145, 0.0], [0.175, -0.25], [0.2, -0.55], [0.22, -0.84]], 0, 0.12)} material={C.black()} />
      <mesh geometry={CYL} material={C.steel()} position={[0, 0.08, 0]} scale={[0.142, 0.02, 0.106]} />
      <mesh geometry={SPHERE} material={M.glowSoft} position={[0, 0.08, 0.108]} scale={[0.012, 0.016, 0.006]} />
    </>
  ),
};

const Samurai: OutfitVariant = {
  Chest: ({ fit }) => (
    <group scale={fit}>
      {[-0.06, 0.0, 0.06, 0.12, 0.18].map((y, i) => (
        <mesh key={y} geometry={wrap(`do${i}`, y, y + 0.058, 1.08 + (4 - i) * 0.004)} material={C.lacquer()} />
      ))}
      {[-0.06, 0.0, 0.06, 0.12, 0.18].map((y, i) => (
        <mesh key={`l${y}`} geometry={wrap(`do-lace${i}`, y + 0.052, y + 0.058, 1.09 + (4 - i) * 0.004)} material={C.gold()} />
      ))}
      <mesh geometry={wrap("do-top", 0.24, 0.35, 1.07)} material={C.black()} />
    </group>
  ),
  Upper: ({ s }) => (
    <group position={[s * 0.06, -0.05, 0]} rotation={[0, 0, s * 0.12]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={box(0.012, 0.035, 0.11, 0.004)} material={i % 2 ? C.gold() : C.lacquer()} position={[s * i * 0.004, -i * 0.034, 0]} rotation={[0, 0, s * 0.05]} />
      ))}
    </group>
  ),
  Fore: () => (
    <>
      <mesh geometry={sleeve("kote", FORE_SLEEVE)} material={C.black()} />
      {[-0.08, -0.13, -0.18].map((y) => (
        <mesh key={y} geometry={box(0.03, 0.03, 0.01, 0.004)} material={C.lacquer()} position={[0, y, 0.044]} />
      ))}
    </>
  ),
  Hips: () => (
    <>
      {trunks(C.black())}
      <mesh geometry={CYL} material={C.black()} position={[0, 0.07, 0]} scale={[0.135, 0.04, 0.1]} />
      {Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + Math.PI / 6).map((a) => (
        <group key={a} position={[Math.sin(a) * 0.145, -0.07, Math.cos(a) * 0.108]} rotation={[0, a, 0]}>
          {[0, 1, 2].map((j) => (
            <mesh key={j} geometry={box(0.09, 0.05, 0.01, 0.004)} material={j % 2 ? C.gold() : C.lacquer()} position={[0, 0.05 - j * 0.048, j * 0.006]} rotation={[0.12, 0, 0]} />
          ))}
        </group>
      ))}
    </>
  ),
  Shin: () => (
    <>
      {[-0.03, 0, 0.03].map((x) => (
        <mesh key={x} geometry={box(0.022, 0.26, 0.008, 0.004)} material={C.lacquer()} position={[x, -0.2, 0.046 - Math.abs(x) * 0.3]} rotation={[0, x * 6, 0]} />
      ))}
    </>
  ),
};

const Pirate: OutfitVariant = {
  Chest: ({ fit }) => (
    <group scale={fit}>
      <mesh geometry={wrap("pirate-shirt", -0.08, 0.35, 1.04)} material={C.white()} />
      <mesh geometry={wrap("pirate-coat", -0.1, 0.35, 1.1, 1.1)} material={C.wine()} />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={box(0.05, 0.2, 0.012, 0.006)} material={C.wine()} position={[s * 0.07, 0.25, 0.14]} rotation={[-0.15, s * 0.35, s * 0.35]} />
          {[0.2, 0.12, 0.04].map((y) => (
            <mesh key={y} geometry={SPHERE} material={C.gold()} position={[s * 0.1, y, 0.13]} scale={0.009} />
          ))}
        </group>
      ))}
    </group>
  ),
  Neck: () => (
    <>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={SPHERE} material={C.white()} position={[0, 0.0 - i * 0.025, 0.05 + i * 0.012]} scale={[0.03 - i * 0.004, 0.016, 0.014]} />
      ))}
    </>
  ),
  Upper: () => <mesh geometry={sleeve("pirate-upper", UPPER_SLEEVE)} material={C.wine()} />,
  Fore: () => (
    <>
      <mesh geometry={sleeve("pirate-fore", FORE_SLEEVE)} material={C.wine()} />
      <mesh geometry={sleeve("pirate-cuff", [[0.05, -0.17], [0.056, -0.21], [0.058, -0.235]])} material={C.gold()} />
    </>
  ),
  Hips: () => (
    <>
      {trunks(C.black())}
      <mesh geometry={CYL} material={C.red()} position={[0, 0.08, 0]} scale={[0.14, 0.05, 0.105]} />
      <mesh geometry={box(0.03, 0.18, 0.01, 0.005)} material={C.red()} position={[0.08, -0.02, 0.1]} rotation={[0.15, 0.4, 0.15]} />
      <mesh geometry={skirt("pirate-tails", [[0.14, 0.25], [0.138, 0.1], [0.15, 0.0], [0.175, -0.2], [0.2, -0.42]], 1.4)} material={C.wine()} />
      <Belt strap={C.darkLeather()} buckle={C.gold()} y={0.03} r={0.135} />
    </>
  ),
  Shin: () => <mesh geometry={sleeve("pirate-boot", [[0.05, -0.02], [0.056, -0.06], [0.048, -0.2], [0.046, -0.4]])} material={C.darkLeather()} />,
};

const Hoodie: OutfitVariant = {
  Chest: ({ fit }) => (
    <group scale={fit}>
      <mesh geometry={wrap("hoodie", -0.11, 0.35, 1.09)} material={C.charcoal()} />
      <mesh geometry={box(0.18, 0.09, 0.02, 0.012)} material={C.charcoal()} position={[0, 0.02, 0.135]} rotation={[0.08, 0, 0]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={capsule(0.003, 0.09)} material={C.white()} position={[s * 0.03, 0.27, 0.15]} rotation={[0.2, 0, 0]} />
      ))}
      <mesh geometry={geo("hood-down", () => plate([[0.09, 0.3], [0.13, 0.36], [0.11, 0.42], [0.06, 0.45]], Math.PI, 3.2))} material={C.charcoal()} scale={[1, 1, 1.25]} />
    </group>
  ),
  Upper: () => <mesh geometry={sleeve("hoodie-upper", UPPER_SLEEVE)} material={C.charcoal()} />,
  Fore: () => (
    <>
      <mesh geometry={sleeve("hoodie-fore", FORE_SLEEVE)} material={C.charcoal()} />
      <mesh geometry={TORUS} material={C.grey()} position={[0, -0.235, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, 0.04, 0.12]} />
    </>
  ),
  Hips: () => trunks(C.navy()),
  Thigh: () => <mesh geometry={sleeve("jogger-thigh", PANT_THIGH)} material={C.navy()} />,
  Shin: () => (
    <>
      <mesh geometry={sleeve("jogger-shin", PANT_SHIN)} material={C.navy()} />
      <mesh geometry={TORUS} material={C.grey()} position={[0, -0.39, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.045, 0.045, 0.12]} />
    </>
  ),
  Foot: () => (
    <>
      <mesh geometry={shoeGeo("sneaker", [[0.001, -0.055], [0.03, -0.052], [0.043, -0.03], [0.046, 0.03], [0.044, 0.09], [0.036, 0.13], [0.02, 0.155], [0.001, 0.16]])} material={cloth("#f4f4f2")} position={[0, -0.034, 0]} />
      <mesh geometry={box(0.086, 0.014, 0.215, 0.006)} material={leather("#ff5a36")} position={[0, -0.051, 0.052]} />
    </>
  ),
};

const Suit: OutfitVariant = {
  Chest: ({ fit }) => (
    <group scale={fit}>
      <mesh geometry={wrap("suit-shirt", -0.1, 0.36, 1.045)} material={C.white()} />
      <mesh geometry={wrap("suit-jacket", -0.12, 0.35, 1.09, 0.7)} material={C.charcoal()} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.035, 0.17, 0.008, 0.004)} material={C.charcoal()} position={[s * 0.05, 0.26, 0.142]} rotation={[-0.2, s * 0.25, s * 0.4]} />
      ))}
      <mesh geometry={box(0.028, 0.2, 0.008, 0.004)} material={cloth("#1f4fa8", "#9ab8ff")} position={[0, 0.2, 0.146]} rotation={[-0.08, 0, 0]} />
      <mesh geometry={box(0.03, 0.022, 0.012, 0.004)} material={cloth("#1f4fa8", "#9ab8ff")} position={[0, 0.31, 0.135]} />
      <mesh geometry={box(0.03, 0.012, 0.006, 0.002)} material={C.white()} position={[0.1, 0.22, 0.14]} rotation={[0, 0.4, 0]} />
    </group>
  ),
  Upper: () => <mesh geometry={sleeve("suit-upper", UPPER_SLEEVE)} material={C.charcoal()} />,
  Fore: () => (
    <>
      <mesh geometry={sleeve("suit-fore", FORE_SLEEVE)} material={C.charcoal()} />
      <mesh geometry={sleeve("suit-cuff", [[0.042, -0.225], [0.042, -0.245]])} material={C.white()} />
    </>
  ),
  Hips: () => (
    <>
      {trunks(C.charcoal())}
      <Belt strap={leather("#141414")} buckle={metal("#d9dde2", 0.15)} y={0.07} r={0.142} />
    </>
  ),
  Thigh: () => <mesh geometry={sleeve("trouser-thigh", PANT_THIGH)} material={C.charcoal()} />,
  Shin: () => <mesh geometry={sleeve("trouser-shin", PANT_SHIN)} material={C.charcoal()} />,
  Foot: () => <mesh geometry={shoeGeo("oxford", [[0.001, -0.05], [0.026, -0.048], [0.037, -0.03], [0.04, 0.02], [0.038, 0.08], [0.03, 0.125], [0.016, 0.15], [0.001, 0.157]])} material={leather("#141414")} position={[0, -0.035, 0]} />,
};

export const OUTFIT_VARIANTS: Record<OutfitId, OutfitVariant> = {
  none: NONE,
  warrior: Warrior,
  mage: Mage,
  rogue: Rogue,
  paladin: Paladin,
  ranger: Ranger,
  necro: Necro,
  samurai: Samurai,
  pirate: Pirate,
  hoodie: Hoodie,
  suit: Suit,
};
