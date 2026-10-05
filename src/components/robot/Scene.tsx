"use client";

import { ContactShadows, Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { BackgroundId } from "./catalog";

/**
 * The scenery is part of the 3D scene, not a picture behind it. The image is a big plane far behind the stage, sized
 * to cover the view like `object-fit: cover`, and a shrunken, softened copy of the very same image (public/zony/scenes,
 * `<id>-env.jpg`) is the environment map, so the neon around the robot is what lights it and shows in its chrome.
 * Key light, rim light and shadow colour are picked per image for the same reason.
 */
type Rig = {
  /** Scene has no visible floor: add a soft glow pad of this colour under the feet so the robot has ground to stand on. */
  pad?: string;
  /** How much larger than "just covers the view" the image is drawn (crops the edges, enlarges the vanishing point). */
  zoom: number;
  /** World units to lift (+) or drop (-) the image, to settle the floor around the robot's feet. */
  dy: number;
  ambient: number;
  key: { color: string; intensity: number; position: [number, number, number] };
  rim: { color: string; intensity: number };
  /** How strongly the scene reflects in the chrome and pearl. */
  reflect: number;
  shadow: { color: string; opacity: number };
};

const RIGS: Record<BackgroundId, Rig> = {
  arcos: { zoom: 1, dy: 0, ambient: 0.25, key: { color: "#a9c6ff", intensity: 1.5, position: [2.5, 3.5, 3] }, rim: { color: "#3d6bff", intensity: 2 }, reflect: 1.3, shadow: { color: "#000a2a", opacity: 0.7 } },
  hexagonos: { zoom: 1, dy: 0, ambient: 0.25, key: { color: "#c3b0ff", intensity: 1.5, position: [2.5, 3.5, 3] }, rim: { color: "#7a4dff", intensity: 1.9 }, reflect: 1.2, shadow: { color: "#0a0020", opacity: 0.7 } },
  pasillo: { zoom: 1, dy: 0, ambient: 0.3, key: { color: "#d4dcff", intensity: 1.6, position: [2.5, 3.5, 3] }, rim: { color: "#ff9a4d", intensity: 1.6 }, reflect: 1.1, shadow: { color: "#10142a", opacity: 0.55 } },
  triangulo: { pad: "#ffffff", zoom: 1.15, dy: 0, ambient: 0.3, key: { color: "#ffffff", intensity: 1.8, position: [2.5, 3.5, 3] }, rim: { color: "#cfe0ff", intensity: 1.2 }, reflect: 1, shadow: { color: "#000000", opacity: 0.5 } },
  nucleo: { pad: "#4de0ff", zoom: 1.1, dy: 0, ambient: 0.22, key: { color: "#ffa6e8", intensity: 1.4, position: [2.5, 3.5, 3] }, rim: { color: "#4de0ff", intensity: 1.9 }, reflect: 1.2, shadow: { color: "#12002a", opacity: 0.6 } },
  portal: { pad: "#a9c0ff", zoom: 1.1, dy: 0, ambient: 0.25, key: { color: "#d9ccff", intensity: 1.5, position: [2.5, 3.5, 3] }, rim: { color: "#7fd0ff", intensity: 1.7 }, reflect: 1.2, shadow: { color: "#0c0a24", opacity: 0.6 } },
};

const DISTANCE = 34; // behind the stage: far enough that the camera moving a little never shifts the scenery
const FAR_CAMERA = 5.4; // the farthest the camera ever sits (full body on wide screens)
const FOV = THREE.MathUtils.degToRad(30);
const IMAGE_ASPECT = 16 / 9;

function Picture({ map, zoom, dy }: { map: THREE.Texture; zoom: number; dy: number }) {
  const { width, height } = useThree((s) => s.size);
  const visibleH = 2 * (DISTANCE + FAR_CAMERA) * Math.tan(FOV / 2);
  const visibleW = visibleH * (width / height);
  // "cover": the image touches the long side of the view and overflows the other.
  const planeH = Math.max(visibleH, visibleW / IMAGE_ASPECT) * 1.06 * zoom;
  return (
    <mesh position={[0, 1.2 + dy, -DISTANCE]} scale={[planeH * IMAGE_ASPECT, planeH, 1]} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

type Loaded = { id: BackgroundId; picture: THREE.Texture; env: THREE.Texture };

/**
 * Loads a scene's picture and lighting probe together and only swaps once both are ready, so changing the scenery
 * never shows an empty stage: the previous picture and its lighting stay until the new ones can replace them.
 * Textures that were replaced are freed so browsing all the scenes does not pile up GPU memory.
 */
function useScenery(id: BackgroundId, onLoaded?: () => void) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const current = useRef<Loaded | null>(null);
  const notify = useRef(onLoaded);
  useEffect(() => {
    notify.current = onLoaded;
  });
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    Promise.all([loader.loadAsync(`/zony/scenes/${id}.webp`), loader.loadAsync(`/zony/scenes/${id}-env.jpg`)])
      .then(([picture, env]) => {
        picture.colorSpace = THREE.SRGBColorSpace;
        picture.anisotropy = 8;
        env.colorSpace = THREE.SRGBColorSpace;
        env.mapping = THREE.EquirectangularReflectionMapping;
        if (!alive) {
          picture.dispose();
          env.dispose();
          return;
        }
        const old = current.current;
        current.current = { id, picture, env };
        setLoaded(current.current);
        notify.current?.();
        if (old) setTimeout(() => (old.picture.dispose(), old.env.dispose()), 800);
      })
      .catch(() => {
        // Offline or a missing file: keep whatever is on screen (or the plain page behind the canvas).
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return loaded;
}

/** Soft radial glow lying on the floor, additive: the "pad" the robot stands on when the picture shows no floor. */
function Pad({ color }: { color: string }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.28)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} renderOrder={-5}>
      <circleGeometry args={[1.35, 48]} />
      <meshBasicMaterial map={texture} color={color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function Scene({ id, onLoaded }: { id: BackgroundId; onLoaded?: () => void }) {
  const scenery = useScenery(id, onLoaded);
  // Lights follow the picture that is actually showing, so they change together with it.
  const r = RIGS[scenery?.id ?? id];
  return (
    <>
      <ambientLight intensity={r.ambient} />
      <directionalLight position={r.key.position} intensity={r.key.intensity} color={r.key.color} />
      <directionalLight position={[-3, 2.5, -3]} intensity={r.rim.intensity} color={r.rim.color} />
      {scenery && <Picture map={scenery.picture} zoom={r.zoom} dy={r.dy} />}
      {scenery && <Environment map={scenery.env} environmentIntensity={r.reflect} />}
      {r.pad && <Pad color={r.pad} />}
      <ContactShadows position={[0, 0.003, 0]} opacity={r.shadow.opacity} scale={2.8} blur={2.6} far={1.5} resolution={512} color={r.shadow.color} />
    </>
  );
}
