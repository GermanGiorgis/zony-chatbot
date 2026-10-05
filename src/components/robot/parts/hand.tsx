import { capsule, SPHERE, box, CONE, type MatKey, type SideProps } from "../kit";

const FINGERS = [
  { x: 0.026, segs: [0.034, 0.022, 0.018], r: 0.0085 },
  { x: 0.009, segs: [0.038, 0.025, 0.019], r: 0.0088 },
  { x: -0.009, segs: [0.035, 0.023, 0.018], r: 0.0085 },
  { x: -0.025, segs: [0.027, 0.018, 0.015], r: 0.0076 },
];
const THUMB = [0.03, 0.022, 0.018];

export type HandStyle = {
  palm: MatKey;
  finger: MatKey;
  joint: MatKey;
  /** Finger thickness multiplier. */
  thick?: number;
  /** Pointed tips instead of rounded ones. */
  claws?: boolean;
  /** Thin exposed-bone fingers. */
  bones?: boolean;
};

/**
 * Finger bone names (fL0_0 … tR_2) are fixed: the rig curls them for gestures.
 * Styles only change materials and proportions.
 */
export function Hand({ s, side, M, reg, style }: SideProps & { style: HandStyle }) {
  const k = style.thick ?? 1;
  const seg = (r: number, len: number) =>
    style.bones ? (
      <>
        <mesh geometry={capsule(r * 0.45 * k, len - r)} material={M[style.finger]} position={[0, -len / 2, 0]} />
        <mesh geometry={SPHERE} material={M[style.joint]} scale={r * 0.85 * k} />
      </>
    ) : (
      <mesh geometry={capsule(r * k, Math.max(0.001, len - r * k))} material={M[style.finger]} position={[0, -len / 2, 0]} />
    );
  const tip = (r: number, len: number) =>
    style.claws ? (
      <mesh geometry={CONE} material={M.chrome} position={[0, -len - 0.008, 0.002]} rotation={[Math.PI, 0, 0]} scale={[r * 0.9 * k, 0.026, r * 0.9 * k]} />
    ) : null;

  return (
    <group>
      <mesh geometry={SPHERE} material={M[style.joint]} scale={0.02 * k} />
      {style.bones ? (
        <>
          {[-0.022, -0.007, 0.008, 0.023].map((x) => (
            <mesh key={x} geometry={capsule(0.0045, 0.075)} material={M[style.palm]} position={[s * x, -0.05, 0]} rotation={[0, 0, s * x * 1.2]} />
          ))}
        </>
      ) : (
        <mesh geometry={box(0.072 * Math.min(k, 1.15), 0.085, 0.026 * k, 0.01)} material={M[style.palm]} position={[0, -0.052, 0]} />
      )}
      {FINGERS.map((f, fi) => (
        <group key={fi} ref={reg(`f${side}${fi}_0`)} position={[s * f.x, -0.092, 0.002]}>
          <mesh geometry={SPHERE} material={M[style.joint]} scale={f.r * 1.15 * k} />
          {seg(f.r, f.segs[0])}
          <group ref={reg(`f${side}${fi}_1`)} position={[0, -f.segs[0], 0]}>
            <mesh geometry={SPHERE} material={M[style.joint]} scale={f.r * 1.02 * k} />
            {seg(f.r * 0.94, f.segs[1])}
            <group ref={reg(`f${side}${fi}_2`)} position={[0, -f.segs[1], 0]}>
              {seg(f.r * 0.88, f.segs[2])}
              {tip(f.r, f.segs[2])}
            </group>
          </group>
        </group>
      ))}
      <group position={[s * 0.036, -0.03, 0.01]} rotation={[0.35, s * -0.5, s * 0.75]}>
        <group ref={reg(`t${side}_0`)}>
          <mesh geometry={SPHERE} material={M[style.joint]} scale={0.011 * k} />
          {seg(0.0098, THUMB[0])}
          <group ref={reg(`t${side}_1`)} position={[0, -THUMB[0], 0]}>
            {seg(0.009, THUMB[1])}
            <group ref={reg(`t${side}_2`)} position={[0, -THUMB[1], 0]}>
              {seg(0.0085, THUMB[2])}
              {tip(0.0098, THUMB[2])}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
