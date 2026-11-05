import type { Station } from "../station/starter";
import { LAMP_REACH, isMountSpot, lights, needsLight } from "./coverage";

/** A lamp is only worth building where it lights at least this many dark tiles. */
export const MIN_GAIN = 8;
/** How many build orders may be open at once. */
export const MAX_ORDERS = 6;

export interface SurveyOpts {
  max: number;
  /** tiles and spots to ignore (e.g. inside the ship) */
  skip: (x: number, y: number) => boolean;
  /** mount spots already ordered or struck off, as y * width + x */
  taken: Set<number>;
}
export interface Proposed { x: number; y: number; gain: number }

/**
 * Finds the dark gaps (floor no lamp lights) and proposes wall spots to fix them, best first. Greedy: each pick discounts the tiles it lights,
 * so later picks only count what is still dark. Only spots that would light at least MIN_GAIN dark tiles are proposed.
 */
export function surveyOrders(st: Station, cov: Uint8Array, opts: SurveyOpts): Proposed[] {
  const map = st.map, w = map.w, out: Proposed[] = [];
  if (opts.max <= 0) return out;
  const dark = new Uint8Array(w * map.h);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < w; x++) if (needsLight(map.get(x, y)) && cov[y * w + x] === 0 && !opts.skip(x, y)) dark[y * w + x] = 1;
  const taken = (st.deco ?? []).filter((d) => d.layer === "wall");
  const busy = new Set<number>(opts.taken); for (const d of taken) busy.add(d.y * w + d.x);
  // each candidate spot with the dark tiles it would light (computed once)
  const cands: Array<{ x: number; y: number; tiles: number[] }> = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < w; x++) {
    if (busy.has(y * w + x) || opts.skip(x, y) || !isMountSpot(map, x, y)) continue;
    const tiles: number[] = [];
    for (let ty = Math.max(0, y + 1 - LAMP_REACH); ty <= Math.min(map.h - 1, y + 1 + LAMP_REACH); ty++)
      for (let tx = Math.max(0, x - LAMP_REACH); tx <= Math.min(w - 1, x + LAMP_REACH); tx++)
        if (dark[ty * w + tx] && lights(map, x, y, tx, ty)) tiles.push(ty * w + tx);
    if (tiles.length >= MIN_GAIN) cands.push({ x, y, tiles });
  }
  while (out.length < opts.max && cands.length) {
    let best = -1, bestGain = 0;
    for (let i = 0; i < cands.length; i++) { let g = 0; for (const t of cands[i].tiles) g += dark[t]; if (g > bestGain) { bestGain = g; best = i; } }
    if (best < 0 || bestGain < MIN_GAIN) break;
    const c = cands.splice(best, 1)[0];
    out.push({ x: c.x, y: c.y, gain: bestGain });
    for (const t of c.tiles) dark[t] = 0;
  }
  return out;
}
