import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TorsoId } from "../catalog";
import {
  box,
  bump,
  capsule,
  CYL,
  fixed,
  geo,
  plate,
  RING,
  sculpt,
  smoothstep,
  SPHERE,
  span,
  TORUS,
  tube,
  type Kit,
  type V2,
  type V3,
} from "../kit";

/**
 * Bone spaces (see Robot.tsx):
 * - Chest: origin at the chest joint. Shoulders at (±0.2, 0.275), neck base at (0, 0.35).
 * - Waist: spine space. Pelvis top at y≈0.017, chest joint at y=0.22.
 * - Pelvis: hips space. Thigh sockets at (±0.09, -0.04).
 * - Neck: neck space. Head bone at y=0.1.
 */
export type TorsoVariant = {
  Chest: (k: Kit) => React.JSX.Element;
  Waist: (k: Kit) => React.JSX.Element;
  Pelvis: (k: Kit) => React.JSX.Element;
  Neck: (k: Kit) => React.JSX.Element;
  /** Scale applied to outfit chest pieces so clothes hug bulkier or slimmer torsos. */
  fit: V3;
};

/* ------------------------------------------------------------ shared shapes */

/** Human build: a defined waist widening into the chest and shoulders, not a barrel. */
const SHELL_PROFILE: V2[] = [
  [0.07, -0.1], [0.098, -0.095], [0.114, -0.075], [0.12, -0.04], [0.126, 0.01], [0.138, 0.08],
  [0.152, 0.15], [0.162, 0.21], [0.16, 0.255], [0.148, 0.292], [0.122, 0.325], [0.085, 0.35], [0.05, 0.362],
];
const widen = (y: number) => 0.9 + 0.12 * smoothstep(0.05, 0.24, y);
const shellDeform = (v: THREE.Vector3) => {
  v.x *= widen(v.y);
  v.z *= 0.7;
  if (v.z > 0) {
    v.z += 0.016 * bump((Math.abs(v.x) - 0.075) / 0.05, (v.y - 0.235) / 0.05);
    v.z -= 0.005 * bump(v.x / 0.012, 0) * smoothstep(-0.08, 0.02, v.y) * (1 - smoothstep(0.28, 0.33, v.y));
  }
};
const nsShell = () => geo("torso:ns", () => sculpt(SHELL_PROFILE, 64, 72, shellDeform));

/** Dark shoulder/upper-back panel, flush over the shell — the "yoke" of the classic NS silhouette. */
const nsBackYoke = () =>
  geo("back-yoke:ns", () =>
    sculpt(
      [[shellR(0.14) * 1.015, 0.14], [shellR(0.2) * 1.015, 0.2], [shellR(0.26) * 1.015, 0.26], [shellR(0.31) * 1.015, 0.31]],
      16,
      48,
      (v) => {
        v.x *= widen(v.y);
        v.z *= 0.7;
      },
      Math.PI - 1.05,
      2.1,
    ),
  );

/** Radius of the classic shell profile at height y (linear interpolation). */
function shellR(y: number) {
  const p = SHELL_PROFILE;
  if (y <= p[0][1]) return p[0][0];
  for (let i = 0; i < p.length - 1; i++) {
    const [r0, y0] = p[i];
    const [r1, y1] = p[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return p[p.length - 1][0];
}

/** A horizontal band of the classic shell between y0 and y1, puffed out by `grow`. */
const band = (key: string, y0: number, y1: number, grow: number) =>
  geo(`band:${key}`, () =>
    sculpt(
      [[shellR(y0) * grow, y0], [shellR((y0 + y1) / 2) * grow * 1.01, (y0 + y1) / 2], [shellR(y1) * grow, y1]],
      8,
      64,
      (v) => {
        v.x *= widen(v.y);
        v.z *= 0.72;
      },
    ),
  );

/** A flat shield-like plate: sharp bottom tip, wide chest-facing top — not a rounded lathe blob. */
const PELVIS_PROFILE: V2[] = [
  [0.0005, -0.1], [0.036, -0.094], [0.084, -0.064], [0.113, -0.024], [0.121, 0.01],
  [0.112, 0.04], [0.082, 0.063], [0.042, 0.075], [0.0005, 0.078],
];
const nsPelvis = () =>
  geo("pelvis:ns", () =>
    sculpt(PELVIS_PROFILE, 40, 56, (v) => {
      v.z *= 0.66;
      if (v.z > 0) {
        v.y -= 0.04 * bump(v.x / 0.05, 0) * smoothstep(0.02, -0.09, v.y);
        // Raised centre ridge/seam, like a stamped shield plate.
        v.z += 0.012 * bump(v.x / 0.016, 0) * smoothstep(-0.095, 0.02, v.y) * (1 - smoothstep(0.02, 0.076, v.y));
      }
      v.x *= 1 + 0.22 * smoothstep(0.0, 0.06, v.y);
    }),
  );

function SpineStack({ k, discs = [0.035, 0.065, 0.095, 0.125], glowing = false }: { k: Kit; discs?: number[]; glowing?: boolean }) {
  return (
    <>
      <mesh geometry={CYL} material={k.M.darkMetal} position={[0, 0.09, -0.01]} scale={[0.017, 0.18, 0.017]} />
      {discs.map((y) => (
        <group key={y} position={[0, y, -0.01]}>
          <mesh geometry={CYL} material={k.M.chrome} scale={[0.036, 0.013, 0.03]} />
          <mesh geometry={box(0.018, 0.012, 0.03, 0.004)} material={k.M.chrome} position={[0, 0, -0.03]} />
          {glowing && discs.indexOf(y) % 2 === 0 && <mesh geometry={RING} material={k.M.iris} rotation={[Math.PI / 2, 0, 0]} scale={[0.042, 0.036, 1]} />}
        </group>
      ))}
    </>
  );
}

function SideCables({ k, material = "muscle" }: { k: Kit; material?: "muscle" | "cables" | "darkMetal" }) {
  return (
    <>
      {[1, -1].flatMap((s) => [
        <mesh key={`f${s}`} geometry={tube(`waistF${s}`, [[s * 0.05, 0.0, 0.028], [s * 0.074, 0.07, 0.04], [s * 0.066, 0.15, 0.036]], 0.011)} material={k.M[material]} />,
        <mesh key={`b${s}`} geometry={tube(`waistB${s}`, [[s * 0.045, 0.0, -0.035], [s * 0.066, 0.07, -0.045], [s * 0.06, 0.15, -0.04]], 0.01)} material={k.M[material]} />,
      ])}
    </>
  );
}

function NsNeck({ M }: Kit) {
  return (
    <>
      <mesh geometry={CYL} material={M.chrome} position={[0, 0.05, -0.006]} scale={[0.017, 0.12, 0.017]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={capsule(0.0085, 0.085)} material={M.muscle} position={[s * 0.017, 0.05, 0.01]} rotation={[-0.25, 0, -s * 0.2]} />
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={CYL} material={M.chrome} scale={[0.005, 0.11, 0.005]} position={[s * 0.016, 0.05, -0.022]} />
      ))}
    </>
  );
}

function NsPelvis({ M, material = "chrome" }: Kit & { material?: "chrome" | "darkMetal" | "shell" | "muscle" }) {
  return (
    <>
      <mesh geometry={nsPelvis()} material={M[material]} />
      <mesh geometry={TORUS} material={M.darkMetal} scale={[0.117, 0.117, 0.09]} position={[0, 0.014, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={box(0.01, 0.07, 0.02, 0.004)} material={M.darkMetal} position={[0, -0.03, 0.075]} rotation={[0.3, 0, 0]} />
    </>
  );
}

function Core({ M, reg, y = 0.18, z = 0.04, r = 0.034 }: Kit & { y?: number; z?: number; r?: number }) {
  return (
    <group position={[0, y, z]}>
      <mesh geometry={SPHERE} material={M.glow} scale={r} />
      <mesh geometry={TORUS} material={M.chrome} scale={r * 1.35} />
      <pointLight ref={reg("core")} position={[0, 0, 0.04]} distance={0.7} decay={2} />
    </group>
  );
}

/* ---------------------------------------------------------------- classic */

const NS: TorsoVariant = {
  fit: [1, 1, 1],
  Chest: ({ M }) => (
    <>
      <mesh geometry={nsShell()} material={M.shell} />
      <mesh geometry={nsBackYoke()} material={M.muscle} />
      <mesh geometry={TORUS} material={M.chrome} position={[0, 0.358, -0.004]} rotation={[Math.PI / 2, 0, 0]} scale={[0.05, 0.036, 0.05]} />
    </>
  ),
  Waist: (k) => (
    <>
      <SpineStack k={k} />
      <SideCables k={k} />
    </>
  ),
  Pelvis: (k) => <NsPelvis {...k} material="muscle" />,
  Neck: (k) => <NsNeck {...k} />,
};

/* ---------------------------------------------------------------- crystal */

const Crystal: TorsoVariant = {
  fit: [1, 1, 1],
  Chest: (k) => (
    <>
      <mesh geometry={nsShell()} material={k.M.glass} renderOrder={2} />
      <mesh geometry={CYL} material={k.M.chrome} position={[0, 0.13, -0.06]} scale={[0.014, 0.46, 0.014]} />
      {[0.03, 0.09, 0.15, 0.21, 0.27].map((y) => (
        <mesh
          key={y}
          geometry={geo("rib-arc", () => new THREE.TorusGeometry(1, 0.05, 8, 40, Math.PI * 1.7))}
          material={k.M.chrome}
          position={[0, y, -0.012]}
          rotation={[Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.15]}
          scale={[shellR(y) * widen(y) * 0.86, shellR(y) * 0.56, 0.12]}
        />
      ))}
      <Core {...k} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={tube(`crystal-cable${s}`, [[s * 0.03, -0.08, -0.03], [s * 0.1, 0.1, 0.0], [s * 0.15, 0.26, -0.02], [s * 0.19, 0.275, 0]], 0.008)} material={k.M.muscle} />
      ))}
    </>
  ),
  Waist: (k) => (
    <>
      <SpineStack k={k} glowing />
      <SideCables k={k} />
    </>
  ),
  Pelvis: (k) => <NsPelvis {...k} />,
  Neck: (k) => <NsNeck {...k} />,
};

/* ---------------------------------------------------------------- armored */

const Armored: TorsoVariant = {
  fit: [1.06, 1, 1.08],
  Chest: ({ M }) => (
    <>
      <mesh geometry={geo("armor:upper", () => sculpt(SHELL_PROFILE.filter(([, y]) => y >= 0.07), 48, 64, (v) => { shellDeform(v); v.multiplyScalar(1.03); }))} material={M.shell} />
      {[
        [0.02, 0.085],
        [-0.035, 0.03],
        [-0.095, -0.025],
      ].map(([y0, y1], i) => (
        <group key={i}>
          <mesh geometry={band(`armor${i}`, y0, y1, 1.06 - i * 0.015)} material={M.shell} />
          <mesh geometry={band(`armorTrim${i}`, y0 - 0.004, y0 + 0.004, 1.075 - i * 0.015)} material={M.chrome} />
        </group>
      ))}
      <mesh geometry={TORUS} material={M.chrome} position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.065, 0.05, 0.12]} />
      <mesh geometry={box(0.02, 0.2, 0.02, 0.006)} material={M.chrome} position={[0, 0.2, 0.128]} rotation={[-0.12, 0, 0]} />
    </>
  ),
  Waist: (k) => (
    <>
      <SpineStack k={k} />
      <mesh geometry={CYL} material={k.M.darkMetal} position={[0, 0.07, -0.005]} scale={[0.06, 0.12, 0.05]} />
    </>
  ),
  Pelvis: (k) => (
    <>
      <NsPelvis {...k} />
      {[0, Math.PI].map((ry) => (
        <group key={ry} rotation={[0, ry, 0]}>
          <mesh geometry={geo("fauld", () => plate([[0.105, -0.05], [0.11, -0.01], [0.112, 0.03]], 0, 1.3))} material={k.M.shell} scale={[1, 1, 0.78]} />
        </group>
      ))}
    </>
  ),
  Neck: (k) => (
    <>
      <NsNeck {...k} />
      <mesh geometry={TORUS} material={k.M.chrome} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.032, 0.03, 0.08]} />
    </>
  ),
};

/* ---------------------------------------------------------------- reactor */

const Reactor: TorsoVariant = {
  fit: [1, 1, 1],
  Chest: (k) => {
    const { M } = k;
    return (
      <>
        <mesh geometry={geo("reactor:back", () => sculpt(SHELL_PROFILE, 48, 36, (v) => { shellDeform(v); if (v.z > 0) v.z *= 0.2; }))} material={M.darkMetal} />
        <mesh geometry={capsule(0.012, 0.34)} material={M.chrome} position={[0, 0.3, 0.05]} rotation={[0, 0, Math.PI / 2]} />
        {[0.24, 0.17, 0.1, 0.03].map((y) =>
          [1, -1].map((s) => (
            <mesh
              key={`${y}${s}`}
              geometry={tube(`reactor-rib${y}${s}`, [[s * 0.02, y + 0.02, -0.075], [s * shellR(y) * widen(y) * 0.95, y, 0.0], [s * 0.1, y - 0.02, 0.095], [s * 0.035, y - 0.025, 0.105]], 0.009)}
              material={M.chrome}
            />
          )),
        )}
        <mesh geometry={box(0.03, 0.26, 0.02, 0.008)} material={M.darkMetal} position={[0, 0.16, 0.1]} />
        <group position={[0, 0.17, 0.085]}>
          <mesh geometry={TORUS} material={M.chrome} scale={[0.065, 0.065, 0.12]} />
          <mesh geometry={TORUS} material={M.glowSoft} scale={[0.048, 0.048, 0.06]} />
          <mesh geometry={SPHERE} material={M.glow} scale={[0.036, 0.036, 0.014]} />
          {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a) => (
            <mesh key={a} geometry={box(0.012, 0.022, 0.012, 0.003)} material={M.chrome} position={[Math.cos(a) * 0.056, Math.sin(a) * 0.056, 0.004]} rotation={[0, 0, a]} />
          ))}
          <pointLight ref={k.reg("core")} position={[0, 0, 0.06]} distance={0.8} decay={2} />
        </group>
        {[1, -1].map((s) => (
          <mesh key={s} geometry={box(0.09, 0.08, 0.14, 0.02)} material={M.darkMetal} position={[s * 0.15, 0.275, -0.01]} />
        ))}
      </>
    );
  },
  Waist: (k) => (
    <>
      <SpineStack k={k} glowing />
      <SideCables k={k} material="cables" />
    </>
  ),
  Pelvis: (k) => <NsPelvis {...k} material="darkMetal" />,
  Neck: (k) => <NsNeck {...k} />,
};

/* ---------------------------------------------------------------- athlete */

const ATHLETE_PROFILE: V2[] = [
  [0.075, -0.2], [0.1, -0.18], [0.125, -0.12], [0.14, -0.05], [0.156, 0.01], [0.172, 0.08],
  [0.186, 0.15], [0.192, 0.21], [0.188, 0.255], [0.168, 0.292], [0.13, 0.325], [0.085, 0.35], [0.05, 0.362],
];
const athleteShell = () =>
  geo("torso:athlete", () =>
    sculpt(ATHLETE_PROFILE, 80, 80, (v) => {
      v.x *= 0.88 + 0.14 * smoothstep(-0.05, 0.24, v.y);
      v.z *= 0.62;
      if (v.z <= 0) {
        v.z -= 0.01 * bump((Math.abs(v.x) - 0.08) / 0.05, (v.y - 0.2) / 0.06);
        return;
      }
      const ax = Math.abs(v.x);
      v.z += 0.02 * bump((ax - 0.07) / 0.05, (v.y - 0.225) / 0.045);
      v.z -= 0.008 * bump((v.y - 0.19) / 0.012, 0) * smoothstep(0.02, 0.1, ax) * (1 - smoothstep(0.1, 0.13, ax));
      for (const y of [0.1, 0.045, -0.01, -0.07]) v.z += 0.008 * bump((ax - 0.028) / 0.02, (v.y - y) / 0.02);
      v.z -= 0.006 * bump(v.x / 0.008, 0) * (1 - smoothstep(0.16, 0.2, v.y));
      v.z += 0.006 * bump((ax - 0.1) / 0.02, (v.y + 0.07) / 0.06);
    }),
  );

const Athlete: TorsoVariant = {
  fit: [1, 1.02, 1],
  Chest: ({ M }) => <mesh geometry={athleteShell()} material={M.shell} />,
  Waist: (k) => <SpineStack k={k} discs={[0.035, 0.065]} />,
  Pelvis: (k) => (
    <>
      <NsPelvis {...k} material="shell" />
      <mesh geometry={TORUS} material={k.M.chrome} scale={[0.118, 0.118, 0.12]} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </>
  ),
  Neck: ({ M }) => (
    <>
      <mesh geometry={CYL} material={M.shell} position={[0, 0.045, -0.004]} scale={[0.028, 0.11, 0.026]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={capsule(0.009, 0.08)} material={M.shell} position={[s * 0.018, 0.045, 0.012]} rotation={[-0.25, 0, -s * 0.2]} />
      ))}
    </>
  ),
};

/* ------------------------------------------------------------------- tank */

const hazard = () => fixed("hazard", () => new THREE.MeshStandardMaterial({ color: "#f5c518", roughness: 0.5, metalness: 0.2 }));

const Tank: TorsoVariant = {
  fit: [1.22, 1.05, 1.3],
  Chest: ({ M }) => (
    <>
      <mesh geometry={box(0.44, 0.36, 0.27, 0.05)} material={M.shell} position={[0, 0.16, -0.005]} />
      <mesh geometry={box(0.2, 0.1, 0.02, 0.012)} material={M.darkMetal} position={[0, 0.22, 0.13]} />
      {[-0.07, -0.035, 0, 0.035, 0.07].map((x) => (
        <mesh key={x} geometry={box(0.012, 0.075, 0.012, 0.004)} material={M.chrome} position={[x, 0.22, 0.14]} />
      ))}
      <mesh geometry={box(0.42, 0.035, 0.26, 0.01)} material={hazard()} position={[0, 0.0, -0.004]} />
      {[-0.15, -0.05, 0.05, 0.15].map((x) => (
        <mesh key={x} geometry={box(0.035, 0.036, 0.262, 0.004)} material={M.darkMetal} position={[x, 0.0, -0.004]} rotation={[0, 0, 0.6]} />
      ))}
      {[1, -1].flatMap((s) => [0.29, 0.03].map((y) => (
        <mesh key={`${s}${y}`} geometry={SPHERE} material={M.chrome} position={[s * 0.19, y, 0.13]} scale={0.009} />
      )))}
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.12, 0.34, -0.1]}>
          <mesh geometry={CYL} material={M.chrome} scale={[0.022, 0.12, 0.022]} position={[0, 0.02, 0]} />
          <mesh geometry={CYL} material={M.darkMetal} scale={[0.017, 0.01, 0.017]} position={[0, 0.08, 0]} />
        </group>
      ))}
    </>
  ),
  Waist: ({ M }) => (
    <>
      <mesh geometry={CYL} material={M.darkMetal} position={[0, 0.08, 0]} scale={[0.075, 0.16, 0.065]} />
      {[0.03, 0.08, 0.13].map((y) => (
        <mesh key={y} geometry={TORUS} material={M.chrome} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.078, 0.068, 0.1]} />
      ))}
    </>
  ),
  Pelvis: ({ M }) => (
    <>
      <mesh geometry={box(0.27, 0.12, 0.19, 0.03)} material={M.shell} position={[0, 0.0, 0]} />
      <mesh geometry={box(0.28, 0.02, 0.2, 0.006)} material={M.chrome} position={[0, 0.055, 0]} />
    </>
  ),
  Neck: ({ M }) => (
    <>
      <mesh geometry={CYL} material={M.chrome} position={[0, 0.045, 0]} scale={[0.034, 0.1, 0.034]} />
      {[0.02, 0.05, 0.08].map((y) => (
        <mesh key={y} geometry={TORUS} material={M.darkMetal} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.036, 0.036, 0.08]} />
      ))}
    </>
  ),
};

/* --------------------------------------------------------------- skeleton */

const Skeleton: TorsoVariant = {
  fit: [0.92, 1, 0.9],
  Chest: (k) => {
    const { M } = k;
    return (
      <>
        {[-0.08, -0.03, 0.02, 0.07, 0.12, 0.17, 0.22, 0.27, 0.32].map((y) => (
          <mesh key={y} geometry={box(0.03, 0.03, 0.03, 0.008)} material={M.chrome} position={[0, y, -0.075]} />
        ))}
        <mesh geometry={CYL} material={M.darkMetal} position={[0, 0.13, -0.075]} scale={[0.01, 0.44, 0.01]} />
        <mesh geometry={box(0.035, 0.2, 0.014, 0.006)} material={M.chrome} position={[0, 0.2, 0.11]} rotation={[-0.1, 0, 0]} />
        {[1, -1].map((s) => {
          const c = span([s * 0.02, 0.31, 0.1], [s * 0.19, 0.285, 0.0]);
          return <mesh key={s} geometry={capsule(0.009, c.length)} material={M.chrome} position={c.position} rotation={c.rotation} />;
        })}
        {[0.27, 0.22, 0.17, 0.12, 0.07].map((y, i) =>
          [1, -1].map((s) => {
            const w = shellR(y) * widen(y) * 0.92;
            return (
              <mesh
                key={`${y}${s}`}
                geometry={tube(`skel-rib${y}${s}`, [[s * 0.02, y + 0.015, -0.075], [s * w * 0.8, y + 0.005, -0.06], [s * w, y - 0.01, 0.0], [s * w * 0.75, y - 0.03, 0.08], [s * 0.025, y - 0.02 - i * 0.004, 0.108]], 0.0075)}
                material={M.chrome}
              />
            );
          }),
        )}
        <Core {...k} y={0.16} z={0.02} r={0.024} />
        {[1, -1].map((s) => (
          <mesh key={s} geometry={tube(`skel-cable${s}`, [[s * 0.015, -0.1, -0.05], [s * 0.05, 0.1, 0.0], [s * 0.03, 0.3, 0.02]], 0.006)} material={M.muscle} />
        ))}
      </>
    );
  },
  Waist: ({ M }) => (
    <>
      {[0.02, 0.055, 0.09, 0.125].map((y) => (
        <group key={y} position={[0, y, -0.03]}>
          <mesh geometry={box(0.04, 0.026, 0.035, 0.008)} material={M.chrome} />
          <mesh geometry={box(0.012, 0.02, 0.035, 0.004)} material={M.chrome} position={[0, 0, -0.03]} />
          <mesh geometry={box(0.06, 0.008, 0.012, 0.003)} material={M.chrome} />
        </group>
      ))}
    </>
  ),
  Pelvis: ({ M }) => (
    <>
      {[1, -1].map((s) => (
        <mesh key={s} geometry={SPHERE} material={M.chrome} position={[s * 0.07, 0.01, -0.01]} rotation={[0, s * 0.5, s * 0.3]} scale={[0.05, 0.06, 0.018]} />
      ))}
      <mesh geometry={box(0.05, 0.07, 0.03, 0.01)} material={M.chrome} position={[0, 0.0, -0.05]} />
      <mesh geometry={capsule(0.012, 0.09)} material={M.chrome} position={[0, -0.05, 0.05]} rotation={[0, 0, Math.PI / 2]} />
      {[1, -1].map((s) => {
        const p = span([s * 0.1, 0.0, 0.0], [s * 0.04, -0.05, 0.05]);
        return <mesh key={s} geometry={capsule(0.01, p.length)} material={M.chrome} position={p.position} rotation={p.rotation} />;
      })}
    </>
  ),
  Neck: ({ M }) => (
    <>
      {[0.015, 0.045, 0.075].map((y) => (
        <mesh key={y} geometry={box(0.03, 0.02, 0.03, 0.007)} material={M.chrome} position={[0, y, -0.01]} />
      ))}
      <mesh geometry={CYL} material={M.darkMetal} position={[0, 0.05, -0.01]} scale={[0.008, 0.1, 0.008]} />
    </>
  ),
};

/* ------------------------------------------------------------------ retro */

const RETRO_BUTTONS = ["#ff4d4d", "#ffd166", "#5ef2b8"];
const bulb = (color: string) => fixed(`bulb:${color}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, toneMapped: false }));

const Retro: TorsoVariant = {
  fit: [1.05, 1, 1.05],
  Chest: ({ M }) => (
    <>
      <mesh geometry={CYL} material={M.shell} position={[0, 0.14, 0]} scale={[0.185, 0.4, 0.14]} />
      {[0.34, -0.06].map((y) => (
        <mesh key={y} geometry={CYL} material={M.chrome} position={[0, y, 0]} scale={[0.19, 0.016, 0.145]} />
      ))}
      <mesh geometry={CYL} material={M.shell} position={[0, 0.355, 0]} scale={[0.12, 0.02, 0.1]} />
      {Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2).flatMap((a) =>
        [0.32, -0.04].map((y) => <mesh key={`${a}${y}`} geometry={SPHERE} material={M.chrome} position={[Math.sin(a) * 0.186, y, Math.cos(a) * 0.141]} scale={0.006} />),
      )}
      <mesh geometry={box(0.17, 0.13, 0.03, 0.012)} material={M.darkMetal} position={[0, 0.17, 0.135]} />
      {[-0.045, 0.045].map((x) => (
        <group key={x} position={[x, 0.195, 0.152]}>
          <mesh geometry={TORUS} material={M.chrome} scale={[0.024, 0.024, 0.05]} />
          <mesh geometry={SPHERE} material={M.screen} scale={[0.022, 0.022, 0.004]} />
          <mesh geometry={box(0.003, 0.018, 0.003, 0.001)} material={M.glow} position={[0, 0.006, 0.004]} rotation={[0, 0, x > 0 ? -0.6 : 0.4]} />
        </group>
      ))}
      {RETRO_BUTTONS.map((c, i) => (
        <mesh key={c} geometry={SPHERE} material={bulb(c)} position={[(i - 1) * 0.04, 0.135, 0.152]} scale={0.011} />
      ))}
    </>
  ),
  Waist: ({ M }) => (
    <>
      {[0.02, 0.045, 0.07, 0.095, 0.12].map((y, i) => (
        <mesh key={y} geometry={TORUS} material={i % 2 ? M.chrome : M.darkMetal} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.07, 0.06, 0.12]} />
      ))}
    </>
  ),
  Pelvis: ({ M }) => (
    <>
      <mesh geometry={CYL} material={M.shell} position={[0, 0.0, 0]} scale={[0.13, 0.12, 0.1]} />
      <mesh geometry={CYL} material={M.chrome} position={[0, 0.06, 0]} scale={[0.135, 0.014, 0.105]} />
      <mesh geometry={CYL} material={M.chrome} position={[0, -0.06, 0]} scale={[0.135, 0.014, 0.105]} />
    </>
  ),
  Neck: ({ M }) => (
    <>
      {[0.015, 0.04, 0.065, 0.09].map((y, i) => (
        <mesh key={y} geometry={TORUS} material={i % 2 ? M.chrome : M.darkMetal} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.028, 0.028, 0.1]} />
      ))}
    </>
  ),
};

/* ------------------------------------------------------------------ mecha */

const mechaShell = () => geo("torso:mecha", () => sculpt(SHELL_PROFILE, 16, 8, (v) => { shellDeform(v); v.z *= 1.05; }));

const Mecha: TorsoVariant = {
  fit: [1.08, 1, 1.08],
  Chest: ({ M }) => (
    <>
      <mesh geometry={mechaShell()} material={M.shell} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.075, 0.23, 0.12]} rotation={[-0.25, s * 0.35, 0]}>
          <mesh geometry={box(0.09, 0.06, 0.02, 0.006)} material={M.darkMetal} />
          {[-0.018, 0, 0.018].map((y) => (
            <mesh key={y} geometry={box(0.08, 0.008, 0.012, 0.002)} material={hazard()} position={[0, y, 0.008]} />
          ))}
        </group>
      ))}
      <mesh geometry={box(0.09, 0.12, 0.025, 0.012)} material={M.chrome} position={[0, 0.09, 0.12]} rotation={[0.08, 0, 0]} />
      <mesh geometry={SPHERE} material={M.glow} position={[0, 0.13, 0.133]} scale={[0.012, 0.012, 0.005]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.018, 0.12, 0.02, 0.005)} material={M.chrome} position={[s * 0.04, 0.33, 0.07]} rotation={[0.4, 0, s * 0.7]} />
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.03, 0.07, 0.08, 0.008)} material={M.darkMetal} position={[s * 0.18, 0.12, 0.02]} />
      ))}
    </>
  ),
  Waist: (k) => (
    <>
      <SpineStack k={k} />
      <mesh geometry={box(0.13, 0.05, 0.1, 0.015)} material={k.M.shell} position={[0, 0.1, 0.005]} />
    </>
  ),
  Pelvis: ({ M }) => (
    <>
      <mesh geometry={nsPelvis()} material={M.darkMetal} />
      <mesh geometry={box(0.1, 0.1, 0.025, 0.01)} material={M.shell} position={[0, -0.02, 0.085]} rotation={[0.15, 0, 0]} />
      <mesh geometry={SPHERE} material={M.glow} position={[0, 0.0, 0.1]} scale={[0.008, 0.012, 0.004]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.025, 0.11, 0.1, 0.01)} material={M.shell} position={[s * 0.13, -0.01, 0]} rotation={[0, 0, s * 0.12]} />
      ))}
      <mesh geometry={box(0.14, 0.1, 0.025, 0.01)} material={M.shell} position={[0, -0.01, -0.085]} rotation={[-0.15, 0, 0]} />
    </>
  ),
  Neck: (k) => (
    <>
      <NsNeck {...k} />
      <mesh geometry={TORUS} material={k.M.darkMetal} position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.034, 0.03, 0.1]} />
    </>
  ),
};

/* ----------------------------------------------------------------- scales */

/** Overlapping scale plates laid over the classic shell, merged into one mesh. */
const scaleArmor = () =>
  geo("torso:scales", () => {
    const shell = nsShell();
    const pos = shell.attributes.position;
    const nor = shell.attributes.normal;
    const rows = 65;
    const scale = new THREE.SphereGeometry(1, 10, 6);
    const parts: THREE.BufferGeometry[] = [];
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let seg = 0; seg < 72; seg += 2) {
      for (let row = 2; row < rows - 3; row += 3) {
        const i = (seg + (row % 6 === 2 ? 0 : 1)) * rows + row;
        if (i >= pos.count) continue;
        p.fromBufferAttribute(pos, i);
        n.fromBufferAttribute(nor, i).normalize();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5));
        m.compose(p.clone().addScaledVector(n, 0.004), q, new THREE.Vector3(0.021, 0.024, 0.0045));
        parts.push(scale.clone().applyMatrix4(m));
      }
    }
    return mergeGeometries(parts);
  });

const Scales: TorsoVariant = {
  fit: [1.05, 1, 1.08],
  Chest: ({ M }) => (
    <>
      <mesh geometry={nsShell()} material={M.muscle} />
      <mesh geometry={scaleArmor()} material={M.shell} />
      <mesh geometry={TORUS} material={M.chrome} position={[0, 0.358, -0.004]} rotation={[Math.PI / 2, 0, 0]} scale={[0.05, 0.036, 0.05]} />
    </>
  ),
  Waist: (k) => (
    <>
      <SpineStack k={k} />
      <SideCables k={k} />
    </>
  ),
  Pelvis: (k) => (
    <>
      <NsPelvis {...k} material="darkMetal" />
      {Array.from({ length: 18 }, (_, i) => (i / 18) * Math.PI * 2).map((a) => (
        <mesh key={a} geometry={SPHERE} material={k.M.shell} position={[Math.sin(a) * 0.12, 0.0, Math.cos(a) * 0.086]} rotation={[0.35, a, 0, "YXZ"]} scale={[0.03, 0.045, 0.005]} />
      ))}
    </>
  ),
  Neck: (k) => <NsNeck {...k} />,
};

export const TORSO_VARIANTS: Record<TorsoId, TorsoVariant> = {
  ns: NS,
  crystal: Crystal,
  armored: Armored,
  core: Reactor,
  athlete: Athlete,
  tank: Tank,
  skeleton: Skeleton,
  retro: Retro,
  mecha: Mecha,
  scales: Scales,
};

export { shellR, widen };
