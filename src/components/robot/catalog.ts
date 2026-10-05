/**
 * Everything the customizer can offer, with display names. No Three.js here: the chat UI imports
 * this, and the 3D stage is lazy-loaded.
 */

import { DEFAULT_NAME } from "@/lib/name";

export type Option<Id extends string = string> = { id: Id; name: string; hint?: string };

const opts = <const T extends readonly Option[]>(list: T) => list;

export const HEADS = opts([
  { id: "ns", name: "Humano", hint: "Rostro sintético clásico" },
  { id: "visor", name: "Visor", hint: "Escáner de luz horizontal" },
  { id: "cyclops", name: "Cíclope", hint: "Un solo lente" },
  { id: "knight", name: "Caballero", hint: "Yelmo con ranura en T" },
  { id: "brain", name: "Cerebro", hint: "Cúpula de cristal" },
  { id: "screen", name: "Pantalla", hint: "Monitor con emociones" },
  { id: "mantis", name: "Mantis", hint: "Ojos compuestos y antenas" },
  { id: "retro", name: "Retro", hint: "Robot de hojalata" },
  { id: "mecha", name: "Mecha", hint: "Cresta en V" },
  { id: "skull", name: "Calavera", hint: "Endoesqueleto cromado" },
]);

export const TORSOS = opts([
  { id: "ns", name: "Clásico", hint: "Carcasa perlada" },
  { id: "crystal", name: "Cristal", hint: "Se ve el mecanismo" },
  { id: "armored", name: "Blindado", hint: "Placas segmentadas" },
  { id: "core", name: "Reactor", hint: "Núcleo de energía" },
  { id: "athlete", name: "Atlético", hint: "Musculatura esculpida" },
  { id: "tank", name: "Tanque", hint: "Industrial y pesado" },
  { id: "skeleton", name: "Esqueleto", hint: "Costillas de cromo" },
  { id: "retro", name: "Retro", hint: "Barril con remaches" },
  { id: "mecha", name: "Mecha", hint: "Cabina angular" },
  { id: "scales", name: "Escamas", hint: "Placas superpuestas" },
]);

export const ARMS = opts([
  { id: "ns", name: "Clásicos", hint: "Músculo negro y carcasa" },
  { id: "athlete", name: "Atléticos", hint: "Carcasa completa" },
  { id: "armored", name: "Blindados", hint: "Guanteletes pesados" },
  { id: "skeleton", name: "Esqueleto", hint: "Huesos y pistones" },
  { id: "cables", name: "Cables", hint: "Haces de fibras" },
  { id: "hydraulic", name: "Hidráulicos", hint: "Pistones industriales" },
  { id: "mecha", name: "Mecha", hint: "Blindaje angular" },
  { id: "retro", name: "Retro", hint: "Tubos de acordeón" },
  { id: "crystal", name: "Cristal", hint: "Venas de energía" },
  { id: "claws", name: "Garras", hint: "Antebrazos de combate" },
]);

export const LEGS = opts([
  { id: "ns", name: "Clásicas", hint: "Músculo negro y carcasa" },
  { id: "athlete", name: "Atléticas", hint: "Carcasa completa" },
  { id: "armored", name: "Blindadas", hint: "Grebas pesadas" },
  { id: "skeleton", name: "Esqueleto", hint: "Huesos y pistones" },
  { id: "cables", name: "Cables", hint: "Haces de fibras" },
  { id: "hydraulic", name: "Hidráulicas", hint: "Pistones industriales" },
  { id: "mecha", name: "Mecha", hint: "Blindaje angular" },
  { id: "retro", name: "Retro", hint: "Tubos de acordeón" },
  { id: "crystal", name: "Cristal", hint: "Venas de energía" },
  { id: "jets", name: "Propulsores", hint: "Botas a reacción" },
]);

export const OUTFITS = opts([
  { id: "none", name: "Sin ropa" },
  { id: "warrior", name: "Guerrero", hint: "Coraza y hombreras" },
  { id: "mage", name: "Mago", hint: "Túnica arcana" },
  { id: "rogue", name: "Pícaro", hint: "Cuero y bufanda" },
  { id: "paladin", name: "Paladín", hint: "Armadura dorada y capa" },
  { id: "ranger", name: "Arquero", hint: "Túnica y carcaj" },
  { id: "necro", name: "Nigromante", hint: "Túnica sombría" },
  { id: "samurai", name: "Samurái", hint: "Armadura laminada" },
  { id: "pirate", name: "Pirata", hint: "Casaca de capitán" },
  { id: "hoodie", name: "Urbano", hint: "Buzo y zapatillas" },
  { id: "suit", name: "Ejecutivo", hint: "Saco y corbata" },
]);

export const HATS = opts([
  { id: "none", name: "Ninguno" },
  { id: "wizard", name: "Sombrero de mago" },
  { id: "helm", name: "Yelmo" },
  { id: "crown", name: "Corona" },
  { id: "viking", name: "Vikingo" },
  { id: "hood", name: "Capucha" },
  { id: "cap", name: "Gorra" },
  { id: "tricorn", name: "Tricornio" },
  { id: "halo", name: "Aureola" },
  { id: "horns", name: "Cuernos" },
  { id: "headphones", name: "Auriculares" },
  { id: "beanie", name: "Gorro de lana" },
  { id: "tophat", name: "Galera" },
  { id: "catears", name: "Orejas de gato" },
]);

export const GLASSES = opts([
  { id: "none", name: "Ninguno" },
  { id: "round", name: "Redondos" },
  { id: "aviator", name: "Aviador" },
  { id: "visor", name: "Visor cyber" },
  { id: "monocle", name: "Monóculo" },
  { id: "goggles", name: "Antiparras" },
  { id: "patch", name: "Parche" },
  { id: "pixel", name: "Pixelados" },
  { id: "hud", name: "HUD holográfico" },
  { id: "mask", name: "Máscara ninja" },
]);

export const BACKGROUNDS = opts([
  { id: "arcos", name: "Cámara azul", hint: "Arcos de neón sobre piso oscuro" },
  { id: "hexagonos", name: "Sala violeta", hint: "Piso hexagonal y columnas de luz" },
  { id: "pasillo", name: "Pasillo de naves", hint: "Corredor con paneles naranjas" },
  { id: "triangulo", name: "Túnel gris", hint: "Luz blanca en triángulos" },
  { id: "nucleo", name: "Núcleo neón", hint: "Cian y magenta en cruz" },
  { id: "portal", name: "Portal", hint: "Un túnel que brilla al fondo" },
]);

type Ids<T extends readonly Option[]> = T[number]["id"];
export type HeadId = Ids<typeof HEADS>;
export type TorsoId = Ids<typeof TORSOS>;
export type ArmsId = Ids<typeof ARMS>;
export type LegsId = Ids<typeof LEGS>;
export type OutfitId = Ids<typeof OUTFITS>;
export type HatId = Ids<typeof HATS>;
export type GlassesId = Ids<typeof GLASSES>;
export type BackgroundId = Ids<typeof BACKGROUNDS>;

export type Finish = "pearl" | "frosted" | "matte" | "chrome";
export type MotionPref = "system" | "full" | "reduced";

export type Look = {
  head: HeadId;
  torso: TorsoId;
  arms: ArmsId;
  legs: LegsId;
  outfit: OutfitId;
  hat: HatId;
  glasses: GlassesId;
  shell: string;
  muscle: string;
  metal: string;
  glow: string;
  finish: Finish;
};

export type Appearance = Look & { background: BackgroundId; motion: MotionPref; name: string };

export const FINISHES: Option<Finish>[] = [
  { id: "pearl", name: "Perlado" },
  { id: "frosted", name: "Esmerilado" },
  { id: "matte", name: "Mate" },
  { id: "chrome", name: "Cromado" },
];

export const MOTIONS: Option<MotionPref>[] = [
  { id: "system", name: "Sistema" },
  { id: "full", name: "Completo" },
  { id: "reduced", name: "Reducido" },
];

export const SWATCHES = {
  shell: ["#eeeae3", "#e8ebef", "#f4efe2", "#d9e7ff", "#f4d9d0", "#c9f2e0", "#e6e0ff", "#3a3f44", "#1d1f24"],
  muscle: ["#111214", "#2a2d33", "#3a2a1a", "#1b1530", "#401818", "#0f2a24", "#5b6270", "#d8dce2"],
  metal: ["#d9dde2", "#d9b35a", "#c07a4a", "#9aa4b1", "#6c6478", "#b9a6ff", "#8fe3ff", "#2b2d31"],
  glow: ["#22d3ee", "#3da5ff", "#5ef2b8", "#ffd166", "#ff8a4c", "#ff3b5c", "#b983ff", "#ff2bd6"],
} as const;

const NS5: Look = {
  head: "ns",
  torso: "ns",
  arms: "ns",
  legs: "ns",
  outfit: "none",
  hat: "none",
  glasses: "none",
  shell: "#eeeae3",
  muscle: "#111214",
  metal: "#d9dde2",
  glow: "#22d3ee",
  finish: "pearl",
};

export const PRESETS: (Option & { look: Look })[] = [
  { id: "ns5", name: "Clásico", look: NS5 },
  {
    id: "paladin",
    name: "Paladín",
    look: { head: "knight", torso: "armored", arms: "armored", legs: "armored", outfit: "paladin", hat: "halo", glasses: "none", shell: "#f4efe2", muscle: "#2a2118", metal: "#d9b35a", glow: "#ffd166", finish: "pearl" },
  },
  {
    id: "mage",
    name: "Archimago",
    look: { head: "brain", torso: "crystal", arms: "crystal", legs: "crystal", outfit: "mage", hat: "wizard", glasses: "round", shell: "#e6e0ff", muscle: "#1b1530", metal: "#b9a6ff", glow: "#b983ff", finish: "frosted" },
  },
  {
    id: "rogue",
    name: "Sombra",
    look: { head: "mantis", torso: "athlete", arms: "cables", legs: "cables", outfit: "rogue", hat: "hood", glasses: "mask", shell: "#3a3f44", muscle: "#111214", metal: "#9aa4b1", glow: "#5ef2b8", finish: "matte" },
  },
  {
    id: "samurai",
    name: "Ronin",
    look: { head: "mecha", torso: "scales", arms: "mecha", legs: "mecha", outfit: "samurai", hat: "horns", glasses: "none", shell: "#f4efe2", muscle: "#401818", metal: "#2b2d31", glow: "#ff3b5c", finish: "pearl" },
  },
  {
    id: "pirate",
    name: "Capitán",
    look: { head: "retro", torso: "retro", arms: "retro", legs: "retro", outfit: "pirate", hat: "tricorn", glasses: "patch", shell: "#d8c9a8", muscle: "#3a2a1a", metal: "#c07a4a", glow: "#ffd166", finish: "matte" },
  },
  {
    id: "cyber",
    name: "Neón",
    look: { head: "visor", torso: "core", arms: "hydraulic", legs: "jets", outfit: "hoodie", hat: "headphones", glasses: "none", shell: "#1d1f24", muscle: "#0f2a24", metal: "#8fe3ff", glow: "#ff2bd6", finish: "chrome" },
  },
  {
    id: "necro",
    name: "Liche",
    look: { head: "skull", torso: "skeleton", arms: "skeleton", legs: "skeleton", outfit: "necro", hat: "crown", glasses: "none", shell: "#3a3f44", muscle: "#1b1530", metal: "#6c6478", glow: "#5ef2b8", finish: "matte" },
  },
  {
    id: "retro",
    name: "Retro",
    look: { head: "screen", torso: "tank", arms: "claws", legs: "hydraulic", outfit: "none", hat: "cap", glasses: "none", shell: "#f4d9d0", muscle: "#2a2d33", metal: "#c07a4a", glow: "#5ef2b8", finish: "matte" },
  },
  {
    id: "exec",
    name: "Ejecutivo",
    look: { head: "ns", torso: "athlete", arms: "athlete", legs: "athlete", outfit: "suit", hat: "none", glasses: "aviator", shell: "#e8ebef", muscle: "#2a2d33", metal: "#d9dde2", glow: "#3da5ff", finish: "pearl" },
  },
];

export const DEFAULT_APPEARANCE: Appearance = { ...NS5, background: "arcos", motion: "system", name: DEFAULT_NAME };

/** Which part of the body the camera frames while a customizer tab is open. */
export type Focus = "full" | "upper" | "head" | "legs" | "wide";

export type TabId = "styles" | "head" | "torso" | "arms" | "legs" | "outfit" | "hat" | "glasses" | "background" | "colors";

export const TAB_FOCUS: Record<TabId, Focus> = {
  styles: "full",
  head: "head",
  hat: "head",
  glasses: "head",
  torso: "upper",
  outfit: "full",
  arms: "upper",
  legs: "legs",
  background: "wide",
  colors: "full",
};

export const PART_LISTS = {
  head: HEADS,
  torso: TORSOS,
  arms: ARMS,
  legs: LEGS,
  outfit: OUTFITS,
  hat: HATS,
  glasses: GLASSES,
  background: BACKGROUNDS,
} as const;
export type PartKey = keyof typeof PART_LISTS;
