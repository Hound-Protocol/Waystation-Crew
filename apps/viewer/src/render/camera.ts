export const MIN_SCALE = 1.5, MAX_SCALE = 64;

/** screen = world * scale + (tx, ty); world units are tiles. */
export class Camera {
  tx = 0; ty = 0;
  constructor(public scale: number) {}
  screenToWorld(sx: number, sy: number) { return { x: (sx - this.tx) / this.scale, y: (sy - this.ty) / this.scale }; }
  pan(dx: number, dy: number) { this.tx += dx; this.ty += dy; }
  zoomAt(sx: number, sy: number, factor: number) {
    const before = this.screenToWorld(sx, sy);
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
    this.tx = sx - before.x * this.scale; this.ty = sy - before.y * this.scale;
  }
  centerOn(wx: number, wy: number, viewW: number, viewH: number) {
    this.tx = viewW / 2 - wx * this.scale; this.ty = viewH / 2 - wy * this.scale;
  }
  fit(mapW: number, mapH: number, viewW: number, viewH: number) {
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(viewW / mapW, viewH / mapH) * 0.95));
    this.centerOn(mapW / 2, mapH / 2, viewW, viewH);
  }
  /** keep at least a margin of the map on screen */
  clamp(mapW: number, mapH: number, viewW: number, viewH: number) {
    const m = 4 * this.scale;
    this.tx = Math.min(viewW - m, Math.max(m - mapW * this.scale, this.tx));
    this.ty = Math.min(viewH - m, Math.max(m - mapH * this.scale, this.ty));
  }
}
