import { Container, Graphics } from "pixi.js";
import { TILE } from "./tiles";
import type { Edge, Pt } from "./reticle";

const CYAN = 0x4de1ff;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** An outline that eases in and out (no pop-ins). Lives in tile coordinates of whatever container it is added to. */
export class Outline {
  readonly g = new Graphics(); private a = 0; private edges: Edge[] | null = null; private circle: { c: Pt; r: number } | null = null; private w = 0.11;
  constructor() { this.g.alpha = 0; this.g.visible = false; }
  /** Thickness in tiles; redraws only when it changes enough to matter (each zoom step), not every frame. */
  setWidth(w: number) { if (Math.abs(w - this.w) / this.w < 0.2) return; this.w = w; if (this.edges) this.setEdges(this.edges); else if (this.circle) this.setCircle(this.circle.c, this.circle.r); }
  /** Straight runs on tile edges: any footprint, so modular stations outline themselves. */
  setEdges(edges: Edge[]) {
    this.edges = edges; this.circle = null; this.g.clear();
    for (const [w, al] of [[this.w * 2.7, 0.14], [this.w, 0.9]] as const) {
      for (const e of edges) this.g.moveTo(e.x1 * TILE, e.y1 * TILE).lineTo(e.x2 * TILE, e.y2 * TILE);
      this.g.stroke({ color: CYAN, width: w * TILE, alpha: al, cap: "square", join: "miter" });
    }
  }
  setCircle(c: Pt, r: number) {
    this.circle = { c, r }; this.edges = null; this.g.clear();
    for (const [w, al] of [[this.w * 2.7, 0.14], [this.w, 0.9]] as const) this.g.circle(c.x * TILE, c.y * TILE, r * TILE).stroke({ color: CYAN, width: w * TILE, alpha: al });
  }
  update(dt: number, on: boolean) {
    this.a += ((on ? 1 : 0) - this.a) * (1 - Math.exp(-dt * 12));
    if (this.a < 0.01) this.a = on ? this.a : 0;
    this.g.alpha = smooth(Math.min(1, this.a)); this.g.visible = this.a > 0.005;
  }
}

/** The faint reticle in the middle of the screen: a small square and a dot at 70% transparency. Fades in only where the overview works. */
export class ReticleGlyph {
  readonly root = new Container(); private g = new Graphics(); private a = 0;
  constructor() {
    this.g.rect(-14, -14, 28, 28).stroke({ color: 0xffffff, width: 1.5 });
    this.g.circle(0, 0, 2.5).fill({ color: 0xffffff });
    this.root.addChild(this.g); this.root.alpha = 0; this.root.visible = false;
  }
  update(dt: number, w: number, h: number, active: boolean) {
    this.a += ((active ? 1 : 0) - this.a) * (1 - Math.exp(-dt * 8));
    this.root.position.set(Math.round(w / 2), Math.round(h / 2));
    this.root.alpha = 0.3 * smooth(Math.min(1, this.a)); this.root.visible = this.a > 0.005;
  }
}
