import type { World } from "./world";
import type { TileKind } from "./station/tilemap";
import { lampsOf, needsLight } from "./light/coverage";

/** Station-wide numbers for the overview card. Cheap enough to compute every few seconds: one pass over the crew and one over the map. */
export interface StationStats {
  /** mean satisfaction of each need across the crew, 0..1 (0 for an empty crew) */
  needs: { hunger: number; energy: number; social: number; hygiene: number; fun: number };
  lamps: number; /** floor and bed tiles no lamp lights */ dark: number; /** lamp orders open */ orders: number; /** lamps Engineering has built */ built: number; rooms: number;
}

export function stationStats(w: World): StationStats {
  const c = w.chars, n = c.count, needs = { hunger: 0, energy: 0, social: 0, hygiene: 0, fun: 0 };
  for (let i = 0; i < n; i++) { needs.hunger += c.hunger[i]; needs.energy += c.energy[i]; needs.social += c.social[i]; needs.hygiene += c.hygiene[i]; needs.fun += c.fun[i]; }
  if (n) for (const k of Object.keys(needs) as Array<keyof typeof needs>) needs[k] /= n;
  const t = w.station.map.tiles, cover = w.light.cover; let dark = 0;
  for (let i = 0; i < t.length; i++) if (cover[i] === 0 && needsLight(t[i] as TileKind)) dark++;
  return { needs, lamps: lampsOf(w.station).length, dark, orders: w.light.orders.length, built: w.light.built, rooms: w.station.rooms.length };
}
