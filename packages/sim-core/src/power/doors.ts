import type { World } from "../world";
import { TileKind } from "../station/tilemap";

/** With the grid down, doors stay shut. Forcing one by hand takes this many ticks; whoever reaches it first does the work. */
export const FORCE_TICKS = 10;
/** A forcer who has not made progress for this many ticks has given up (blocked, re-tasked) and someone else may take over. */
const STALE = 3;

/** A powerless, unforced door. Walls, floor and the ship's airlock gate are never closed doors. */
export function isDoorClosed(w: World, x: number, y: number): boolean {
  const g = w.power;
  return !g.doorsPowered && w.station.map.get(x, y) === TileKind.Door && !g.forced.has(y * w.station.map.w + x);
}

/** A character wants to step onto a door tile. True once it is (or has just been forced) open; otherwise it counts toward forcing and the caller waits. */
export function tryForce(w: World, id: number, x: number, y: number): boolean {
  if (!isDoorClosed(w, x, y)) return true;
  const g = w.power, idx = y * w.station.map.w + x;
  let f = g.forcing.get(idx);
  if (!f || (f.by !== id && w.tick - f.last > STALE)) { f = { by: id, left: FORCE_TICKS, last: w.tick - 1 }; g.forcing.set(idx, f); }
  if (f.by !== id) return false;                         // someone else is on it: wait
  if (f.last !== w.tick) { f.last = w.tick; f.left--; }  // one tick of work per sim tick, however many steps the walker had
  if (f.left > 0) return false;
  g.forced.add(idx); g.forcing.delete(idx); return true;
}
