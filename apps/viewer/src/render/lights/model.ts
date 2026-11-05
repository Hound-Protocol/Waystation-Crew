/** CPU reference light model. The GPU shader mirrors these formulas and constants. */
import type { LightSource } from "./types";

export const LEVELS = [0.16, 0.28, 0.44, 0.62, 0.82, 1.0];
export const AMBIENT = 0.5;
/** Spot: full intensity inside SPOT_INNER * halfCone, fading to 0 at the cone edge. */
export const SPOT_INNER = 0.8;
/** Softness ramp bounds, in px per tile. */
export const SOFT_MIN_SCALE = 3;
export const SOFT_MAX_SCALE = 48;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number) => { const c = clamp01(t); return c * c * (3 - 2 * c); };

export function falloff(d: number, r: number): number {
  if (d >= r) return 0;
  const t = 1 - d / r;
  return t * t;
}

/** True if the segment (x0,y0)-(x1,y1) crosses a solid cell, ignoring the start and end cells. DDA traversal. */
function blocked(mask: Uint8Array, w: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const h = Math.floor(mask.length / w);
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1);
  const dx = x1 - x0, dy = y1 - y0;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tx = dx !== 0 ? ((dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx) : Infinity;
  let ty = dy !== 0 ? ((dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy) : Infinity;
  const maxSteps = Math.abs(ex - cx) + Math.abs(ey - cy) + 2;
  for (let n = 0; n < maxSteps && (cx !== ex || cy !== ey); n++) {
    if (tx < ty) { cx += sx; tx += tdx; } else { cy += sy; ty += tdy; }
    if (cx === ex && cy === ey) break;
    if (cx >= 0 && cy >= 0 && cx < w && cy < h && mask[cy * w + cx] === 1) return true;
  }
  return false;
}

export function castLight(mask: Uint8Array, w: number, l: LightSource, px: number, py: number): number {
  if (l.kind === "sun") {
    // dir = direction toward the sun; shadow ray runs from the point toward it for l.r tiles.
    const a = l.dir ?? 0;
    const sx = px + Math.cos(a) * l.r, sy = py + Math.sin(a) * l.r;
    return blocked(mask, w, px, py, sx, sy) ? 0 : l.i;
  }
  let lx = l.x, ly = l.y;
  if (l.kind === "area") {
    const hw = (l.w ?? 0) / 2, hh = (l.h ?? 0) / 2;
    lx = Math.min(Math.max(px, l.x - hw), l.x + hw);
    ly = Math.min(Math.max(py, l.y - hh), l.y + hh);
  }
  const d = Math.hypot(px - lx, py - ly);
  const f = falloff(d, l.r);
  if (f <= 0) return 0;
  let k = 1;
  if (l.kind === "spot") {
    const half = (l.cone ?? Math.PI) / 2;
    let da = Math.abs(Math.atan2(py - ly, px - lx) - (l.dir ?? 0));
    da = da % (2 * Math.PI);
    if (da > Math.PI) da = 2 * Math.PI - da;
    if (d > 0) {
      if (da >= half) return 0;
      k = 1 - smoothstep((da - half * SPOT_INNER) / (half * (1 - SPOT_INNER)));
    }
  }
  // The light's own cell is the start of the walk and the target's own cell its end: both are skipped.
  if (blocked(mask, w, l.x, l.y, px, py) && l.kind !== "area") return 0;
  if (l.kind === "area" && blocked(mask, w, lx, ly, px, py)) return 0;
  return l.i * f * k;
}

export function quantize(v: number, soft: number): number {
  const n = LEVELS.length;
  if (v <= LEVELS[0]) return LEVELS[0];
  if (v >= LEVELS[n - 1]) return LEVELS[n - 1];
  let k = 0;
  while (k < n - 2 && v >= LEVELS[k + 1]) k++;
  const lo = LEVELS[k], hi = LEVELS[k + 1];
  const edge = (lo + hi) / 2;
  const width = soft * (hi - lo) / 2;
  if (width <= 0) return v < edge ? lo : hi;
  const t = clamp01((v - edge) / (2 * width) + 0.5);
  return lo + (hi - lo) * t;
}

export function softness(scale: number): number {
  return smoothstep((scale - SOFT_MIN_SCALE) / (SOFT_MAX_SCALE - SOFT_MIN_SCALE));
}
