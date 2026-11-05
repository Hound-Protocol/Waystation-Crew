import { Container, Sprite, Texture } from "pixi.js";
import { DEPT_COLOR, SKIN } from "./colors";
import { TILE } from "./tiles";
import type { Tracks } from "./interp";
import type { Camera } from "./camera";
import { lodStyle, zoomLevel, type LodStyle } from "./lod";
import { WALK_SPEED } from "@wc/sim-core";

interface View { body: Sprite; head: Sprite; dept: number }
const STYLES: LodStyle[] = ["dot", "column", "silhouette", "sprite"];

/** One layer per LOD style; layers crossfade (~120 ms) when the zoom level changes. */
export class CharLayer {
  readonly root = new Container();
  private layers = new Map<LodStyle, { c: Container; views: View[]; alpha: number }>();
  ids: number[] = [];
  private depts: number[] = [];
  private fade: number[] = [];
  private known = new Set<number>();
  private bob: number[] = [];                      // eased walking-sway amount 0..1
  private last: Array<{ x: number; y: number } | null> = [];
  style: LodStyle = "dot";
  textures: Map<string, Texture> | null = null;
  constructor() {
    for (const s of STYLES) { const c = new Container(); c.visible = s === "dot"; this.root.addChild(c); this.layers.set(s, { c, views: [], alpha: s === "dot" ? 1 : 0 }); }
  }
  reset(chars: Array<{ id: number; dept: number }>) {
    this.ids = chars.map((c) => c.id); this.depts = chars.map((c) => c.dept);
    const first = this.known.size === 0;
    this.fade = this.ids.map((id) => (first || this.known.has(id) ? 1 : 0)); // newcomers fade in
    this.known = new Set(this.ids);
    this.bob = this.ids.map(() => 0); this.last = this.ids.map(() => null);
    for (const l of this.layers.values()) { l.c.removeChildren(); l.views = []; }
  }
  private ensure(style: LodStyle) {
    const l = this.layers.get(style)!;
    while (l.views.length < this.ids.length) {
      const i = l.views.length;
      const tex = style === "sprite" ? this.textures?.get(`char:${this.depts[i]}:${this.ids[i] % 4}`) : undefined;
      const body = new Sprite(tex ?? Texture.WHITE), head = new Sprite(Texture.WHITE);
      body.tint = tex ? 0xffffff : DEPT_COLOR[this.depts[i]] ?? 0xffffff; head.tint = SKIN;
      if (style === "dot") { body.width = TILE * 0.9; body.height = TILE * 0.9; body.anchor.set(0.5); head.visible = false; }
      else if (style === "column") { body.width = TILE * 0.5; body.height = TILE * 0.8; body.anchor.set(0.5, 1); head.visible = false; }
      else if (tex) { body.width = TILE; body.height = TILE; body.anchor.set(0.5); head.visible = false; }
      else {
        body.width = TILE * 0.38; body.height = TILE * 0.5; body.anchor.set(0.5, 1);
        head.width = TILE * 0.3; head.height = TILE * 0.3; head.anchor.set(0.5, 1);
      }
      l.c.addChild(body); if (style === "silhouette" || (style === "sprite" && !tex)) l.c.addChild(head);
      l.views.push({ body, head, dept: this.depts[i] });
    }
  }
  /** Maps a sim position to where it is drawn (crew aboard the flying ship ride its body). */
  place: ((x: number, y: number) => { x: number; y: number }) | null = null;
  update(dt: number, renderTick: number, tracks: Tracks, cam: Camera, viewW: number, viewH: number) {
    const target = lodStyle(zoomLevel(cam.scale));
    if (target !== this.style) { this.style = target; }
    for (const [s, l] of this.layers) {
      const goal = s === target ? 1 : 0;
      l.alpha += Math.sign(goal - l.alpha) * Math.min(Math.abs(goal - l.alpha), dt / 0.12);
      l.c.alpha = l.alpha; l.c.visible = l.alpha > 0.01;
    }
    for (let i = 0; i < this.fade.length; i++) if (this.fade[i] < 1) this.fade[i] = Math.min(1, this.fade[i] + dt / 0.6);
    const x0 = -cam.tx / cam.scale - 2, y0 = -cam.ty / cam.scale - 2, x1 = x0 + viewW / cam.scale + 4, y1 = y0 + viewH / cam.scale + 4;
    for (const [s, l] of this.layers) {
      if (!l.c.visible) continue;
      this.ensure(s);
      for (let i = 0; i < this.ids.length; i++) {
        const v = l.views[i];
        const raw = tracks.positionAt(this.ids[i], renderTick);
        const p = raw && this.place ? { ...raw, ...this.place(raw.x, raw.y) } : raw;
        const vis = !!p && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
        const spr = s === "sprite" && !!this.textures;
        v.body.alpha = v.head.alpha = this.fade[i];
        v.body.visible = vis; if (s === "silhouette" || (s === "sprite" && !spr)) v.head.visible = vis;
        if (!vis || !p) continue;
        // gentle left-right sway while walking, eased in and out (one full sway per tile, matching the stride)
        if (s === "sprite") {
          const lp = this.last[i]; const sp = lp && dt > 0 ? Math.hypot(p.x - lp.x, p.y - lp.y) / dt : 0;
          this.last[i] = { x: p.x, y: p.y };
          this.bob[i] += ((sp > 0.3 ? 1 : 0) - this.bob[i]) * (1 - Math.exp(-dt * 10));
        }
        const sway = s === "sprite" ? Math.sin(renderTick * WALK_SPEED * Math.PI * 2) * this.bob[i] : 0;
        const px = (p.x + 0.5 + sway * 0.05) * TILE, py = (p.y + 0.5) * TILE;
        if (s === "sprite") v.body.rotation = sway * 0.07;
        if (s === "dot") { v.body.position.set(px, py); }
        else if (s === "column") { v.body.position.set(px, py + TILE * 0.4); }
        else if (spr) {
          v.body.position.set(px, py);
          const tx = this.textures!.get(p.dir === "down" ? `char:${v.dept}:${this.ids[i] % 4}` : `char:${v.dept}:${this.ids[i] % 4}:${p.dir}`);
          if (tx && v.body.texture !== tx) v.body.texture = tx;
        }
        else { v.body.position.set(px, py + TILE * 0.45); v.head.position.set(px, py + TILE * 0.45 - TILE * 0.5); }
      }
    }
  }
}
