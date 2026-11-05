import { TileKind, type Tilemap } from "../station/tilemap";
import type { Deco, Station } from "../station/starter";

/** Wall lamps: where they can go and what they light. Coverage is a cache (lamps per tile) updated as lamps are built. */
export const LAMP_REACH = 5;
export const LAMP_SPRITE = "wall:light";

/** Where a wall fitting may hang: a wall tile with floor to the south, walls east and west, and no floor to the north (the planner's own rule). */
export function isMountSpot(map: Tilemap, x: number, y: number): boolean {
  return map.inBounds(x, y + 1) && map.get(x, y) === TileKind.Wall && map.get(x, y + 1) === TileKind.Floor
    && map.get(x - 1, y) === TileKind.Wall && map.get(x + 1, y) === TileKind.Wall && map.get(x, y - 1) !== TileKind.Floor;
}

/** Tiles people stand or sleep on need light. */
export const needsLight = (k: TileKind) => k === TileKind.Floor || k === TileKind.Bed;
const opaque = (k: TileKind) => k === TileKind.Wall || k === TileKind.Void;

/** Does a lamp on wall tile (lx, ly) light tile (tx, ty)? Within LAMP_REACH of the tile in front of it, with a clear line (walls block). */
export function lights(map: Tilemap, lx: number, ly: number, tx: number, ty: number): boolean {
  const ox = lx, oy = ly + 1, dx = Math.abs(tx - ox), dy = Math.abs(ty - oy);
  if (dx * dx + dy * dy > LAMP_REACH * LAMP_REACH) return false;
  const sx = ox < tx ? 1 : -1, sy = oy < ty ? 1 : -1;
  let x = ox, y = oy, e = dx - dy;
  while (x !== tx || y !== ty) {
    if ((x !== ox || y !== oy) && opaque(map.get(x, y))) return false;
    const e2 = 2 * e;
    if (e2 > -dy) { e -= dy; x += sx; }
    if (e2 < dx) { e += dx; y += sy; }
  }
  return true;
}

export const lampsOf = (st: Station): Deco[] => (st.deco ?? []).filter((d) => d.sprite === LAMP_SPRITE);

/** Adds (delta 1) or removes (-1) one lamp's light in the coverage cache. */
export function addLamp(cov: Uint8Array, st: Station, lx: number, ly: number, delta = 1): void {
  const map = st.map, ox = lx, oy = ly + 1;
  for (let y = Math.max(0, oy - LAMP_REACH); y <= Math.min(map.h - 1, oy + LAMP_REACH); y++)
    for (let x = Math.max(0, ox - LAMP_REACH); x <= Math.min(map.w - 1, ox + LAMP_REACH); x++)
      if (needsLight(map.get(x, y)) && lights(map, lx, ly, x, y)) cov[y * map.w + x] += delta;
}

export function buildCoverage(st: Station): Uint8Array {
  const cov = new Uint8Array(st.map.w * st.map.h);
  for (const l of lampsOf(st)) addLamp(cov, st, l.x, l.y);
  return cov;
}
