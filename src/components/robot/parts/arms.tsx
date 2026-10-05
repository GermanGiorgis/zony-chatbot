import * as THREE from "three";
import type { ArmsId } from "../catalog";
import {
  box,
  capsule,
  CONE,
  CYL,
  fixed,
  geo,
  HEMI,
  lathe,
  plate,
  SPHERE,
  span,
  TORUS,
  type MatKey,
  type Mats,
  type SideProps,
  type V2,
  type V3,
} from "../kit";
import type { HandStyle } from "./hand";

/**
 * Upper: arm bone space, origin at the shoulder, elbow at y = -0.29.
 * Fore: elbow bone space, wrist at y = -0.262.
 */
export type ArmVariant = {
  Upper: (p: SideProps) => React.JSX.Element;
  Fore: (p: SideProps) => React.JSX.Element;
  hand: HandStyle;
};

/* ------------------------------------------------------------------ shared */

const nsFore = () =>
  geo("fore:ns", () =>
    lathe([[0.026, -0.25], [0.031, -0.225], [0.041, -0.16], [0.046, -0.09], [0.045, -0.04], [0.038, -0.012], [0.028, 0.004]], 40),
  );
/** Smooth shell upper arm (shoulder space, elbow at y=-0.29): human-thick taper, no muscle bulges. */
const nsUpper = () =>
  geo("upper:ns", () => lathe([[0.032, -0.285], [0.037, -0.23], [0.044, -0.15], [0.048, -0.07], [0.046, -0.02], [0.034, 0.025], [0.016, 0.045]], 40));
const ATHLETE_UPPER: V2[] = [[0.029, -0.29], [0.034, -0.255], [0.042, -0.18], [0.046, -0.11], [0.05, -0.05], [0.047, -0.005], [0.03, 0.035], [0.001, 0.05]];
const athleteUpper = () => geo("upper:athlete", () => lathe(ATHLETE_UPPER, 40));

const hazard = () => fixed("hazard", () => new THREE.MeshStandardMaterial({ color: "#f5c518", roughness: 0.5, metalness: 0.2 }));

export function Elbow({ M, material = "chrome", k = 1 }: { M: Mats; material?: MatKey; k?: number }) {
  return (
    <>
      <mesh geometry={CYL} material={M[material]} scale={[0.029 * k, 0.062 * k, 0.029 * k]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={SPHERE} material={M[material]} scale={[0.02 * k, 0.022 * k, 0.018 * k]} position={[0, 0, -0.022 * k]} />
    </>
  );
}

/** A ring of capsules from `top` to `bottom` around the bone axis: muscle bundles, cables, fibres. */
export function Bundle({ M, material, top, bottom, count, r, spread, twist = 0 }: { M: Mats; material: MatKey; top: number; bottom: number; count: number; r: number; spread: number; twist?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const a2 = a + twist;
        const p = span([Math.sin(a) * spread, top, Math.cos(a) * spread], [Math.sin(a2) * spread * 0.8, bottom, Math.cos(a2) * spread * 0.8]);
        return <mesh key={i} geometry={capsule(r, p.length)} material={M[material]} position={p.position} rotation={p.rotation} />;
      })}
    </>
  );
}

/** Hydraulic piston: dark sleeve from `a`, polished rod to `b`. */
export function Piston({ M, a, b, r = 0.009 }: { M: Mats; a: V3; b: V3; r?: number }) {
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const sleeve = span(a, mid);
  const rod = span(mid, b);
  return (
    <>
      <mesh geometry={CYL} material={M.darkMetal} position={sleeve.position} rotation={sleeve.rotation} scale={[r, sleeve.length, r]} />
      <mesh geometry={CYL} material={M.chrome} position={rod.position} rotation={rod.rotation} scale={[r * 0.55, rod.length, r * 0.55]} />
      <mesh geometry={SPHERE} material={M.chrome} position={a} scale={r * 1.2} />
      <mesh geometry={SPHERE} material={M.chrome} position={b} scale={r * 1.2} />
    </>
  );
}

/** Stacked alternating rings: the "accordion" tube of old tin robots. */
export function Accordion({ M, top, bottom, r, count }: { M: Mats; top: number; bottom: number; r: number; count: number }) {
  return (
    <>
      <mesh geometry={CYL} material={M.darkMetal} position={[0, (top + bottom) / 2, 0]} scale={[r * 0.7, top - bottom, r * 0.7]} />
      {Array.from({ length: count }, (_, i) => top - ((i + 0.5) / count) * (top - bottom)).map((y, i) => (
        <mesh key={y} geometry={TORUS} material={i % 2 ? M.chrome : M.shell} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[r, r, (top - bottom) / count / 0.28]} />
      ))}
    </>
  );
}

/** A glowing seam line along a limb. */
function Vein({ M, top, bottom, z }: { M: Mats; top: number; bottom: number; z: number }) {
  return <mesh geometry={capsule(0.003, top - bottom)} material={M.glowSoft} position={[0, (top + bottom) / 2, z]} />;
}

/* ----------------------------------------------------------------- variants */

const NS: ArmVariant = {
  hand: { palm: "shell", finger: "shell", joint: "muscle" },
  // Like the reference mannequin: glossy dark sleeve from shoulder to elbow, pale forearm and hand, dark joints.
  Upper: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.muscle} scale={0.056} />
      <mesh geometry={nsUpper()} material={M.muscle} />
    </>
  ),
  Fore: ({ M }) => (
    <>
      <Elbow M={M} material="muscle" k={1.25} />
      <mesh geometry={nsFore()} material={M.shell} />
      <mesh geometry={TORUS} material={M.muscle} position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.047, 0.044, 0.03]} />
      <mesh geometry={TORUS} material={M.muscle} position={[0, -0.247, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.029, 0.025, 0.03]} />
    </>
  ),
};

const Athlete: ArmVariant = {
  hand: { palm: "shell", finger: "shell", joint: "shell" },
  Upper: ({ M }) => (
    <>
      <mesh geometry={athleteUpper()} material={M.shell} />
      <mesh geometry={SPHERE} material={M.shell} scale={[0.05, 0.048, 0.05]} position={[0, 0.005, 0]} />
    </>
  ),
  Fore: ({ M }) => (
    <>
      <Elbow M={M} material="shell" />
      <mesh geometry={nsFore()} material={M.shell} />
    </>
  ),
};

const Armored: ArmVariant = {
  hand: { palm: "shell", finger: "chrome", joint: "darkMetal", thick: 1.15 },
  Upper: (p) => {
    const { M, s } = p;
    return (
      <>
        <NS.Upper {...p} />
        <group rotation={[0, 0, -s * 0.35]}>
          <mesh geometry={HEMI} material={M.shell} position={[s * 0.01, 0.0, 0]} scale={[0.075, 0.066, 0.072]} />
          <mesh geometry={TORUS} material={M.chrome} position={[s * 0.01, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.075, 0.072, 0.1]} />
          {[0, 1].map((i) => (
            <mesh
              key={i}
              geometry={geo(`pauldron-lame${i}`, () => plate([[0.08 - i * 0.004, -0.045 - i * 0.03], [0.078 - i * 0.004, -0.015 - i * 0.03]], Math.PI / 2, 3.4))}
              material={i ? M.chrome : M.shell}
              scale={[s, 1, 1]}
            />
          ))}
        </group>
        <mesh geometry={geo("rerebrace", () => plate([[0.045, -0.25], [0.05, -0.17], [0.052, -0.1]], Math.PI / 2, 2.6))} material={M.shell} scale={[s, 1, 1]} />
      </>
    );
  },
  Fore: ({ M, s }) => (
    <>
      <Elbow M={M} />
      <mesh geometry={SPHERE} material={M.chrome} position={[0, 0, -0.03]} scale={[0.03, 0.03, 0.012]} />
      <mesh geometry={CONE} material={M.chrome} position={[0, 0, -0.05]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.03, 0.01]} />
      <mesh geometry={geo("gauntlet", () => lathe([[0.026, -0.25], [0.03, -0.225], [0.042, -0.12], [0.052, -0.045], [0.05, -0.015]], 36))} material={M.shell} />
      {[-0.05, -0.22].map((y) => (
        <mesh key={y} geometry={TORUS} material={M.chrome} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[y < -0.1 ? 0.031 : 0.051, y < -0.1 ? 0.031 : 0.051, 0.06]} />
      ))}
      <mesh geometry={box(0.012, 0.12, 0.02, 0.004)} material={M.chrome} position={[s * 0.045, -0.11, 0]} />
    </>
  ),
};

const Skeleton: ArmVariant = {
  hand: { palm: "chrome", finger: "chrome", joint: "chrome", bones: true },
  Upper: ({ M, s }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.038} />
      <mesh geometry={capsule(0.012, 0.24)} material={M.chrome} position={[0, -0.145, 0]} />
      <mesh geometry={SPHERE} material={M.chrome} position={[0, -0.27, 0]} scale={[0.026, 0.018, 0.02]} />
      <Piston M={M} a={[s * 0.01, -0.03, 0.03]} b={[0, -0.25, 0.028]} />
      <mesh geometry={capsule(0.006, 0.22)} material={M.muscle} position={[-s * 0.012, -0.14, -0.022]} />
    </>
  ),
  Fore: ({ M, s }) => (
    <>
      <Elbow M={M} />
      {[0.013, -0.013].map((x) => (
        <mesh key={x} geometry={capsule(0.0075, 0.23)} material={M.chrome} position={[x * s, -0.13, 0]} rotation={[0, 0, x * 0.05]} />
      ))}
      <Piston M={M} a={[0, -0.03, 0.022]} b={[0, -0.22, 0.016]} r={0.007} />
      <mesh geometry={box(0.04, 0.016, 0.022, 0.006)} material={M.chrome} position={[0, -0.25, 0]} />
    </>
  ),
};

const Cables: ArmVariant = {
  hand: { palm: "darkMetal", finger: "darkMetal", joint: "chrome" },
  Upper: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.darkMetal} scale={0.044} />
      <mesh geometry={CYL} material={M.darkMetal} position={[0, -0.145, 0]} scale={[0.014, 0.29, 0.014]} />
      <Bundle M={M} material="cables" top={-0.02} bottom={-0.27} count={6} r={0.013} spread={0.025} twist={0.6} />
      <mesh geometry={TORUS} material={M.chrome} position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.042, 0.042, 0.08]} />
    </>
  ),
  Fore: ({ M }) => (
    <>
      <Elbow M={M} material="darkMetal" />
      <Bundle M={M} material="cables" top={-0.02} bottom={-0.24} count={5} r={0.011} spread={0.02} twist={-0.5} />
      <mesh geometry={TORUS} material={M.chrome} position={[0, -0.24, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.028, 0.028, 0.08]} />
    </>
  ),
};

const Hydraulic: ArmVariant = {
  hand: { palm: "darkMetal", finger: "chrome", joint: "darkMetal", thick: 1.2 },
  Upper: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.05} />
      <mesh geometry={box(0.045, 0.24, 0.045, 0.01)} material={M.darkMetal} position={[0, -0.15, 0]} />
      <mesh geometry={box(0.05, 0.03, 0.05, 0.006)} material={hazard()} position={[0, -0.06, 0]} />
      <Piston M={M} a={[0, -0.03, 0.036]} b={[0, -0.27, 0.034]} r={0.011} />
      <Piston M={M} a={[0, -0.03, -0.036]} b={[0, -0.27, -0.034]} r={0.011} />
    </>
  ),
  Fore: ({ M }) => (
    <>
      <Elbow M={M} />
      <mesh geometry={box(0.042, 0.2, 0.042, 0.01)} material={M.darkMetal} position={[0, -0.12, 0]} />
      <Piston M={M} a={[0, -0.02, 0.032]} b={[0, -0.22, 0.03]} r={0.009} />
      <mesh geometry={box(0.06, 0.04, 0.06, 0.01)} material={M.chrome} position={[0, -0.235, 0]} />
    </>
  ),
};

const Mecha: ArmVariant = {
  hand: { palm: "darkMetal", finger: "shell", joint: "darkMetal" },
  Upper: ({ M, s }) => (
    <>
      <mesh geometry={box(0.11, 0.08, 0.1, 0.012)} material={M.shell} position={[s * 0.012, 0.0, 0]} rotation={[0, 0, -s * 0.12]} />
      <mesh geometry={box(0.06, 0.012, 0.07, 0.003)} material={M.darkMetal} position={[s * 0.02, 0.038, 0]} rotation={[0, 0, -s * 0.12]} />
      <mesh geometry={CYL} material={M.darkMetal} position={[0, -0.15, 0]} scale={[0.024, 0.26, 0.024]} />
      <mesh geometry={box(0.062, 0.16, 0.066, 0.01)} material={M.shell} position={[0, -0.17, 0]} />
      <mesh geometry={box(0.066, 0.01, 0.07, 0.003)} material={M.chrome} position={[0, -0.1, 0]} />
    </>
  ),
  Fore: ({ M }) => (
    <>
      <Elbow M={M} material="darkMetal" />
      <mesh geometry={CONE} material={M.chrome} position={[0, 0.005, -0.045]} rotation={[-Math.PI / 2 - 0.3, 0, 0]} scale={[0.012, 0.045, 0.012]} />
      <mesh geometry={box(0.066, 0.18, 0.07, 0.012)} material={M.shell} position={[0, -0.12, 0]} />
      <mesh geometry={box(0.07, 0.03, 0.074, 0.006)} material={M.darkMetal} position={[0, -0.225, 0]} />
      <mesh geometry={box(0.012, 0.1, 0.004, 0.002)} material={M.glowSoft} position={[0, -0.12, 0.036]} />
    </>
  ),
};

const Retro: ArmVariant = {
  hand: { palm: "chrome", finger: "chrome", joint: "darkMetal", thick: 1.2 },
  Upper: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.045} />
      <Accordion M={M} top={-0.03} bottom={-0.27} r={0.036} count={9} />
    </>
  ),
  Fore: ({ M }) => (
    <>
      <Elbow M={M} />
      <Accordion M={M} top={-0.03} bottom={-0.215} r={0.032} count={7} />
      <mesh geometry={CYL} material={M.shell} position={[0, -0.235, 0]} scale={[0.036, 0.04, 0.036]} />
    </>
  ),
};

const Crystal: ArmVariant = {
  hand: { palm: "glass", finger: "glass", joint: "glowSoft" },
  Upper: ({ M }) => (
    <>
      <mesh geometry={SPHERE} material={M.chrome} scale={0.038} />
      <mesh geometry={capsule(0.008, 0.25)} material={M.chrome} position={[0, -0.145, 0]} />
      <mesh geometry={athleteUpper()} material={M.glass} renderOrder={2} />
      <Vein M={M} top={-0.03} bottom={-0.26} z={0.02} />
    </>
  ),
  Fore: ({ M }) => (
    <>
      <Elbow M={M} />
      <mesh geometry={capsule(0.007, 0.22)} material={M.chrome} position={[0, -0.13, 0]} />
      <mesh geometry={nsFore()} material={M.glass} renderOrder={2} />
      <Vein M={M} top={-0.03} bottom={-0.23} z={0.018} />
    </>
  ),
};

const Claws: ArmVariant = {
  hand: { palm: "darkMetal", finger: "darkMetal", joint: "chrome", thick: 1.1, claws: true },
  Upper: (p) => {
    const { M, s } = p;
    return (
      <>
        <NS.Upper {...p} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={CONE} material={M.chrome} position={[s * (0.03 + i * 0.004), 0.035 - i * 0.012, -0.02 + i * 0.02]} rotation={[0, 0, -s * (0.5 + i * 0.25)]} scale={[0.012, 0.05, 0.012]} />
        ))}
      </>
    );
  },
  Fore: ({ M, s }) => (
    <>
      <Elbow M={M} />
      <mesh geometry={geo("fore:heavy", () => lathe([[0.03, -0.25], [0.036, -0.22], [0.048, -0.15], [0.054, -0.08], [0.05, -0.03], [0.04, -0.005], [0.02, 0.004]], 36))} material={M.shell} />
      {[-0.06, -0.11, -0.16].map((y, i) => (
        <mesh key={y} geometry={CONE} material={M.chrome} position={[s * 0.05, y, -0.01]} rotation={[0.2, 0, -s * (1.2 - i * 0.1)]} scale={[0.008, 0.07, 0.02]} />
      ))}
    </>
  ),
};

export const ARM_VARIANTS: Record<ArmsId, ArmVariant> = {
  ns: NS,
  athlete: Athlete,
  armored: Armored,
  skeleton: Skeleton,
  cables: Cables,
  hydraulic: Hydraulic,
  mecha: Mecha,
  retro: Retro,
  crystal: Crystal,
  claws: Claws,
};

export { nsFore, hazard, ATHLETE_UPPER };
