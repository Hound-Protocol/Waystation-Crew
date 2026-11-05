/** Wheel zoom that snaps: each notch glides to the next defined zoom stop and stays there. One stop per zoom level (see lod.ts), closest first. */
export const ZOOM_STOPS = [56, 36, 20, 6, 1.5, 0.15] as const;   // px per tile: Z1 (close detail) .. Z6 (solar system)

/** The stop one step from `scale`: dir 1 = closer, -1 = farther. From between stops, lands on the adjacent stop in that direction; stays at the ends. */
export function nextStop(scale: number, dir: 1 | -1): number {
  const eps = 1e-6 * scale;
  if (dir === 1) { for (let i = ZOOM_STOPS.length - 1; i >= 0; i--) if (ZOOM_STOPS[i] > scale + eps) return ZOOM_STOPS[i]; return ZOOM_STOPS[0]; }
  for (const s of ZOOM_STOPS) if (s < scale - eps) return s;
  return ZOOM_STOPS[ZOOM_STOPS.length - 1];
}

/** Turns raw wheel events into discrete steps: a mouse notch is one step; a trackpad's many small deltas add up to one; the rest of a spin is ignored for a moment. */
export class WheelStepper {
  private acc = 0; private lockUntil = -Infinity;
  static readonly NOTCH = 40; static readonly LOCK_MS = 220;
  /** `deltaY` as in WheelEvent (negative = scroll up = zoom in); returns 1 (closer), -1 (farther) or 0. */
  feed(deltaY: number, nowMs: number): 1 | -1 | 0 {
    if (nowMs < this.lockUntil) { this.acc = 0; return 0; }
    if (Math.sign(deltaY) !== Math.sign(this.acc)) this.acc = 0;
    this.acc += deltaY;
    if (Math.abs(this.acc) < WheelStepper.NOTCH) return 0;
    const dir = this.acc < 0 ? 1 : -1; this.acc = 0; this.lockUntil = nowMs + WheelStepper.LOCK_MS; return dir;
  }
}
