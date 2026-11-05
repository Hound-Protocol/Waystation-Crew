import { TileKind } from "@wc/sim-core";
import type { BakeInput } from "../tiles";

/**
 * Prop sprites (`prop:<name>`) that are big equipment and block light.
 * Anything else with layer "prop" (beacons, holo, seats, pipes, valves, iv, defib, scales...) is decor and passes light.
 */
const SOLID_PROPS = new Set([
  "reactor", "generator", "rack", "battery", "cryo", "scanner", "xray", "stove", "fridge", "cooler", "vending",
  "lathe", "workbench", "locker", "medcab", "forklift", "crate", "counter", "shelf", "printer", "coolant", "surgery",
]);

/** Furniture kinds that block light. Plants (and anything not listed) do not. */
const SOLID_FURNITURE = new Set<number>([TileKind.Bed, TileKind.Console, TileKind.Table]);

/** One byte per tile (index y*w+x): 1 = blocks light. Open doors (indices in `openDoors`) and canopy glass pass light. */
export function solidMask(inp: BakeInput, openDoors?: Set<number>): Uint8Array {
  const { w, h, tiles } = inp;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) {
    const k = tiles[i];
    m[i] = k === TileKind.Void || k === TileKind.Wall || k === TileKind.Airlock || k === TileKind.Bed || k === TileKind.Console || k === TileKind.Table ? 1
      : k === TileKind.Door ? (openDoors?.has(i) ? 0 : 1) : 0;
  }
  for (const f of inp.furniture ?? []) if (SOLID_FURNITURE.has(f.kind) && f.x >= 0 && f.y >= 0 && f.x < w && f.y < h) m[f.y * w + f.x] = 1;
  for (const d of inp.deco ?? []) {
    if (d.x < 0 || d.y < 0 || d.x >= w || d.y >= h) continue;
    const i = d.y * w + d.x;
    if (d.layer === "prop" && SOLID_PROPS.has(d.sprite.replace(/^prop:/, ""))) m[i] = 1;
  }
  // canopy glass last: it wins over everything underneath
  for (const d of inp.deco ?? []) if (d.sprite === "wall:canopy" && d.x >= 0 && d.y >= 0 && d.x < w && d.y < h) m[d.y * w + d.x] = 0;
  return m;
}
