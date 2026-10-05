"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { Appearance } from "./appearance";
import { getRobotAttention, onRobotGesture, pointer } from "./bus";
import { applyAppearance, makeMaterials, type Kit, type Mats, type Reg, type Side } from "./kit";
import { ARM_VARIANTS } from "./parts/arms";
import { Hand } from "./parts/hand";
import { HEAD_VARIANTS } from "./parts/heads";
import { BASE_ANCHORS, GLASSES_VARIANTS, HAT_VARIANTS } from "./parts/headwear";
import { LEG_VARIANTS } from "./parts/legs";
import { OUTFIT_VARIANTS } from "./parts/outfits";
import { TORSO_VARIANTS } from "./parts/torsos";
import { CHANNELS, RigBrain, type GestureName, type LookInput, type Mood } from "./rig";

const CURL_MULT = [0.9, 1, 1.06, 1.12];
const CURL_SEG = [1, 1.1, 0.75];
const SPREAD = [0.08, 0.02, -0.04, -0.1];

const ALERT = new THREE.Color("#ff3b30");
const CLICK_CYCLE: GestureName[] = ["flinch", "wave", "flex"];
const GLOW_I = CHANNELS.indexOf("glow");
const ALERT_I = CHANNELS.indexOf("alert");

/** Parts that pop (quick squash-and-settle) when swapped in the customizer. */
type PopCategory = "head" | "torso" | "arms" | "legs" | "outfit" | "hat" | "glasses";

class RobotController {
  brain = new RigBrain();
  J: Record<string, THREE.Object3D> = {};
  mood: Mood = "idle";
  reduced = false;
  private born = performance.now();
  private appliers: ((v: number) => void)[] | null = null;
  private clicks = 0;
  private pops = new Map<PopCategory, number>();
  private drag = { active: false, x0: 0, yaw0: 0, target: 0, yaw: 0, vel: 0, released: 0 };
  private wander = { yaw: 0, pitch: 0, next: 0 };
  private ndc = new THREE.Vector2();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.6);
  private hit = new THREE.Vector3();
  private headPos = new THREE.Vector3();
  private tint = new THREE.Color();

  constructor(private M: Mats) {}

  reg: Reg = (name) => (o) => {
    if (!o) return;
    // Swapped parts re-register their eyes, mouth or fingers: rebuild the channel appliers.
    if (this.J[name] && this.J[name] !== o) this.appliers = null;
    this.J[name] = o;
    if (/^arm[LR]$/.test(name)) o.rotation.order = "ZXY";
    if (/^(wrist[LR]|head|neck|chest|spine|hips)$/.test(name)) o.rotation.order = "YXZ";
  };

  setInputs(mood: Mood, reduced: boolean) {
    this.mood = mood;
    this.reduced = reduced;
  }

  pop(category: PopCategory) {
    if (performance.now() - this.born < 600 || this.reduced) return;
    this.pops.set(category, performance.now());
  }

  dragStart(x: number) {
    this.drag.active = true;
    this.drag.x0 = x;
    this.drag.yaw0 = this.drag.target;
  }
  dragMove(x: number) {
    if (this.drag.active) this.drag.target = this.drag.yaw0 + (x - this.drag.x0) * 0.012;
  }
  dragEnd() {
    if (!this.drag.active) return;
    this.drag.active = false;
    this.drag.released = performance.now();
  }

  click(delta: number) {
    if (delta > 6) return;
    this.brain.play(CLICK_CYCLE[this.clicks++ % CLICK_CYCLE.length]);
  }

  private screenToLook(cx: number, cy: number, camera: THREE.Camera, el: HTMLElement): LookInput {
    const r = el.getBoundingClientRect();
    const head = this.J.head;
    if (!r.width || !head) return null;
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return null;
    head.getWorldPosition(this.headPos);
    this.headPos.y += 0.1;
    const dx = this.hit.x - this.headPos.x;
    const dy = this.hit.y - this.headPos.y;
    const dz = this.hit.z - this.headPos.z;
    const yaw = Math.atan2(dx, dz) - this.drag.yaw;
    const pitch = Math.atan2(-dy, Math.hypot(dx, dz));
    return {
      yaw: Math.max(-1.1, Math.min(1.1, yaw)),
      pitch: Math.max(-0.45, Math.min(0.5, pitch)),
    };
  }

  private buildAppliers() {
    const j = this.J;
    const hipsBase = j.hips.position.clone();
    const curl = (side: Side, fingers: number[]) => (c: number) => {
      for (const fi of fingers) {
        for (let s = 0; s < 3; s++) {
          const o = j[`f${side}${fi}_${s}`];
          if (!o) continue;
          o.rotation.x = -c * CURL_MULT[fi] * CURL_SEG[s];
          if (s === 0) o.rotation.z = (side === "L" ? 1 : -1) * SPREAD[fi] * (1 - Math.min(c, 1.2) / 1.2);
        }
      }
    };
    const thumb = (side: Side) => (c: number) => {
      j[`t${side}_0`].rotation.x = -c * 0.45;
      j[`t${side}_1`].rotation.x = -c * 0.8;
      j[`t${side}_2`].rotation.x = -c * 0.7;
    };
    return CHANNELS.map((ch): ((v: number) => void) => {
      if (ch === "eyes.rx") return (v) => { j.eyeL.rotation.x = v; j.eyeR.rotation.x = v; };
      if (ch === "eyes.ry") return (v) => { j.eyeL.rotation.y = v; j.eyeR.rotation.y = v; };
      if (ch === "blink") return (v) => { j.eyeL.scale.y = j.eyeR.scale.y = 1 - 0.9 * v; };
      if (ch === "jaw") return (v) => { j.mouth.scale.y = 1 + 2.6 * Math.max(0, v); };
      if (ch === "glow" || ch === "alert") return () => {};
      if (ch === "hips.px") return (v) => { j.hips.position.x = hipsBase.x + v; };
      if (ch === "hips.py") return (v) => { j.hips.position.y = hipsBase.y + v; };
      const [joint, axis] = ch.split(".");
      const m = /^(finger|index|thumb)([LR])$/.exec(joint);
      if (m) {
        const side = m[2] as Side;
        return m[1] === "thumb" ? thumb(side) : curl(side, m[1] === "index" ? [0] : [1, 2, 3]);
      }
      const o = j[joint];
      const k = axis === "rx" ? "x" : axis === "ry" ? "y" : "z";
      return (v) => { o.rotation[k] = v; };
    });
  }

  private updatePops(now: number) {
    for (const [category, start] of this.pops) {
      const t = (now - start) / 1000;
      const done = t > 0.7;
      // Damped spring: starts squashed, overshoots slightly, settles.
      const s = done ? 1 : 1 - 0.16 * Math.exp(-7 * t) * Math.cos(16 * t);
      const prefix = `pop:${category}:`;
      for (const key in this.J) if (key.startsWith(prefix)) this.J[key].scale.setScalar(s);
      if (done) this.pops.delete(category);
    }
  }

  update(delta: number, camera: THREE.Camera, el: HTMLElement, glowColor: THREE.Color) {
    const dt = Math.min(delta, 1 / 20);
    const now = performance.now();
    const d = this.drag;
    if (!d.active && now - d.released > 1800) d.target = 0;
    d.vel += (36 * (d.target - d.yaw) - 2 * 0.9 * 6 * d.vel) * dt;
    d.yaw += d.vel * dt;
    if (this.J.root) this.J.root.rotation.y = d.yaw;

    let look: LookInput = null;
    const attn = getRobotAttention();
    if (attn) look = this.screenToLook(attn.left + attn.width * 0.3, attn.top + attn.height / 2, camera, el);
    else if (now - pointer.t < 3500) look = this.screenToLook(pointer.x, pointer.y, camera, el);
    if (!look) {
      const w = this.wander;
      if (now > w.next) {
        const away = Math.random() < 0.3;
        w.yaw = away ? (Math.random() - 0.5) * 1.1 : (Math.random() - 0.5) * 0.25;
        w.pitch = away ? (Math.random() - 0.3) * 0.3 : (Math.random() - 0.5) * 0.08;
        w.next = now + (away ? 1400 : 2500) + Math.random() * 2800;
      }
      look = { yaw: w.yaw - d.yaw * 0.6, pitch: w.pitch };
    }

    this.brain.step(dt, this.mood, look, this.reduced ? 0.15 : 1);

    this.appliers ??= this.buildAppliers();
    const x = this.brain.x;
    for (let i = 0; i < x.length; i++) this.appliers[i](x[i]);
    this.updatePops(now);

    const glow = x[GLOW_I];
    this.tint.copy(glowColor).lerp(ALERT, Math.max(0, Math.min(1, x[ALERT_I])));
    this.M.glow.emissive.copy(this.tint);
    this.M.glow.emissiveIntensity = 2.6 * glow;
    this.M.glowSoft.emissive.copy(this.tint);
    this.M.glowSoft.emissiveIntensity = 1.15 * glow;
    this.M.iris.color.copy(this.tint).multiplyScalar(0.35);
    this.M.iris.emissive.copy(this.tint);
    this.M.iris.emissiveIntensity = 0.55 * glow;
    const core = this.J.core as THREE.PointLight | undefined;
    if (core?.parent) {
      core.color.copy(this.tint);
      core.intensity = 0.35 * glow;
    }
  }
}

type Props = {
  appearance: Appearance;
  mood: Mood;
  reduced: boolean;
  glowColor: THREE.Color;
};

const SIDES = [
  { s: 1, side: "L" },
  { s: -1, side: "R" },
] as const;

export function Robot({ appearance: a, mood, reduced, glowColor }: Props) {
  const M = useMemo(() => makeMaterials(), []);
  const ctl = useMemo(() => new RobotController(M), [M]);
  const { camera, gl } = useThree();
  const reg = ctl.reg;
  const k: Kit = { M, reg };

  useEffect(() => ctl.setInputs(mood, reduced), [ctl, mood, reduced]);
  useEffect(() => applyAppearance(M, a), [M, a]);
  useEffect(() => onRobotGesture((g) => ctl.brain.play(g)), [ctl]);
  useEffect(() => ctl.pop("head"), [ctl, a.head]);
  useEffect(() => ctl.pop("torso"), [ctl, a.torso]);
  useEffect(() => ctl.pop("arms"), [ctl, a.arms]);
  useEffect(() => ctl.pop("legs"), [ctl, a.legs]);
  useEffect(() => ctl.pop("outfit"), [ctl, a.outfit]);
  useEffect(() => ctl.pop("hat"), [ctl, a.hat]);
  useEffect(() => ctl.pop("glasses"), [ctl, a.glasses]);
  useEffect(
    () => () => {
      M.cables.map?.dispose();
      Object.values(M).forEach((m) => m.dispose());
    },
    [M],
  );

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => ctl.dragStart(e.clientX);
    const move = (e: PointerEvent) => ctl.dragMove(e.clientX);
    const up = () => ctl.dragEnd();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl, ctl]);

  useFrame((_, delta) => ctl.update(delta, camera, gl.domElement, glowColor));

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    ctl.click(e.delta);
  }

  const head = HEAD_VARIANTS[a.head];
  const torso = TORSO_VARIANTS[a.torso];
  const arms = ARM_VARIANTS[a.arms];
  const legs = LEG_VARIANTS[a.legs];
  const outfit = OUTFIT_VARIANTS[a.outfit];
  const Hat = HAT_VARIANTS[a.hat];
  const Glasses = GLASSES_VARIANTS[a.glasses];
  const an = head.anchors;

  /** Wraps a swappable piece so it can pop when changed; `key` remounts it on swap. */
  const slot = (name: string, id: string, node: ReactNode) => (
    <group key={`${name}:${id}`} ref={reg(`pop:${name}`)}>
      {node}
    </group>
  );

  return (
    <group ref={reg("root")} onClick={onClick}>
      <group ref={reg("hips")} position={[0, 0.98, 0]}>
        {slot("torso:pelvis", a.torso, <torso.Pelvis {...k} />)}
        {outfit.Hips && slot("outfit:hips", a.outfit, <outfit.Hips {...k} />)}
        {SIDES.map(({ s, side }) => {
          const p = { ...k, s, side };
          return (
            <group key={side} ref={reg(`thigh${side}`)} position={[s * 0.09, -0.04, 0]}>
              {slot(`legs:thigh${side}`, a.legs, <legs.Thigh {...p} />)}
              {outfit.Thigh && slot(`outfit:thigh${side}`, a.outfit, <outfit.Thigh {...p} />)}
              <group ref={reg(`knee${side}`)} position={[0, -0.45, 0]}>
                {slot(`legs:shin${side}`, a.legs, <legs.Shin {...p} />)}
                {outfit.Shin && slot(`outfit:shin${side}`, a.outfit, <outfit.Shin {...p} />)}
                <group ref={reg(`ankle${side}`)} position={[0, -0.43, 0]}>
                  {slot(`legs:foot${side}`, a.legs, <legs.Foot {...p} />)}
                  {outfit.Foot && slot(`outfit:foot${side}`, a.outfit, <outfit.Foot {...p} />)}
                </group>
              </group>
            </group>
          );
        })}
        <group ref={reg("spine")} position={[0, 0.06, 0]}>
          {slot("torso:waist", a.torso, <torso.Waist {...k} />)}
          <group ref={reg("chest")} position={[0, 0.22, 0]}>
            {slot("torso:chest", a.torso, <torso.Chest {...k} />)}
            {outfit.Chest && slot("outfit:chest", `${a.outfit}:${a.torso}`, <outfit.Chest {...k} fit={torso.fit} />)}
            {SIDES.map(({ s, side }) => {
              const p = { ...k, s, side };
              return (
                <group key={side} ref={reg(`clav${side}`)} position={[s * 0.145, 0.275, 0]}>
                  <group ref={reg(`arm${side}`)} position={[s * 0.055, 0, 0]}>
                    {slot(`arms:upper${side}`, a.arms, <arms.Upper {...p} />)}
                    {outfit.Upper && slot(`outfit:upper${side}`, a.outfit, <outfit.Upper {...p} />)}
                    <group ref={reg(`elbow${side}`)} position={[0, -0.29, 0]}>
                      {slot(`arms:fore${side}`, a.arms, <arms.Fore {...p} />)}
                      {outfit.Fore && slot(`outfit:fore${side}`, a.outfit, <outfit.Fore {...p} />)}
                      <group ref={reg(`wrist${side}`)} position={[0, -0.262, 0]}>
                        {slot(`arms:hand${side}`, a.arms, <Hand {...p} style={arms.hand} />)}
                      </group>
                    </group>
                  </group>
                </group>
              );
            })}
            <group ref={reg("neck")} position={[0, 0.35, 0]}>
              {slot("torso:neck", a.torso, <torso.Neck {...k} />)}
              {outfit.Neck && slot("outfit:neck", a.outfit, <outfit.Neck {...k} />)}
              <group ref={reg("head")} position={[0, 0.1, 0]}>
                {slot("head:main", a.head, <head.Head {...k} />)}
                {Hat &&
                  slot(
                    "hat:main",
                    `${a.hat}:${a.head}`,
                    <group position={[0, an.top, an.crownZ]} scale={an.width / BASE_ANCHORS.width}>
                      <Hat {...k} />
                    </group>,
                  )}
                {Glasses &&
                  slot(
                    "glasses:main",
                    `${a.glasses}:${a.head}`,
                    <group position={[0, an.eyeY, an.faceZ]} scale={[an.eyeX / BASE_ANCHORS.eyeX, 1, 1]}>
                      <Glasses {...k} />
                    </group>,
                  )}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
