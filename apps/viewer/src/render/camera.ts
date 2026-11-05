export const MIN_SCALE = 0.012, MAX_SCALE = 64;

/** screen = world * scale + (tx, ty); world units are tiles. */
export class Camera {
  tx = 0; ty = 0;
  targetScale: number;
  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private vx = 0; private vy = 0;
  private glide: { wx: number; wy: number; scale: number; vw: number; vh: number } | null = null;
  constructor(public scale: number) { this.targetScale = scale; }
  screenToWorld(sx: number, sy: number) { return { x: (sx - this.tx) / this.scale, y: (sy - this.ty) / this.scale }; }
  pan(dx: number, dy: number) { this.glide = null; this.tx += dx; this.ty += dy; this.vx = this.vy = 0; }
  zoomAt(sx: number, sy: number, factor: number) {
    const before = this.screenToWorld(sx, sy);
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
    this.targetScale = this.scale; this.anchor = null; this.glide = null;
    this.tx = sx - before.x * this.scale; this.ty = sy - before.y * this.scale;
  }
  /** Eased zoom: the point under (sx, sy) stays fixed while the scale glides to its target. */
  zoomAtSmooth(sx: number, sy: number, factor: number) {
    const w = this.screenToWorld(sx, sy);
    this.targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.targetScale * factor));
    this.anchor = { sx, sy, wx: w.x, wy: w.y }; this.glide = null;
  }
  /** Eased flight: the view centre drifts to world point (wx, wy) while the zoom glides to `scale`. Any manual pan or zoom cancels it. */
  glideTo(wx: number, wy: number, scale: number, viewW: number, viewH: number) {
    this.glide = { wx, wy, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)), vw: viewW, vh: viewH };
    this.targetScale = this.scale; this.anchor = null; this.vx = this.vy = 0;
  }
  /** Start a pan with momentum (px/s); it decays with friction in update(). */
  fling(vx: number, vy: number) { this.vx = vx; this.vy = vy; }
  /** Per-frame easing: zoom glide, pan momentum. Exponential, so it never overshoots. */
  update(dt: number) {
    if (this.glide) {
      const g = this.glide, k = 1 - Math.exp(-dt * 4);
      const c = this.screenToWorld(g.vw / 2, g.vh / 2);
      const cx = c.x + (g.wx - c.x) * k, cy = c.y + (g.wy - c.y) * k;
      this.scale *= Math.pow(g.scale / this.scale, k); this.targetScale = this.scale;
      const done = Math.hypot(g.wx - cx, g.wy - cy) * this.scale < 0.25 && Math.abs(Math.log(g.scale / this.scale)) < 1e-3;
      if (done) { this.scale = this.targetScale = g.scale; this.centerOn(g.wx, g.wy, g.vw, g.vh); this.glide = null; }
      else this.centerOn(cx, cy, g.vw, g.vh);
      return;
    }
    if (this.targetScale !== this.scale) {
      const k = 1 - Math.exp(-dt * 12);
      this.scale += (this.targetScale - this.scale) * k;
      if (Math.abs(this.targetScale - this.scale) < 1e-3 * this.targetScale) this.scale = this.targetScale;
      if (this.anchor) { this.tx = this.anchor.sx - this.anchor.wx * this.scale; this.ty = this.anchor.sy - this.anchor.wy * this.scale; }
      if (this.scale === this.targetScale) this.anchor = null;
    }
    if (this.vx || this.vy) {
      this.tx += this.vx * dt; this.ty += this.vy * dt;
      const f = Math.exp(-dt * 5);
      this.vx *= f; this.vy *= f;
      if (Math.abs(this.vx) < 1 && Math.abs(this.vy) < 1) this.vx = this.vy = 0;
    }
  }
  /** Ease the view so world point (wx, wy) drifts to the screen centre. */
  followToward(wx: number, wy: number, viewW: number, viewH: number, dt: number) {
    const k = 1 - Math.exp(-dt * 6);
    this.tx += (viewW / 2 - wx * this.scale - this.tx) * k;
    this.ty += (viewH / 2 - wy * this.scale - this.ty) * k;
    this.vx = this.vy = 0;
  }
  centerOn(wx: number, wy: number, viewW: number, viewH: number) {
    this.tx = viewW / 2 - wx * this.scale; this.ty = viewH / 2 - wy * this.scale;
  }
  fit(mapW: number, mapH: number, viewW: number, viewH: number) {
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(viewW / mapW, viewH / mapH) * 0.95));
    this.centerOn(mapW / 2, mapH / 2, viewW, viewH);
  }
  /** keep the view inside a rectangle of world tiles (the whole solar system) */
  clampRect(x: number, y: number, w: number, h: number, viewW: number, viewH: number) {
    const m = 4 * this.scale;
    this.tx = Math.min(viewW - m - x * this.scale, Math.max(m - (x + w) * this.scale, this.tx));
    this.ty = Math.min(viewH - m - y * this.scale, Math.max(m - (y + h) * this.scale, this.ty));
  }
  /** keep at least a margin of the map on screen */
  clamp(mapW: number, mapH: number, viewW: number, viewH: number) {
    const m = 4 * this.scale;
    this.tx = Math.min(viewW - m, Math.max(m - mapW * this.scale, this.tx));
    this.ty = Math.min(viewH - m, Math.max(m - mapH * this.scale, this.ty));
  }
}
