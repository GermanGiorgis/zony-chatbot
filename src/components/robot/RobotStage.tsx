"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useRenderedAppearance } from "./appearance";
import { Scene } from "./Scene";
import { camera as cameraBus, pointer } from "./bus";
import type { Focus } from "./catalog";
import type { Mood } from "./rig";
import { Robot } from "./Robot";

/** Camera height (look-at) and distance for each framing. */
const FRAMES: Record<Focus, { y: number; dist: number }> = {
  full: { y: 1.0, dist: 4.3 },
  upper: { y: 1.4, dist: 2.35 },
  head: { y: 1.87, dist: 0.9 },
  legs: { y: 0.52, dist: 2.3 },
  wide: { y: 1.15, dist: 5.6 },
};

function CameraRig({ reduced }: { reduced: boolean }) {
  const aim = useRef(new THREE.Vector3(0, 0.58, 0));
  const placed = useRef(false);
  useFrame(({ camera, size }, delta) => {
    const dt = Math.min(delta, 1 / 20);
    let y: number;
    let dist: number;
    const focus = cameraBus.focus;
    if (focus) {
      ({ y, dist } = FRAMES[focus]);
      // Narrow portrait stages need more distance to fit the same framing sideways.
      dist *= THREE.MathUtils.lerp(1.25, 1, THREE.MathUtils.smoothstep(size.width / size.height, 0.6, 1));
    } else {
      // Full-bleed background: the whole body, standing in the upper part of the screen with the floor in front of it
      // (the welcome card and the composer take the bottom), small enough to read as deep inside the scene. The camera
      // looks level, so the scene's horizon sits mid-screen (see scripts/build-scenes.mjs).
      const k = THREE.MathUtils.smoothstep(size.width / size.height, 0.6, 1);
      y = THREE.MathUtils.lerp(0.45, 0.58, k);
      dist = THREE.MathUtils.lerp(8.4, 7.2, k);
      // A short viewport (landscape phone) can't fit the full body: dolly in to the bust instead.
      const bust = 1 - THREE.MathUtils.smoothstep(size.height, 460, 640);
      y = THREE.MathUtils.lerp(y, 1.72, bust);
      dist = THREE.MathUtils.lerp(dist, 2.2, bust);
    }
    let px = 0;
    let py = 0;
    if (!reduced && pointer.t > 0) {
      px = (pointer.x / window.innerWidth - 0.5) * 0.5 * Math.min(1, dist / 2.5);
      py = (0.5 - pointer.y / window.innerHeight) * 0.14 * Math.min(1, dist / 2.5);
    }
    // The first frame goes straight to the framing (the poster already shows it); after that the camera glides.
    const damp = (a: number, b: number) => (placed.current ? THREE.MathUtils.damp(a, b, 3.5, dt) : b);
    camera.position.set(damp(camera.position.x, px), damp(camera.position.y, y + 0.08 * Math.min(1, dist / 2) + py), damp(camera.position.z, dist));
    aim.current.set(0, damp(aim.current.y, y), 0);
    camera.lookAt(aim.current);
    placed.current = true;
  });
  return null;
}

/** Calls `onReady` once a few frames have drawn and the scenery has loaded (or 6 s have passed, so a bad network never keeps the poster up). */
function ReadySignal({ sceneryLoaded, onReady }: { sceneryLoaded: boolean; onReady: () => void }) {
  const frames = useRef(0);
  const started = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    frames.current++;
    started.current ||= performance.now();
    if (done.current || frames.current < 3) return;
    if (sceneryLoaded || performance.now() - started.current > 6000) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function RobotStage({
  mood,
  reduced,
  onReady,
  onLost,
}: {
  mood: Mood;
  reduced: boolean;
  onReady: () => void;
  /** The GPU dropped the WebGL context (driver reset, too many tabs): the page falls back to the still poster. */
  onLost: () => void;
}) {
  const appearance = useRenderedAppearance();
  const glow = useMemo(() => new THREE.Color(appearance.glow), [appearance.glow]);
  const [sceneryLoaded, setSceneryLoaded] = useState(false);
  // Slow phones: after sustained low frame rates, drop to 1x pixel density and no multisampling.
  const [lowPower, setLowPower] = useState(false);

  return (
    <Canvas
      dpr={lowPower ? 1 : [1, 1.75]}
      camera={{ fov: 30, position: [0, 0.66, 7.2], near: 0.05, far: 80 }}
      style={{ touchAction: "pan-y", cursor: "grab" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      <PerformanceMonitor onDecline={() => setLowPower(true)} />
      <Scene id={appearance.background} onLoaded={() => setSceneryLoaded(true)} />
      <Robot appearance={appearance} mood={mood} reduced={reduced} glowColor={glow} />
      <CameraRig reduced={reduced} />
      <ReadySignal sceneryLoaded={sceneryLoaded} onReady={onReady} />
      <EffectComposer multisampling={lowPower ? 0 : 4}>
        <Bloom mipmapBlur luminanceThreshold={0.95} intensity={0.75} radius={0.65} />
      </EffectComposer>
    </Canvas>
  );
}
