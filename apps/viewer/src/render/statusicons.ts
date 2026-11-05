import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { TILE, canvasTexture } from "./tiles";
import { drawIcon, iconColor, iconKey, taskProgress, hop, type TaskLike } from "./icons";
import { zoomLevel } from "./lod";
import type { Tracks } from "./interp";
import type { Camera } from "./camera";

interface View { c: Container; spr: Sprite; ring: Graphics; key: string | null; shownKey: string | null; a: number; age: number; q: number }
const RING_STEPS = 48, BASE_SCALE = 0.8;

/** Status icons above heads (what they are doing, with a progress ring), only at the closest zoom level. Everything eases: no pop-ins. */
export class StatusLayer {
  readonly root = new Container();
  private tex = new Map<string, Texture>();
  private views = new Map<number, View>();
  private tasks = new Map<number, TaskLike>(); private depts = new Map<number, number>();
  private shown = 0;
  place: ((x: number, y: number) => { x: number; y: number }) | null = null;
  constructor() { this.root.visible = false; }
  private texture(key: string): Texture {
    let t = this.tex.get(key);
    if (!t) {
      const im = drawIcon(key), cv = document.createElement("canvas"); cv.width = im.w; cv.height = im.h;
      cv.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(im.data), im.w, im.h), 0, 0);
      t = canvasTexture(cv); this.tex.set(key, t);
    }
    return t;
  }
  reset(chars: Array<{ id: number; dept: number; task?: TaskLike }>) {
    this.tasks.clear(); this.depts.clear();
    for (const v of this.views.values()) v.c.destroy({ children: true });
    this.views.clear();
    for (const c of chars) { this.depts.set(c.id, c.dept); if (c.task) this.tasks.set(c.id, c.task); }
  }
  setTask(id: number, task: TaskLike) { this.tasks.set(id, task); }
  /** Debug: a character who is currently doing a task of this kind (started, not just walking there). */
  find(kind: number, nth = 0): number | null { let n = 0; for (const [id, t] of this.tasks) if (t.kind === kind && t.began >= 0 && n++ === nth) return id; return null; }
  private view(id: number): View {
    let v = this.views.get(id);
    if (!v) {
      const c = new Container(), spr = new Sprite(Texture.EMPTY), ring = new Graphics();
      spr.anchor.set(0.5, 1); ring.position.set(-0.5, -9); c.addChild(ring, spr); this.root.addChild(c);
      v = { c, spr, ring, key: null, shownKey: null, a: 0, age: 1, q: -1 };
      this.views.set(id, v);
    }
    return v;
  }
  update(dt: number, renderTick: number, tracks: Tracks, cam: Camera, viewW: number, viewH: number) {
    const on = zoomLevel(cam.scale) === 1;
    this.shown += ((on ? 1 : 0) - this.shown) * (1 - Math.exp(-dt * 10));
    if (!on && this.shown < 0.01) this.shown = 0;
    this.root.visible = this.shown > 0.01; this.root.alpha = this.shown;
    if (!this.root.visible) return;
    const x0 = -cam.tx / cam.scale - 2, y0 = -cam.ty / cam.scale - 3, x1 = x0 + viewW / cam.scale + 4, y1 = y0 + viewH / cam.scale + 5;
    for (const id of this.depts.keys()) {
      const task = this.tasks.get(id), key = task ? iconKey(task, this.depts.get(id)!) : null;
      let v = this.views.get(id);
      if (!v && !key) continue;
      v = v ?? this.view(id);
      if (key !== v.key) { if (key) { v.age = 0; if (!v.shownKey) v.a = 0; } v.key = key; }   // a new task: little hop
      v.a += ((key ? 1 : 0) - v.a) * (1 - Math.exp(-dt * 12)); if (!key && v.a < 0.01) v.a = 0;
      v.age += dt;
      const raw = tracks.positionAt(id, renderTick), p = raw && this.place ? { ...raw, ...this.place(raw.x, raw.y) } : raw;
      const vis = !!p && v.a > 0.01 && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
      v.c.visible = vis;
      if (!vis || !p) continue;
      const show = v.key ?? v.shownKey;
      if (show && show !== v.shownKey) { v.spr.texture = this.texture(show); v.shownKey = show; v.q = -1; }
      if (v.key && task) {
        const q = Math.round(taskProgress(task, renderTick) * RING_STEPS);
        if (q !== v.q) {
          v.q = q; const col = iconColor(v.key), r = 7.6;
          v.ring.clear().circle(0, 0, r).stroke({ color: col, width: 1, alpha: 0.3 });
          if (q > 0) v.ring.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * q) / RING_STEPS).stroke({ color: col, width: 1.8, alpha: 0.95 });
        }
      }
      v.c.alpha = v.a;
      v.c.scale.set(BASE_SCALE * (0.75 + 0.25 * Math.min(1, v.a)));
      v.c.position.set((p.x + 0.5) * TILE, (p.y + 0.1 - hop(v.age)) * TILE);
    }
  }
}
