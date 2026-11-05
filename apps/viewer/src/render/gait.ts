/** Per-character walking style so a crowd doesn't move in lockstep: own sway speed, size and phase, and a lane that drifts slowly across the corridor. Pure and deterministic from the character id. */
export const LANE_SPREAD = 0.18;                   // tiles either side of the centre line
const TAU = Math.PI * 2;

/** Cheap integer hash -> 0..1 (stream picks an independent value per trait). */
function unit(id: number, stream: number): number {
  let h = Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(stream + 1, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export interface Gait { phase: number; freq: number; amp: number; lanePhase: number; lanePeriod: number }
const cache = new Map<number, Gait>();
export function gaitOf(id: number): Gait {
  let g = cache.get(id);
  if (!g) cache.set(id, g = { phase: unit(id, 0) * TAU, freq: 0.8 + unit(id, 1) * 0.45, amp: 0.03 + unit(id, 2) * 0.05, lanePhase: unit(id, 3) * TAU, lanePeriod: 60 + unit(id, 4) * 60 });
  return g;
}

/** Sideways sway in tiles; `t` is walked distance in tiles (render tick * walk speed), so the stride stays matched to the feet. */
export const swayAt = (id: number, t: number): number => { const g = gaitOf(id); return Math.sin(t * TAU * g.freq + g.phase) * g.amp; };
/** Offset of the walking lane from the centre line in tiles at a sim tick; slow enough that it never looks like jitter. */
export const laneAt = (id: number, tick: number): number => { const g = gaitOf(id); return Math.sin((tick / g.lanePeriod) * TAU + g.lanePhase) * LANE_SPREAD; };
