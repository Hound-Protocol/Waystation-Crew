import type { LightSource } from "./types";

export interface TileView { x0: number; y0: number; x1: number; y1: number }

/** The lights worth sending to the GPU: reach touches the view, nearest the view centre first, at most `cap`. Ties go to the lowest id; the input is not modified. */
export function pickLights(all: readonly LightSource[], view: TileView, cap: number): LightSource[] {
  if (cap <= 0) return [];
  const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
  const out: Array<{ l: LightSource; d: number }> = [];
  for (const l of all) {
    const nx = Math.min(Math.max(l.x, view.x0), view.x1), ny = Math.min(Math.max(l.y, view.y0), view.y1);
    if (l.kind !== "sun" && Math.hypot(l.x - nx, l.y - ny) >= l.r) continue;
    out.push({ l, d: Math.hypot(l.x - cx, l.y - cy) });
  }
  out.sort((a, b) => a.d - b.d || a.l.id - b.l.id);
  if (out.length <= cap) return out.map((o) => o.l);
  // more lights than the budget: the ones nearest the cutoff distance dim smoothly to nothing, so panning or zooming never snaps a light on or off
  const cut = out[cap].d, band = Math.max(cut * 0.3, 1);
  return out.slice(0, cap).map((o) => { const w = Math.min(1, (cut - o.d) / band), k = w * w * (3 - 2 * w); return k >= 1 ? o.l : { ...o.l, i: o.l.i * k }; });
}
