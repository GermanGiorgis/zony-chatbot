import * as THREE from "three";
import type { HeadId } from "../catalog";
import {
  box,
  bump,
  capsule,
  CONE,
  CYL,
  geo,
  HEMI,
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
 * Head-bone space: origin at the top of the neck, +Y up, +Z forward.
 * Every head registers eyeL, eyeR and mouth: the rig moves them to look around, blink and talk.
 */
export type HeadAnchors = {
  /** Crown height, where hats sit. */
  top: number;
  crownZ: number;
  /** Half-width at the temples, used to scale hats. */
  width: number;
  eyeY: number;
  /** Front of the face at the eye line, where glasses sit. */
  faceZ: number;
  eyeX: number;
};
export type HeadVariant = { Head: (p: Kit) => React.JSX.Element; anchors: HeadAnchors };

/* ---------------------------------------------------------- human (NS) face */

/**
 * Shield-shaped face: widest at the cheekbones, tapering to a small chin, under a low, wide dome
 * crown (the dome's height stays under its radius, so it reads as a skull cap and not a cone).
 */
const HEAD_PROFILE: V2[] = [
  [0.022, 0], [0.03, 0.014], [0.044, 0.036], [0.058, 0.062], [0.07, 0.088],
  [0.079, 0.11], [0.084, 0.13], [0.086, 0.155], [0.082, 0.175], [0.072, 0.19],
  [0.056, 0.202], [0.036, 0.211], [0.0005, 0.218],
];
const HEAD_XS = 0.88;
const HEAD_SCALE = 1.12;
const FACE_OFFSET: V3 = [0, -0.055, 0.02];
/** Raw (pre-scale) face landmarks. */
const EYE_X = 0.036;
const EYE_Y = 0.118;
const MOUTH_Y = 0.055;

const headXS = (y: number) => HEAD_XS * (0.86 + 0.14 * smoothstep(0.02, 0.13, y));
function headR(y: number) {
  for (let i = 0; i < HEAD_PROFILE.length - 1; i++) {
    const [r0, y0] = HEAD_PROFILE[i];
    const [r1, y1] = HEAD_PROFILE[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return 0;
}
const faceZ = (x: number, y: number) => {
  const r = headR(y);
  return Math.sqrt(Math.max(0, r * r - (x / headXS(y)) ** 2));
};

/** Face relief: eyes sunk into sockets, brow ridge, small nose, cheekbones, lip groove, chin. */
function faceRelief(x: number, y: number) {
  const ax = Math.abs(x);
  return (
    -0.006 * bump((ax - EYE_X) / 0.026, (y - EYE_Y) / 0.019) +
    0.002 * bump(ax / 0.05, (y - 0.15) / 0.01) +
    0.006 * bump(x / 0.009, (y - 0.084) / 0.013) +
    0.0025 * bump(x / 0.007, (y - 0.108) / 0.02) +
    0.0015 * bump((ax - 0.011) / 0.005, (y - 0.078) / 0.005) +
    0.002 * bump((ax - 0.055) / 0.02, (y - 0.09) / 0.018) -
    0.0013 * bump(x / 0.022, (y - MOUTH_Y) / 0.003) +
    0.0025 * bump(x / 0.018, (y - 0.024) / 0.012)
  );
}

const humanHead = (cut = 1) =>
  geo(`head:human:${cut}`, () =>
    sculpt(
      HEAD_PROFILE.filter(([, y]) => y <= cut + 0.001),
      110,
      128,
      (v) => {
        v.x *= headXS(v.y);
        if (v.z <= 0) return;
        const front = smoothstep(0.4, 0.85, v.z / (headR(v.y) || 1));
        v.z += faceRelief(v.x, v.y) * front;
      },
    ),
  );

/** Dark stripe over the crown: a narrow tip on the forehead widening over the top, traced on the skull. */
const crownStripe = () =>
  geo("head:stripe", () => {
    const rows = 30;
    const cols = 14;
    const y0 = 0.132;
    const y1 = 0.2165;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const y = y0 + (y1 - y0) * t;
      const half = 0.03 + 0.3 * smoothstep(0, 0.7, t);
      const r = headR(y) * 1.014 + 0.0016;
      for (let j = 0; j <= cols; j++) {
        const phi = -half + (2 * half * j) / cols;
        pos.push(Math.sin(phi) * r * headXS(y), y, Math.cos(phi) * r);
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j;
        const b = a + 1;
        const c = a + cols + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

/** A glowing arc, like the sound waves next to a headset. */
const earArc = (r: number) => geo(`head:arc:${r}`, () => new THREE.TorusGeometry(r, 0.0022, 8, 32, Math.PI * 0.95));

function HumanEye({ x, side, M, reg }: Kit & { x: number; side: "L" | "R" }) {
  const z = faceZ(x, EYE_Y);
  return (
    <>
      <mesh geometry={SPHERE} material={M.dark} position={[x, EYE_Y, z - 0.011]} scale={[0.026, 0.021, 0.009]} />
      <group ref={reg(`eye${side}`)} position={[x, EYE_Y, z - 0.014]}>
        <mesh geometry={SPHERE} material={M.glow} scale={[0.0165, 0.0145, 0.0165]} />
        <mesh geometry={SPHERE} material={M.dark} position={[0, 0, 0.0158]} scale={[0.005, 0.005, 0.0016]} />
        <mesh geometry={SPHERE} material={M.sclera} position={[-0.0055, 0.0055, 0.0145]} scale={[0.0032, 0.0032, 0.0014]} />
      </group>
    </>
  );
}

function CheekLine({ s, M }: { s: 1 | -1; M: Kit["M"] }) {
  const pts: V2[] = [[0.054, 0.104], [0.057, 0.082], [0.047, 0.058], [0.03, 0.034], [0.013, 0.015]];
  return (
    <mesh
      geometry={tube(
        `cheek${s}`,
        pts.map(([px, py]): V3 => [s * px, py, faceZ(s * px, py) + 0.0018]),
        0.0032,
      )}
      material={M.muscle}
    />
  );
}

function HumanFace(k: Kit) {
  const { M } = k;
  return (
    <>
      <HumanEye x={EYE_X} side="L" {...k} />
      <HumanEye x={-EYE_X} side="R" {...k} />
      <group ref={k.reg("mouth")} position={[0, MOUTH_Y, faceZ(0, MOUTH_Y) - 0.0006]}>
        <mesh geometry={capsule(0.0013, 0.026)} material={M.darkMetal} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <mesh geometry={crownStripe()} material={M.muscle} />
      <group position={[0, 0.18, headR(0.18) + 0.0035]} rotation={[-0.55, 0, 0]}>
        <mesh geometry={capsule(0.0035, 0.028)} material={M.shell} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <CheekLine s={1} M={M} />
      <CheekLine s={-1} M={M} />
      <mesh geometry={SPHERE} material={M.muscle} position={[0, 0.004, faceZ(0, 0.012) - 0.004]} scale={[0.024, 0.014, 0.02]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <group position={[s * 0.089, 0.108, -0.004]} rotation={[0, 0, Math.PI / 2]}>
            <mesh geometry={CYL} material={M.darkMetal} scale={[0.036, 0.03, 0.03]} />
            <mesh geometry={TORUS} material={M.chrome} position={[0, -s * 0.0155, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.031, 0.026, 0.06]} />
          </group>
          {[0.046, 0.06].map((r, i) => (
            <mesh
              key={r}
              geometry={earArc(r)}
              material={i ? M.glowSoft : M.glow}
              position={[s * 0.066, 0.108, -0.004]}
              rotation={[0, 0, (s > 0 ? 0 : Math.PI) - Math.PI * 0.475]}
            />
          ))}
          <mesh geometry={CONE} material={M.muscle} position={[s * 0.092, 0.205, -0.012]} rotation={[0, 0, -s * 0.09]} scale={[0.0085, 0.13, 0.016]} />
        </group>
      ))}
    </>
  );
}

const Human: HeadVariant = {
  anchors: {
    top: FACE_OFFSET[1] + HEAD_SCALE * HEAD_PROFILE[HEAD_PROFILE.length - 1][1],
    crownZ: FACE_OFFSET[2],
    width: HEAD_SCALE * HEAD_XS * Math.max(...HEAD_PROFILE.map(([r]) => r)),
    eyeY: FACE_OFFSET[1] + HEAD_SCALE * EYE_Y,
    faceZ: FACE_OFFSET[2] + HEAD_SCALE * headR(EYE_Y),
    eyeX: HEAD_SCALE * EYE_X,
  },
  Head: (k) => (
    <group position={FACE_OFFSET} scale={HEAD_SCALE}>
      <mesh geometry={humanHead()} material={k.M.face} />
      <HumanFace {...k} />
    </group>
  ),
};

/* ------------------------------------------------------------------- visor */

const smoothHead = () =>
  geo("head:smooth", () =>
    sculpt(HEAD_PROFILE, 72, 96, (v) => {
      v.x *= headXS(v.y) * 1.04;
      v.z *= 1.04;
    }),
  );

const Visor: HeadVariant = {
  anchors: { top: 0.255, crownZ: 0.02, width: 0.083, eyeY: 0.105, faceZ: 0.112, eyeX: 0.034 },
  Head: ({ M, reg }) => (
    <group position={FACE_OFFSET} scale={HEAD_SCALE}>
      <mesh geometry={smoothHead()} material={M.face} />
      <mesh
        geometry={geo("visor:band", () => plate([[0.093, 0.105], [0.1, 0.13], [0.1, 0.155], [0.095, 0.172]], 0, 2.4, 48))}
        material={M.screen}
        scale={[0.86, 1, 1.03]}
      />
      <mesh geometry={geo("visor:rim", () => plate([[0.101, 0.1], [0.103, 0.104]], 0, 2.5, 48))} material={M.chrome} scale={[0.86, 1, 1.03]} />
      <mesh geometry={geo("visor:rim2", () => plate([[0.098, 0.174], [0.1, 0.178]], 0, 2.5, 48))} material={M.chrome} scale={[0.86, 1, 1.03]} />
      {(["L", "R"] as const).map((side, i) => (
        <group key={side} ref={reg(`eye${side}`)} position={[0, 0.138, 0]}>
          <mesh geometry={capsule(0.0065, 0.018)} material={M.glow} position={[i ? -0.022 : 0.022, 0, 0.103]} rotation={[0, 0, Math.PI / 2]} />
        </group>
      ))}
      <group ref={reg("mouth")} position={[0, 0.06, 0.086]}>
        {[-0.012, 0, 0.012].map((x) => (
          <mesh key={x} geometry={capsule(0.0022, 0.012)} material={M.glowSoft} position={[x, 0, 0]} />
        ))}
      </group>
    </group>
  ),
};

/* ------------------------------------------------------------------ cyclops */

const Cyclops: HeadVariant = {
  anchors: { top: 0.215, crownZ: 0, width: 0.1, eyeY: 0.12, faceZ: 0.104, eyeX: 0.04 },
  Head: ({ M, reg }) => (
    <group>
      <mesh geometry={SPHERE} material={M.face} position={[0, 0.11, 0]} scale={[0.1, 0.105, 0.1]} />
      <mesh geometry={TORUS} material={M.chrome} position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.101, 0.101, 0.03]} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.098, 0.11, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
          <mesh geometry={CYL} material={M.chrome} scale={[0.028, 0.02, 0.028]} />
          <mesh geometry={CYL} material={M.darkMetal} position={[0, 0.012, 0]} scale={[0.018, 0.012, 0.018]} />
        </group>
      ))}
      <group ref={reg("eyeL")} position={[0, 0.12, 0.05]}>
        <mesh geometry={TORUS} material={M.chrome} position={[0, 0, 0.05]} scale={[0.043, 0.043, 0.06]} />
        <mesh geometry={SPHERE} material={M.screen} position={[0, 0, 0.046]} scale={[0.042, 0.042, 0.016]} />
        <mesh geometry={SPHERE} material={M.glow} position={[0, 0, 0.058]} scale={[0.02, 0.02, 0.006]} />
        <mesh geometry={SPHERE} material={M.dark} position={[0, 0, 0.0635]} scale={[0.008, 0.008, 0.002]} />
      </group>
      <group ref={reg("eyeR")} />
      <group ref={reg("mouth")} position={[0, 0.045, 0.087]} rotation={[-0.5, 0, 0]}>
        <mesh geometry={box(0.05, 0.006, 0.01, 0.003)} material={M.darkMetal} />
      </group>
    </group>
  ),
};

/* ------------------------------------------------------------------- knight */

const Knight: HeadVariant = {
  anchors: { top: 0.262, crownZ: -0.005, width: 0.092, eyeY: 0.12, faceZ: 0.098, eyeX: 0.03 },
  Head: ({ M, reg }) => (
    <group>
      <mesh
        geometry={geo("knight:helm", () =>
          sculpt([[0.0005, -0.02], [0.07, -0.018], [0.088, 0], [0.094, 0.06], [0.095, 0.14], [0.09, 0.19], [0.07, 0.235], [0.035, 0.256], [0.0005, 0.26]], 64, 64, (v) => {
            if (v.z > 0) v.z *= 1 - 0.28 * smoothstep(0.04, 0.09, Math.abs(v.x)) * smoothstep(0.02, 0.1, v.z);
          }),
        )}
        material={M.face}
      />
      <mesh geometry={box(0.012, 0.25, 0.2, 0.006)} material={M.chrome} position={[0, 0.2, -0.005]} scale={[1, 0.4, 1]} />
      <mesh geometry={box(0.11, 0.016, 0.02, 0.006)} material={M.screen} position={[0, 0.12, 0.088]} />
      <mesh geometry={box(0.016, 0.07, 0.02, 0.006)} material={M.screen} position={[0, 0.08, 0.09]} />
      {[1, -1].map((s) => (
        <group key={s} ref={reg(s > 0 ? "eyeL" : "eyeR")} position={[s * 0.028, 0.12, 0.06]}>
          <mesh geometry={SPHERE} material={M.glow} position={[0, 0, 0.034]} scale={[0.009, 0.004, 0.002]} />
        </group>
      ))}
      {[-1, 1].flatMap((s) => [0.03, 0.05].map((y) => (
        <mesh key={`${s}${y}`} geometry={SPHERE} material={M.darkMetal} position={[s * 0.04, y, 0.084]} scale={0.0045} />
      )))}
      <group ref={reg("mouth")} position={[0, 0.06, 0.09]}>
        <mesh geometry={box(0.01, 0.01, 0.005, 0.002)} material={M.glowSoft} scale={[1, 0.3, 1]} />
      </group>
      {[1, -1].map((s) => (
        <mesh key={s} geometry={SPHERE} material={M.chrome} position={[s * 0.094, 0.1, 0]} scale={[0.008, 0.024, 0.024]} />
      ))}
    </group>
  ),
};

/* -------------------------------------------------------------------- brain */

const brainGeo = () =>
  geo("brain", () => {
    const g = new THREE.SphereGeometry(1, 64, 48);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = Math.sin(v.x * 17 + v.y * 5) * Math.sin(v.y * 13 - v.z * 7) * Math.sin(v.z * 11 + v.x * 3);
      const groove = 1 - 0.18 * Math.exp(-((v.x * 9) ** 2));
      v.multiplyScalar((1 + 0.05 * n) * groove);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });

const Brain: HeadVariant = {
  anchors: { top: 0.262, crownZ: 0.015, width: 0.08, eyeY: 0.103, faceZ: 0.112, eyeX: 0.032 },
  Head: (k) => (
    <group position={FACE_OFFSET} scale={HEAD_SCALE}>
      <mesh geometry={humanHead(0.184)} material={k.M.face} />
      <mesh geometry={TORUS} material={k.M.chrome} position={[0, 0.184, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.078, 0.1, 0.03]} />
      <mesh geometry={brainGeo()} material={k.M.iris} position={[0, 0.2, 0.005]} scale={[0.066, 0.052, 0.082]} />
      {[0.19, 0.205, 0.22].map((y, i) => (
        <mesh key={y} geometry={RING} material={k.M.glowSoft} position={[0, y, 0.005]} rotation={[Math.PI / 2 + i * 0.3 - 0.3, 0, 0]} scale={[0.058 - i * 0.008, 0.075 - i * 0.01, 1]} />
      ))}
      <mesh geometry={HEMI} material={k.M.glass} position={[0, 0.184, 0]} scale={[0.078, 0.1, 0.1]} renderOrder={2} />
      <HumanFace {...k} />
    </group>
  ),
};

/* ------------------------------------------------------------------- screen */

const Screen: HeadVariant = {
  anchors: { top: 0.2, crownZ: 0, width: 0.1, eyeY: 0.105, faceZ: 0.086, eyeX: 0.034 },
  Head: ({ M, reg }) => (
    <group>
      <mesh geometry={box(0.2, 0.17, 0.16, 0.03)} material={M.face} position={[0, 0.1, 0]} />
      <mesh geometry={box(0.17, 0.13, 0.02, 0.02)} material={M.screen} position={[0, 0.1, 0.072]} />
      {[1, -1].map((s) => (
        <group key={s} ref={reg(s > 0 ? "eyeL" : "eyeR")} position={[s * 0.034, 0.112, -0.02]}>
          <mesh geometry={capsule(0.011, 0.012)} material={M.glow} position={[0, 0, 0.104]} scale={[1, 1, 0.15]} />
        </group>
      ))}
      <group ref={reg("mouth")} position={[0, 0.07, 0.083]}>
        <mesh geometry={geo("smile", () => new THREE.TorusGeometry(0.022, 0.0035, 8, 24, Math.PI))} material={M.glow} rotation={[0, 0, Math.PI]} />
      </group>
      <mesh geometry={CYL} material={M.chrome} position={[0, 0.215, 0]} scale={[0.004, 0.05, 0.004]} />
      <mesh geometry={SPHERE} material={M.glow} position={[0, 0.245, 0]} scale={0.012} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={CYL} material={M.chrome} position={[s * 0.103, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.024, 0.012, 0.024]} />
      ))}
    </group>
  ),
};

/* ------------------------------------------------------------------- mantis */

const Mantis: HeadVariant = {
  anchors: { top: 0.232, crownZ: 0, width: 0.09, eyeY: 0.14, faceZ: 0.08, eyeX: 0.05 },
  Head: ({ M, reg }) => (
    <group>
      <mesh
        geometry={geo("mantis:head", () =>
          sculpt([[0.0005, 0.02], [0.02, 0.025], [0.04, 0.06], [0.07, 0.12], [0.085, 0.17], [0.075, 0.21], [0.04, 0.232], [0.0005, 0.235]], 48, 64, (v) => {
            v.x *= 1 + 0.35 * smoothstep(0.1, 0.2, v.y);
            v.z *= 0.8;
          }),
        )}
        material={M.face}
      />
      {[1, -1].map((s) => (
        <group key={s} ref={reg(s > 0 ? "eyeL" : "eyeR")} position={[s * 0.058, 0.155, 0.02]}>
          <mesh geometry={SPHERE} material={M.screen} scale={[0.036, 0.044, 0.042]} rotation={[0, s * 0.5, 0]} />
          <mesh geometry={SPHERE} material={M.glowSoft} scale={[0.02, 0.026, 0.024]} position={[s * 0.01, 0, 0.022]} />
        </group>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={tube(`antenna${s}`, [[s * 0.02, 0.215, 0.03], [s * 0.04, 0.28, 0.05], [s * 0.09, 0.33, 0.02], [s * 0.13, 0.35, -0.03]], 0.0022)} material={M.chrome} />
      ))}
      <group ref={reg("mouth")} position={[0, 0.04, 0.03]}>
        {[1, -1].map((s) => (
          <mesh key={s} geometry={CONE} material={M.chrome} position={[s * 0.012, -0.01, 0.01]} rotation={[0.3, 0, s * 0.35]} scale={[0.008, 0.03, 0.008]} />
        ))}
      </group>
    </group>
  ),
};

/* -------------------------------------------------------------------- retro */

const Retro: HeadVariant = {
  anchors: { top: 0.205, crownZ: 0, width: 0.095, eyeY: 0.125, faceZ: 0.092, eyeX: 0.036 },
  Head: ({ M, reg }) => (
    <group>
      <mesh geometry={CYL} material={M.face} position={[0, 0.105, 0]} scale={[0.092, 0.17, 0.092]} />
      <mesh geometry={CYL} material={M.chrome} position={[0, 0.192, 0]} scale={[0.094, 0.008, 0.094]} />
      <mesh geometry={CYL} material={M.chrome} position={[0, 0.02, 0]} scale={[0.094, 0.008, 0.094]} />
      {Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2).map((a) => (
        <mesh key={a} geometry={SPHERE} material={M.chrome} position={[Math.sin(a) * 0.093, 0.18, Math.cos(a) * 0.093]} scale={0.004} />
      ))}
      {[1, -1].map((s) => (
        <group key={s} ref={reg(s > 0 ? "eyeL" : "eyeR")} position={[s * 0.036, 0.125, 0.06]}>
          <mesh geometry={TORUS} material={M.chrome} position={[0, 0, 0.032]} scale={[0.022, 0.022, 0.04]} />
          <mesh geometry={SPHERE} material={M.glow} position={[0, 0, 0.03]} scale={[0.017, 0.017, 0.006]} />
        </group>
      ))}
      <group ref={reg("mouth")} position={[0, 0.06, 0.09]}>
        <mesh geometry={box(0.07, 0.03, 0.01, 0.005)} material={M.darkMetal} />
        {[-0.024, -0.012, 0, 0.012, 0.024].map((x) => (
          <mesh key={x} geometry={box(0.004, 0.026, 0.006, 0.001)} material={M.chrome} position={[x, 0, 0.004]} />
        ))}
      </group>
      <mesh geometry={CYL} material={M.chrome} position={[0, 0.225, 0]} scale={[0.003, 0.05, 0.003]} />
      <mesh geometry={SPHERE} material={M.glow} position={[0, 0.255, 0]} scale={0.01} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.097, 0.12, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
          <mesh geometry={CYL} material={M.chrome} scale={[0.024, 0.014, 0.024]} />
          <mesh geometry={CONE} material={M.chrome} position={[0, 0.02, 0]} scale={[0.008, 0.03, 0.008]} />
        </group>
      ))}
    </group>
  ),
};

/* -------------------------------------------------------------------- mecha */

const Mecha: HeadVariant = {
  anchors: { top: 0.232, crownZ: -0.01, width: 0.086, eyeY: 0.125, faceZ: 0.094, eyeX: 0.03 },
  Head: ({ M, reg }) => (
    <group>
      <mesh
        geometry={geo("mecha:helm", () =>
          sculpt([[0.0005, 0.02], [0.05, 0.022], [0.075, 0.05], [0.085, 0.1], [0.088, 0.16], [0.078, 0.21], [0.045, 0.232], [0.0005, 0.236]], 48, 12),
        )}
        material={M.face}
      />
      <mesh geometry={box(0.07, 0.06, 0.03, 0.01)} material={M.chrome} position={[0, 0.06, 0.07]} />
      {[-0.02, -0.01, 0, 0.01, 0.02].map((x) => (
        <mesh key={x} geometry={box(0.004, 0.035, 0.004, 0.001)} material={M.darkMetal} position={[x, 0.06, 0.086]} />
      ))}
      <mesh geometry={box(0.11, 0.03, 0.03, 0.008)} material={M.screen} position={[0, 0.125, 0.074]} />
      {[1, -1].map((s) => (
        <group key={s} ref={reg(s > 0 ? "eyeL" : "eyeR")} position={[s * 0.03, 0.126, 0.05]}>
          <mesh geometry={box(0.03, 0.008, 0.004, 0.002)} material={M.glow} position={[0, 0, 0.041]} rotation={[0, 0, s * 0.18]} />
        </group>
      ))}
      <mesh geometry={SPHERE} material={M.glow} position={[0, 0.17, 0.085]} scale={[0.008, 0.012, 0.006]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.012, 0.11, 0.006, 0.002)} material={M.chrome} position={[s * 0.034, 0.21, 0.08]} rotation={[-0.25, 0, -s * 0.85]} />
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={box(0.02, 0.07, 0.07, 0.008)} material={M.face} position={[s * 0.084, 0.08, 0.02]} rotation={[0, 0, s * 0.1]} />
      ))}
      <group ref={reg("mouth")} position={[0, 0.06, 0.09]} />
    </group>
  ),
};

/* -------------------------------------------------------------------- skull */

const Skull: HeadVariant = {
  anchors: { top: 0.235, crownZ: -0.01, width: 0.08, eyeY: 0.122, faceZ: 0.086, eyeX: 0.03 },
  Head: ({ M, reg }) => (
    <group>
      <mesh geometry={SPHERE} material={M.chrome} position={[0, 0.155, -0.012]} scale={[0.08, 0.082, 0.095]} />
      <mesh geometry={box(0.1, 0.07, 0.07, 0.024)} material={M.chrome} position={[0, 0.088, 0.03]} />
      <mesh geometry={capsule(0.009, 0.08)} material={M.chrome} position={[0, 0.142, 0.068]} rotation={[0, 0, Math.PI / 2]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={SPHERE} material={M.dark} position={[s * 0.029, 0.121, 0.066]} scale={[0.021, 0.018, 0.012]} />
          <group ref={reg(s > 0 ? "eyeL" : "eyeR")} position={[s * 0.029, 0.121, 0.07]}>
            <mesh geometry={SPHERE} material={M.glow} position={[0, 0, 0.004]} scale={0.0068} />
          </group>
          <mesh geometry={SPHERE} material={M.chrome} position={[s * 0.047, 0.097, 0.055]} scale={[0.017, 0.011, 0.018]} />
        </group>
      ))}
      <mesh geometry={CONE} material={M.dark} position={[0, 0.097, 0.066]} rotation={[Math.PI, 0, 0]} scale={[0.009, 0.018, 0.004]} />
      {[-0.021, -0.007, 0.007, 0.021].map((x) => (
        <mesh key={`u${x}`} geometry={box(0.011, 0.013, 0.006, 0.002)} material={M.face} position={[x, 0.066, 0.066]} />
      ))}
      <group ref={reg("mouth")} position={[0, 0.057, 0.064]}>
        <mesh geometry={box(0.05, 0.004, 0.004, 0.001)} material={M.dark} />
      </group>
      <mesh geometry={box(0.075, 0.03, 0.06, 0.012)} material={M.chrome} position={[0, 0.038, 0.03]} />
      {[-0.021, -0.007, 0.007, 0.021].map((x) => (
        <mesh key={`l${x}`} geometry={box(0.011, 0.011, 0.006, 0.002)} material={M.face} position={[x, 0.049, 0.062]} />
      ))}
      {[1, -1].map((s) => {
        const p = span([s * 0.058, 0.12, 0.0], [s * 0.034, 0.04, 0.02]);
        return <mesh key={s} geometry={capsule(0.006, p.length)} material={M.darkMetal} position={p.position} rotation={p.rotation} />;
      })}
    </group>
  ),
};

export const HEAD_VARIANTS: Record<HeadId, HeadVariant> = {
  ns: Human,
  visor: Visor,
  cyclops: Cyclops,
  knight: Knight,
  brain: Brain,
  screen: Screen,
  mantis: Mantis,
  retro: Retro,
  mecha: Mecha,
  skull: Skull,
};
