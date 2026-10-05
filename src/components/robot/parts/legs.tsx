import * as THREE from "three";
import type { LegsId } from "../catalog";
import { box, bump, capsule, CONE, CYL, geo, lathe, plate, sculpt, SPHERE, TORUS, type Mats, type MatKey, type SideProps, type V2 } from "../kit";
import { Accordion, Bundle, hazard, Piston } from "./arms";

/**
 * Thigh: thigh bone space, origin at the hip socket, knee at y = -0.45.
 * Shin: knee space, ankle at y = -0.43.
 * Foot: ankle space, floor at y ≈ -0.058.
 */
export type LegVariant = {
  Thigh: (p: SideProps) => React.JSX.Element;
  Shin: (p: SideProps) => React.JSX.Element;
  Foot: (p: SideProps) => React.JSX.Element;
};

/* ------------------------------------------------------------------ shared */

const nsShin = () =>
  geo("shin:ns", () =>
    sculpt(
      [[0.028, -0.415], [0.033, -0.37], [0.043, -0.26], [0.05, -0.16], [0.049, -0.07], [0.044, -0.02], [0.036, 0.012]],
      40,
      40,
      (v) => {
        if (v.z < 0) v.z *= 1 + 0.45 * bump((v.y + 0.13) / 0.075, 0);
      },
    ),
  );

/** Smooth shell thigh (hip space, knee at y=-0.45): human-thick taper, no muscle bulges. */
const nsThigh = () =>
  geo("thigh:ns", () => lathe([[0.04, -0.44], [0.048, -0.36], [0.058, -0.24], [0.064, -0.12], [0.062, -0.04], [0.05, 0.01], [0.024, 0.04]], 40));

const athleteThigh = () =>
  geo("thigh:athlete", () =>
    sculpt([[0.038, -0.445], [0.043, -0.4], [0.054, -0.3], [0.061, -0.18], [0.062, -0.08], [0.056, -0.02], [0.04, 0.03], [0.001, 0.05]], 40, 40, (v) => {
      if (v.z > 0) v.z *= 1 + 0.12 * bump((v.y + 0.2) / 0.12, 0);
    }),
  );

/** A shoe-shaped pod along +Z with a flat sole. */
export function shoeGeo(key: string, profile: V2[], flat = 0.62) {
  return geo(`shoe:${key}`, () => {
    const g = sculpt(profile, 32, 40);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.y *= flat;
      if (v.y < -0.021) v.y = -0.021;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

const NS_SHOE: V2[] = [[0.001, -0.05], [0.029, -0.048], [0.041, -0.03], [0.044, 0.02], [0.042, 0.08], [0.034, 0.12], [0.018, 0.145], [0.001, 0.152]];
const BOOT: V2[] = [[0.001, -0.055], [0.03, -0.052], [0.042, -0.03], [0.046, 0.03], [0.044, 0.09], [0.036, 0.13], [0.02, 0.155], [0.001, 0.162]];

export function Knee({ M, material = "chrome", k = 1 }: { M: Mats; material?: MatKey; k?: number }) {
  return (
    <>
      <mesh geometry={CYL} material={M[material]} scale={[0.034 * k, 0.074 * k, 0.034 * k]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={SPHERE} material={M[material]} scale={[0.028 * k, 0.034 * k, 0.016 * k]} position={[0, 0.004, 0.032 * k]} />
    </>
  );
}

function Shoe({ M, material = "chrome", sole = "darkMetal", joint = "chrome", profile = NS_SHOE, id = "ns" }: { M: Mats; material?: MatKey; sole?: MatKey; joint?: MatKey; profile?: V2[]; id?: string }) {
  return (
    <>
      <mesh geometry={SPHERE} material={M[joint]} scale={0.032} />
      <mesh geometry={shoeGeo(id, profile)} material={M[material]} position={[0, -0.036, 0.0]} />
      <mesh geometry={box(0.088, 0.008, 0.2, 0.004)} material={M[sole]} position={[0, -0.054, 0.048]} />
    </>
  );
}

function Vein({ M, top, bottom, z }: { M: Mats; top: number; bottom: number; z: number }) {
  return <mesh geometry={capsule(0.003, top - bottom)} material={M.glowSoft} position={[0, (top + bottom) / 2, z]} />;
}

/* ----------------------------------------------------------------- variants */

const NS: LegVariant = {
  // Like the reference mannequin: glossy dark thigh, pale shin and shoe, dark knee and ankle joints.
  Thigh: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.muscle} scale={0.064} />
      <mesh geometry={nsThigh()} material={M.muscle} />
    </>
  ),
  Shin: ({ M }) => (
    <>
      <Knee M={M} material="muscle" k={1.4} />
      <mesh geometry={nsShin()} material={M.shell} />
      <mesh geometry={TORUS} material={M.muscle} position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.056, 0.052, 0.03]} />
    </>
  ),
  Foot: ({ M }) => <Shoe M={M} material="shell" sole="muscle" joint="muscle" />,
};

const Athlete: LegVariant = {
  Thigh: ({ M }) => <mesh geometry={athleteThigh()} material={M.shell} />,
  Shin: ({ M }) => (
    <>
      <Knee M={M} material="shell" />
      <mesh geometry={nsShin()} material={M.shell} />
    </>
  ),
  Foot: ({ M }) => <Shoe M={M} material="shell" />,
};

const Armored: LegVariant = {
  Thigh: (p) => (
    <>
      <NS.Thigh {...p} />
      <mesh geometry={geo("cuisse", () => plate([[0.05, -0.36], [0.064, -0.22], [0.066, -0.1], [0.06, -0.03]], 0, 2.6))} material={p.M.shell} />
      <mesh geometry={geo("cuisse-trim", () => plate([[0.067, -0.105], [0.068, -0.095]], 0, 2.7))} material={p.M.chrome} />
    </>
  ),
  Shin: ({ M }) => (
    <>
      <Knee M={M} />
      <mesh geometry={HEMI_KNEE()} material={M.chrome} position={[0, 0.0, 0.03]} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, 0.03, 0.045]} />
      <mesh geometry={geo("greave", () => lathe([[0.028, -0.41], [0.034, -0.37], [0.042, -0.26], [0.047, -0.15], [0.045, -0.06], [0.04, -0.02]], 36))} material={M.shell} />
      <mesh geometry={TORUS} material={M.chrome} position={[0, -0.39, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.033, 0.033, 0.07]} />
    </>
  ),
  Foot: ({ M }) => (
    <>
      <Shoe M={M} material="chrome" profile={BOOT} id="boot" />
      {[0.02, 0.06, 0.1].map((z, i) => (
        <mesh key={z} geometry={geo(`sabaton${i}`, () => plate([[0.044 - i * 0.004, -0.025], [0.046 - i * 0.004, 0.005]], 0, 2.6))} material={M.shell} position={[0, -0.03, z]} rotation={[Math.PI / 2 - 0.35, 0, 0]} scale={[1, 1, 0.7]} />
      ))}
    </>
  ),
};

const HEMI_KNEE = () => geo("hemi-knee", () => new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));

const Skeleton: LegVariant = {
  Thigh: ({ M, s }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.04} />
      <mesh geometry={capsule(0.015, 0.36)} material={M.chrome} position={[0, -0.22, 0]} />
      <mesh geometry={SPHERE} material={M.chrome} position={[0, -0.42, 0]} scale={[0.032, 0.022, 0.026]} />
      <Piston M={M} a={[s * 0.02, -0.04, 0.03]} b={[s * 0.01, -0.4, 0.03]} r={0.011} />
      <mesh geometry={capsule(0.007, 0.34)} material={M.muscle} position={[-s * 0.018, -0.22, -0.02]} />
    </>
  ),
  Shin: ({ M, s }) => (
    <>
      <Knee M={M} />
      <mesh geometry={capsule(0.012, 0.36)} material={M.chrome} position={[s * 0.006, -0.21, 0.004]} />
      <mesh geometry={capsule(0.007, 0.33)} material={M.chrome} position={[-s * 0.016, -0.21, -0.008]} />
      <Piston M={M} a={[0, -0.04, -0.025]} b={[0, -0.36, -0.02]} r={0.008} />
    </>
  ),
  Foot: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.024} />
      <mesh geometry={box(0.03, 0.03, 0.05, 0.01)} material={M.chrome} position={[0, -0.04, -0.02]} />
      {[-0.024, -0.008, 0.008, 0.024].map((x) => (
        <mesh key={x} geometry={capsule(0.006, 0.12)} material={M.chrome} position={[x, -0.05, 0.06]} rotation={[Math.PI / 2, 0, x * 1.5]} />
      ))}
    </>
  ),
};

const Cables: LegVariant = {
  Thigh: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.darkMetal} scale={0.048} />
      <mesh geometry={CYL} material={M.darkMetal} position={[0, -0.225, 0]} scale={[0.018, 0.45, 0.018]} />
      <Bundle M={M} material="cables" top={-0.03} bottom={-0.42} count={7} r={0.016} spread={0.033} twist={0.5} />
    </>
  ),
  Shin: ({ M }) => (
    <>
      <Knee M={M} material="darkMetal" />
      <Bundle M={M} material="cables" top={-0.03} bottom={-0.4} count={6} r={0.012} spread={0.024} twist={-0.4} />
      <mesh geometry={TORUS} material={M.chrome} position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.035, 0.035, 0.08]} />
    </>
  ),
  Foot: ({ M }) => <Shoe M={M} material="darkMetal" sole="chrome" />,
};

const Hydraulic: LegVariant = {
  Thigh: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.052} />
      <mesh geometry={box(0.06, 0.38, 0.06, 0.012)} material={M.darkMetal} position={[0, -0.23, 0]} />
      <mesh geometry={box(0.066, 0.04, 0.066, 0.008)} material={hazard()} position={[0, -0.12, 0]} />
      <Piston M={M} a={[0.0, -0.04, 0.048]} b={[0, -0.42, 0.045]} r={0.014} />
      <Piston M={M} a={[0.0, -0.04, -0.048]} b={[0, -0.42, -0.045]} r={0.014} />
    </>
  ),
  Shin: ({ M }) => (
    <>
      <Knee M={M} />
      <mesh geometry={box(0.056, 0.34, 0.056, 0.012)} material={M.darkMetal} position={[0, -0.2, 0]} />
      <Piston M={M} a={[0, -0.03, 0.042]} b={[0, -0.38, 0.04]} r={0.012} />
    </>
  ),
  Foot: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.028} />
      <mesh geometry={box(0.095, 0.05, 0.21, 0.014)} material={M.darkMetal} position={[0, -0.032, 0.045]} />
      <mesh geometry={box(0.1, 0.03, 0.06, 0.01)} material={M.chrome} position={[0, -0.04, 0.12]} />
      <mesh geometry={box(0.1, 0.012, 0.215, 0.004)} material={hazard()} position={[0, -0.052, 0.045]} />
    </>
  ),
};

const Mecha: LegVariant = {
  Thigh: ({ M, s }) => (
    <>
      <mesh geometry={SPHERE} material={M.darkMetal} scale={0.05} />
      <mesh geometry={CYL} material={M.darkMetal} position={[0, -0.225, 0]} scale={[0.028, 0.42, 0.028]} />
      <mesh geometry={box(0.09, 0.3, 0.095, 0.014)} material={M.shell} position={[0, -0.2, 0.004]} />
      <mesh geometry={box(0.02, 0.24, 0.07, 0.006)} material={M.darkMetal} position={[s * 0.05, -0.2, 0]} />
    </>
  ),
  Shin: ({ M }) => (
    <>
      <Knee M={M} material="darkMetal" />
      <mesh geometry={box(0.06, 0.08, 0.04, 0.01)} material={M.shell} position={[0, 0.01, 0.045]} rotation={[-0.3, 0, 0]} />
      <mesh geometry={box(0.075, 0.32, 0.085, 0.014)} material={M.shell} position={[0, -0.2, 0]} />
      {[-0.12, -0.2, -0.28].map((y) => (
        <mesh key={y} geometry={box(0.05, 0.014, 0.01, 0.003)} material={M.darkMetal} position={[0, y, -0.044]} />
      ))}
    </>
  ),
  Foot: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.darkMetal} scale={0.028} />
      <mesh geometry={box(0.09, 0.045, 0.22, 0.012)} material={M.shell} position={[0, -0.034, 0.045]} />
      <mesh geometry={box(0.094, 0.012, 0.225, 0.004)} material={M.darkMetal} position={[0, -0.052, 0.045]} />
      <mesh geometry={box(0.05, 0.03, 0.03, 0.008)} material={M.darkMetal} position={[0, -0.02, 0.15]} rotation={[0.4, 0, 0]} />
    </>
  ),
};

const Retro: LegVariant = {
  Thigh: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.048} />
      <Accordion M={M} top={-0.04} bottom={-0.42} r={0.045} count={12} />
    </>
  ),
  Shin: ({ M }) => (
    <>
      <Knee M={M} />
      <Accordion M={M} top={-0.04} bottom={-0.39} r={0.038} count={11} />
    </>
  ),
  Foot: ({ M }) => (
    <>
      <mesh geometry={CYL} material={M.chrome} position={[0, -0.01, 0]} scale={[0.03, 0.03, 0.03]} />
      <mesh geometry={box(0.09, 0.05, 0.19, 0.014)} material={M.shell} position={[0, -0.033, 0.04]} />
      <mesh geometry={box(0.094, 0.01, 0.195, 0.004)} material={M.chrome} position={[0, -0.053, 0.04]} />
    </>
  ),
};

const Crystal: LegVariant = {
  Thigh: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.042} />
      <mesh geometry={capsule(0.012, 0.36)} material={M.chrome} position={[0, -0.22, 0]} />
      <mesh geometry={athleteThigh()} material={M.glass} renderOrder={2} />
      <Vein M={M} top={-0.04} bottom={-0.41} z={0.03} />
    </>
  ),
  Shin: ({ M }) => (
    <>
      <Knee M={M} />
      <mesh geometry={capsule(0.01, 0.34)} material={M.chrome} position={[0, -0.21, 0]} />
      <mesh geometry={nsShin()} material={M.glass} renderOrder={2} />
      <Vein M={M} top={-0.04} bottom={-0.38} z={0.028} />
    </>
  ),
  Foot: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.026} />
      <mesh geometry={shoeGeo("ns", NS_SHOE)} material={M.glass} position={[0, -0.036, 0]} renderOrder={2} />
      <mesh geometry={box(0.072, 0.006, 0.2, 0.003)} material={M.glowSoft} position={[0, -0.055, 0.048]} />
    </>
  ),
};

const Jets: LegVariant = {
  Thigh: NS.Thigh,
  Shin: ({ M }) => (
    <>
      <Knee M={M} />
      <mesh geometry={nsShin()} material={M.shell} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.018, -0.2, -0.05]} rotation={[0.1, 0, 0]}>
          <mesh geometry={CYL} material={M.chrome} scale={[0.012, 0.12, 0.012]} />
          <mesh geometry={CONE} material={M.darkMetal} position={[0, -0.07, 0]} rotation={[Math.PI, 0, 0]} scale={[0.016, 0.03, 0.016]} />
          <mesh geometry={SPHERE} material={M.glow} position={[0, -0.086, 0]} scale={[0.01, 0.005, 0.01]} />
        </group>
      ))}
    </>
  ),
  Foot: ({ M }) => (
    <>
      <Shoe M={M} material="shell" sole="chrome" profile={BOOT} id="boot" />
      <mesh geometry={CYL} material={M.darkMetal} position={[0, -0.02, -0.035]} scale={[0.03, 0.04, 0.03]} />
      <mesh geometry={CONE} material={M.glowSoft} position={[0, -0.075, -0.035]} rotation={[Math.PI, 0, 0]} scale={[0.02, 0.05, 0.02]} />
    </>
  ),
};

export const LEG_VARIANTS: Record<LegsId, LegVariant> = {
  ns: NS,
  athlete: Athlete,
  armored: Armored,
  skeleton: Skeleton,
  cables: Cables,
  hydraulic: Hydraulic,
  mecha: Mecha,
  retro: Retro,
  crystal: Crystal,
  jets: Jets,
};

export { nsShin, NS_SHOE, BOOT };
