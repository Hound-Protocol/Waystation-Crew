import { Container, Graphics, Text } from "pixi.js";

/** Camera scale (px per tile) above which the markers are hidden, and below which they are fully shown. */
export const MARKER_FADE = { start: 3, full: 1.2 };
/** Screen distance (px) between the two markers under which the ship's tag hides, and over which it is fully shown. */
const SEPARATE = { hide: 40, show: 110 };
const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** 0..1: how visible the markers should be at this zoom (smooth, so nothing pops in). */
export const markerAlpha = (scale: number) => smooth((MARKER_FADE.start - scale) / (MARKER_FADE.start - MARKER_FADE.full));
/** 0..1: how visible the ship's marker is given its screen distance to the station's marker (docked = hidden under the station tag). */
export const separationAlpha = (distPx: number) => smooth((distPx - SEPARATE.hide) / (SEPARATE.show - SEPARATE.hide));

const U = 3;   // icon pixel size in screen px
const px = (g: Graphics, cells: [number, number, number, number][], color: number) => { for (const [x, y, w, h] of cells) g.rect(x * U, y * U, w * U, h * U).fill(color); };

/** A hub with four arms and end pads, centred on (0,0). */
function stationIcon(): Graphics {
  const g = new Graphics(), C = 0x4de1ff, D = 0x1d5566;
  px(g, [[-1, -3, 2, 6], [-3, -1, 6, 2]], D); px(g, [[-1, -1, 2, 2]], 0xffffff);
  px(g, [[-1, -3, 2, 1], [-1, 2, 2, 1], [-3, -1, 1, 2], [2, -1, 1, 2]], C);
  px(g, [[-2, -4, 4, 1], [-2, 3, 4, 1], [-4, -2, 1, 4], [3, -2, 1, 4]], C);
  return g;
}
/** A small arrow-shaped ship, nose up, centred on (0,0). */
function shipIcon(): Graphics {
  const g = new Graphics(), C = 0xffb84d, D = 0x7a4a14;
  px(g, [[-1, -3, 2, 1], [-2, -2, 4, 1], [-2, -1, 4, 3]], C); px(g, [[-3, 1, 1, 2], [2, 1, 1, 2]], D); px(g, [[-1, 2, 2, 1]], D); px(g, [[-1, -2, 2, 1]], 0xffffff);
  return g;
}

class Marker {
  readonly root = new Container(); private a = 0;
  constructor(icon: Graphics, label: string) {
    const t = new Text({ text: label, style: { fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 11, fill: 0xe8f4fb, stroke: { color: 0x07080b, width: 3 }, letterSpacing: 0.5 } });
    t.anchor.set(0.5, 0); t.position.set(0, 16);
    this.root.addChild(icon, t); this.root.alpha = 0; this.root.visible = false;
  }
  /** Eases toward the target alpha and sits at a screen position. */
  update(dt: number, x: number, y: number, target: number) {
    this.a += (target - this.a) * (1 - Math.exp(-dt * 10));
    if (this.a < 0.01 && target === 0) this.a = 0;
    this.root.position.set(Math.round(x), Math.round(y)); this.root.alpha = this.a; this.root.visible = this.a > 0.005;
  }
}

/** Screen-space tags for the station and the ship that stay readable at any zoom and fade in as the real sprites shrink to specks. */
export class ZoomMarkers {
  readonly root = new Container();
  private station: Marker; private ship: Marker;
  constructor(stationName: string, shipName = "Cargo ship") {
    this.station = new Marker(stationIcon(), stationName); this.ship = new Marker(shipIcon(), shipName);
    this.root.addChild(this.station.root, this.ship.root);
  }
  /** `stationAt` and `shipAt` are world tile positions; `scale`, `tx`, `ty` are the camera. */
  update(dt: number, cam: { scale: number; tx: number; ty: number }, stationAt: { x: number; y: number }, shipAt: { x: number; y: number } | null) {
    const base = markerAlpha(cam.scale);
    const sx = stationAt.x * cam.scale + cam.tx, sy = stationAt.y * cam.scale + cam.ty;
    this.station.update(dt, sx, sy, base);
    if (shipAt) { const hx = shipAt.x * cam.scale + cam.tx, hy = shipAt.y * cam.scale + cam.ty; this.ship.update(dt, hx, hy, base * separationAlpha(Math.hypot(hx - sx, hy - sy))); }
    else this.ship.update(dt, 0, 0, 0);
  }
}
