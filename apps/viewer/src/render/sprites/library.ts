import type { Img } from "./image";
import { FURNITURE_SPRITES } from "./furniture";
import { EQUIPMENT } from "./equipment";
import { MOUNTS, DECALS } from "./mounts";

export interface Glow { r: number; i: number; c: [number, number, number] }

const REGISTRY: Record<string, () => Img> = { ...FURNITURE_SPRITES, ...EQUIPMENT, ...MOUNTS, ...DECALS };
const cache = new Map<string, Img | null>();

/** Sprite by name, with kind-specific fallbacks (e.g. `bed:galley` falls back to `bed:habitation`). */
export function spriteFor(name: string): Img | null {
  if (cache.has(name)) return cache.get(name)!;
  const make = REGISTRY[name] ?? REGISTRY[`${name.split(":")[0]}:${name.startsWith("console") ? "habitation" : name.startsWith("bed") ? "habitation" : name.startsWith("table") ? "basic" : ""}`];
  const img = make ? make() : null;
  cache.set(name, img);
  return img;
}
export const spriteNames = () => Object.keys(REGISTRY);

const CY: [number, number, number] = [60, 200, 255], OR: [number, number, number] = [255, 140, 40], GN: [number, number, number] = [60, 255, 150], RD: [number, number, number] = [255, 70, 70], WM: [number, number, number] = [255, 220, 150];
/** Light emitted by a sprite, for the baked lighting pass. */
export function glowOf(name: string): Glow | null {
  if (name === "prop:reactor") return { r: 90, i: 1.1, c: OR };
  if (name === "prop:holo") return { r: 50, i: 0.8, c: CY };
  if (name === "prop:generator" || name === "prop:stove") return { r: 28, i: 0.5, c: OR };
  if (name === "prop:vending") return { r: 26, i: 0.5, c: [180, 120, 255] };
  if (name === "bed:pod" || name === "prop:cryo" || name === "prop:scanner" || name === "prop:xray") return { r: 24, i: 0.5, c: CY };
  if (name === "prop:battery" || name === "plant:hydro") return { r: 24, i: 0.5, c: name === "plant:hydro" ? [190, 140, 255] : GN };
  if (name === "wall:light") return { r: 42, i: 0.9, c: WM };
  if (name === "wall:screen-alert" || name === "wall:screen-cams") return { r: 24, i: 0.5, c: RD };
  if (name === "wall:screen-power") return { r: 26, i: 0.5, c: OR };
  if (name.startsWith("wall:screen")) return { r: 26, i: 0.55, c: CY };
  if (name.startsWith("console:") || name === "prop:rack" || name === "prop:dish") return { r: 34, i: 0.8, c: name === "console:eng" || name === "console:engineering" ? OR : name === "console:sec" || name === "console:security" ? RD : CY };
  return null;
}
